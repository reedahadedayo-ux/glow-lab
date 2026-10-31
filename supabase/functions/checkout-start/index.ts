import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const makeCheckoutWebhookUrl = Deno.env.get('MAKE_CHECKOUT_STARTED_WEBHOOK_URL') || '';
    const storefrontOrigin = Deno.env.get('STOREFRONT_ORIGIN') || 'https://glow-lab-puce.vercel.app';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    const {
      cart_id,
      customer_name,
      customer_email,
      customer_phone = '',
      delivery_state = 'Lagos',
      delivery_address = '',
      marketing_consent = false,
      items = [],
      idempotency_key,
    } = body;

    // 1. Validate required customer fields
    const emailClean = String(customer_email || '').trim().toLowerCase();
    const nameClean = String(customer_name || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nameClean || !emailClean || !emailRegex.test(emailClean)) {
      return jsonResponse({
        error: 'Validation failed: Valid customer name and email address are required.',
        code: 'INVALID_CUSTOMER',
      }, 400);
    }

    if (!cart_id || !Array.isArray(items) || items.length === 0) {
      return jsonResponse({
        error: 'Validation failed: Cart is empty or missing cart_id.',
        code: 'INVALID_CART',
      }, 400);
    }

    // 2. Idempotency check (prevent duplicate Checkout Started events)
    const idemKey = idempotency_key || `chk_idem_${cart_id}_${emailClean}`;
    const { data: existingEvent } = await supabase
      .from('automation_events')
      .select('*')
      .eq('idempotency_key', idemKey)
      .maybeSingle();

    if (existingEvent) {
      return jsonResponse({
        ok: true,
        duplicate_ignored: true,
        message: 'Duplicate Checkout Started event prevented via idempotency key.',
        event_id: existingEvent.event_id,
        checkout_id: existingEvent.checkout_id,
        payload: existingEvent.payload,
      }, 200);
    }

    // 3. Validate cart items & calculate total using trusted server-side prices
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('active', true);

    if (prodErr || !products) {
      return jsonResponse({ error: 'Could not load product catalogue' }, 500);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const validatedItems = [];
    let trustedSubtotal = 0;

    for (const raw of items) {
      const pid = raw.product_id || raw.id;
      const qty = Number(raw.quantity);
      const product = productMap.get(pid);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 50) {
        return jsonResponse({
          error: `Validation failed: Invalid product (${pid}) or quantity (${qty}).`,
          code: 'INVALID_PRODUCT',
        }, 400);
      }
      const lineTotal = product.price * qty;
      trustedSubtotal += lineTotal;
      validatedItems.push({
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        quantity: qty,
        unit_price: product.price,
        line_total: lineTotal,
        image_url: `${storefrontOrigin}/images/${product.image}`,
      });
    }

    // 4. Create or update Customer record in Supabase
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .upsert(
        {
          email: emailClean,
          full_name: nameClean,
          phone: customer_phone || null,
          marketing_consent: Boolean(marketing_consent),
          consent_updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (custErr || !customer) {
      return jsonResponse({ error: 'Failed to create/update customer record' }, 500);
    }

    // 5. Upsert Cart & Cart Items
    await supabase.from('carts').upsert({
      id: cart_id,
      customer_id: customer.id,
      status: 'checkout_started',
      subtotal: trustedSubtotal,
      currency: 'NGN',
      item_count: validatedItems.reduce((acc, i) => acc + i.quantity, 0),
    });

    await supabase.from('cart_items').delete().eq('cart_id', cart_id);
    await supabase.from('cart_items').insert(
      validatedItems.map((i) => ({
        cart_id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
      }))
    );

    // 6. Create Checkout record with unique recovery URL
    const checkoutId = crypto.randomUUID();
    const recoveryToken = `gl_rec_${checkoutId.replace(/-/g, '').slice(0, 16)}`;
    const recoveryUrl = `${storefrontOrigin}/checkout.html?recover_checkout=${recoveryToken}`;

    const reminderInitStatus = marketing_consent ? 'scheduled' : 'skipped_no_consent';
    const recoveryOutcomeInit = marketing_consent ? 'awaiting_customer' : 'no_marketing_consent';

    const { error: chkErr } = await supabase.from('checkouts').insert({
      id: checkoutId,
      cart_id,
      customer_id: customer.id,
      customer_name: nameClean,
      customer_email: emailClean,
      customer_phone: customer_phone || null,
      delivery_state,
      delivery_address,
      marketing_consent: Boolean(marketing_consent),
      subtotal: trustedSubtotal,
      currency: 'NGN',
      item_summary: validatedItems,
      recovery_token: recoveryToken,
      recovery_url: recoveryUrl,
      status: 'pending',
      first_reminder_status: reminderInitStatus,
      second_reminder_status: reminderInitStatus,
      purchase_status: 'unpaid',
      recovery_outcome: recoveryOutcomeInit,
    });

    if (chkErr) {
      return jsonResponse({ error: 'Failed to create checkout record' }, 500);
    }

    // 7. Build Klaviyo-ready Checkout Started event payload
    const eventId = `evt_chk_${checkoutId.replace(/-/g, '').slice(0, 16)}`;
    const timestamp = new Date().toISOString();

    const eventPayload = {
      event_id: eventId,
      event_name: 'Checkout Started',
      event_timestamp: timestamp,
      customer_email: emailClean,
      customer_name: nameClean,
      customer_phone: customer_phone || null,
      marketing_consent: Boolean(marketing_consent),
      checkout_id: checkoutId,
      cart_id,
      product_names: validatedItems.map((i) => i.name),
      product_ids: validatedItems.map((i) => i.product_id),
      product_quantities: validatedItems.map((i) => i.quantity),
      product_prices: validatedItems.map((i) => i.unit_price),
      items: validatedItems,
      cart_subtotal: trustedSubtotal,
      currency: 'NGN',
      checkout_recovery_url: recoveryUrl,
    };

    // 8. Record event in automation_events and dispatch to Make
    let eventStatus = 'processed';
    let errorMessage: string | null = null;
    let makeCode = 200;

    if (makeCheckoutWebhookUrl) {
      try {
        const makeRes = await fetch(makeCheckoutWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload),
        });
        makeCode = makeRes.status;
        if (!makeRes.ok) {
          eventStatus = 'failed';
          errorMessage = `Make webhook returned HTTP ${makeRes.status}`;
        }
      } catch (err) {
        eventStatus = 'failed';
        makeCode = 502;
        errorMessage = (err as Error).message;
      }
    }

    await supabase.from('automation_events').insert({
      event_id: eventId,
      idempotency_key: idemKey,
      event_type: 'Checkout Started',
      checkout_id: checkoutId,
      cart_id,
      customer_email: emailClean,
      payload: eventPayload,
      status: eventStatus,
      make_response_code: makeCode,
      error_message: errorMessage,
      processed_at: eventStatus === 'processed' ? timestamp : null,
    });

    return jsonResponse({
      ok: true,
      duplicate_ignored: false,
      checkout_id: checkoutId,
      event_id: eventId,
      recovery_url: recoveryUrl,
      event_status: eventStatus,
      payload: eventPayload,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
