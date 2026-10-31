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
    const makeOrderWebhookUrl = Deno.env.get('MAKE_PLACED_ORDER_WEBHOOK_URL') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { checkout_id, idempotency_key } = body;

    if (!checkout_id) {
      return jsonResponse({ error: 'checkout_id is required to simulate a purchase' }, 400);
    }

    // 1. Verify checkout exists
    const { data: checkout, error: chkErr } = await supabase
      .from('checkouts')
      .select('*')
      .eq('id', checkout_id)
      .single();

    if (chkErr || !checkout) {
      return jsonResponse({ error: 'Checkout record not found' }, 404);
    }

    // 2. Check idempotency / existing order for this checkout
    const idemKey = idempotency_key || `ord_idem_${checkout_id}`;
    const { data: existingEvent } = await supabase
      .from('automation_events')
      .select('*')
      .eq('idempotency_key', idemKey)
      .maybeSingle();

    if (existingEvent) {
      return jsonResponse({
        ok: true,
        duplicate_ignored: true,
        message: 'Duplicate Placed Order event prevented via idempotency key.',
        event_id: existingEvent.event_id,
        order_id: existingEvent.order_id,
        checkout_id,
        payload: existingEvent.payload,
      });
    }

    // 3. Create simulated Order record in Supabase
    const orderId = crypto.randomUUID();
    const orderNumber = `GL-SIM-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    const { error: ordErr } = await supabase.from('orders').insert({
      id: orderId,
      order_number: orderNumber,
      checkout_id: checkout.id,
      cart_id: checkout.cart_id,
      customer_id: checkout.customer_id,
      customer_email: checkout.customer_email,
      customer_name: checkout.customer_name,
      total_amount: checkout.subtotal,
      currency: checkout.currency,
      items: checkout.item_summary,
      status: 'simulated',
      is_demo_simulation: true,
    });

    if (ordErr) {
      return jsonResponse({ error: 'Failed to create simulated order record' }, 500);
    }

    // 4. Determine recovery outcome & suppression statuses
    let firstReminderStatus = checkout.first_reminder_status;
    let secondReminderStatus = checkout.second_reminder_status;
    let recoveryOutcome = 'converted_before_reminder_1';

    if (firstReminderStatus !== 'sent') {
      firstReminderStatus = 'suppressed';
      secondReminderStatus = 'suppressed';
      recoveryOutcome = 'converted_before_reminder_1';
    } else if (secondReminderStatus !== 'sent') {
      secondReminderStatus = 'suppressed';
      recoveryOutcome = 'recovered_after_reminder_1';
    } else {
      recoveryOutcome = 'recovered_after_reminder_2';
    }

    // 5. Mark Checkout as converted and Cart as purchased
    await supabase
      .from('checkouts')
      .update({
        status: 'converted',
        purchase_status: 'simulated_purchase',
        first_reminder_status: firstReminderStatus,
        second_reminder_status: secondReminderStatus,
        recovery_outcome: recoveryOutcome,
        converted_at: timestamp,
      })
      .eq('id', checkout.id);

    await supabase
      .from('carts')
      .update({ status: 'purchased' })
      .eq('id', checkout.cart_id);

    // 6. Generate Placed Order event payload for Make & Klaviyo
    const eventId = `evt_ord_${orderId.replace(/-/g, '').slice(0, 16)}`;
    const items = Array.isArray(checkout.item_summary) ? checkout.item_summary : [];

    const eventPayload = {
      event_id: eventId,
      event_name: 'Placed Order',
      event_timestamp: timestamp,
      is_simulated_order: true,
      order_id: orderId,
      order_number: orderNumber,
      checkout_id: checkout.id,
      cart_id: checkout.cart_id,
      customer_email: checkout.customer_email,
      customer_name: checkout.customer_name,
      total_amount: checkout.subtotal,
      currency: checkout.currency,
      product_names: items.map((i: { name: string }) => i.name),
      product_ids: items.map((i: { product_id: string }) => i.product_id),
      product_quantities: items.map((i: { quantity: number }) => i.quantity),
      product_prices: items.map((i: { unit_price: number }) => i.unit_price),
      items,
      recovery_outcome: recoveryOutcome,
    };

    // 7. Dispatch to Make & record in automation_events
    let eventStatus = 'processed';
    let errorMessage: string | null = null;
    let makeCode = 200;

    if (makeOrderWebhookUrl) {
      try {
        const makeRes = await fetch(makeOrderWebhookUrl, {
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
      event_type: 'Placed Order',
      checkout_id: checkout.id,
      order_id: orderId,
      cart_id: checkout.cart_id,
      customer_email: checkout.customer_email,
      payload: eventPayload,
      status: eventStatus,
      make_response_code: makeCode,
      error_message: errorMessage,
      processed_at: eventStatus === 'processed' ? timestamp : null,
    });

    return jsonResponse({
      ok: true,
      duplicate_ignored: false,
      order_id: orderId,
      order_number: orderNumber,
      checkout_id: checkout.id,
      event_id: eventId,
      recovery_outcome: recoveryOutcome,
      payload: eventPayload,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
