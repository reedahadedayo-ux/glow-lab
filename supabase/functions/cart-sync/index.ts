import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const cartId = url.searchParams.get('cart_id');
      const recoveryToken = url.searchParams.get('recovery_token') || url.searchParams.get('recover_checkout');

      if (recoveryToken) {
        const { data: checkout, error: chkErr } = await supabase
          .from('checkouts')
          .select('*, carts(*, cart_items(*))')
          .or(`recovery_token.eq.${recoveryToken},id.eq.${recoveryToken}`)
          .single();

        if (chkErr || !checkout) {
          return jsonResponse({ error: 'Recovery reference not found' }, 404);
        }

        if (checkout.status === 'pending' || checkout.status === 'abandoned') {
          await supabase.from('carts').update({ status: 'recovered' }).eq('id', checkout.cart_id);
        }

        return jsonResponse({
          recovered: true,
          checkout_id: checkout.id,
          cart_id: checkout.cart_id,
          customer: {
            full_name: checkout.customer_name,
            email: checkout.customer_email,
            phone: checkout.customer_phone,
            marketing_consent: checkout.marketing_consent,
          },
          items: checkout.item_summary,
          subtotal: checkout.subtotal,
          currency: checkout.currency,
        });
      }

      if (!cartId) {
        return jsonResponse({ error: 'cart_id or recovery_token is required' }, 400);
      }

      const { data: cart } = await supabase
        .from('carts')
        .select('*, cart_items(*)')
        .eq('id', cartId)
        .maybeSingle();

      return jsonResponse({ cart: cart || null });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { cart_id, items } = body;

      if (!cart_id || !Array.isArray(items)) {
        return jsonResponse({ error: 'cart_id and items array are required' }, 400);
      }

      // Fetch authoritative product prices from Supabase products table
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, brand, price, image, category')
        .eq('active', true);

      if (prodErr || !products) {
        return jsonResponse({ error: 'Failed to load trusted product catalogue' }, 500);
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      const validatedItems = [];
      let subtotal = 0;
      let itemCount = 0;

      for (const rawItem of items) {
        const product = productMap.get(rawItem.product_id || rawItem.id);
        const qty = Number(rawItem.quantity);
        if (!product || !Number.isInteger(qty) || qty < 1 || qty > 50) {
          continue;
        }
        const lineTotal = product.price * qty;
        subtotal += lineTotal;
        itemCount += qty;
        validatedItems.push({
          cart_id,
          product_id: product.id,
          quantity: qty,
          unit_price: product.price,
          line_total: lineTotal,
        });
      }

      // Upsert cart record
      await supabase.from('carts').upsert({
        id: cart_id,
        status: 'active',
        subtotal,
        currency: 'NGN',
        item_count: itemCount,
      });

      // Replace cart_items
      await supabase.from('cart_items').delete().eq('cart_id', cart_id);
      if (validatedItems.length > 0) {
        await supabase.from('cart_items').insert(validatedItems);
      }

      return jsonResponse({
        ok: true,
        cart_id,
        subtotal,
        item_count: itemCount,
        items: validatedItems,
      });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
