import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      event_id,
      checkout_id,
      event_status,
      first_reminder_status,
      second_reminder_status,
      recovery_outcome,
      error_message,
    } = body;

    if (event_id && event_status) {
      await supabase
        .from('automation_events')
        .update({
          status: event_status,
          error_message: error_message || null,
          processed_at: event_status === 'processed' ? new Date().toISOString() : null,
        })
        .eq('event_id', event_id);
    }

    if (checkout_id) {
      const updates: Record<string, unknown> = {};
      if (first_reminder_status) {
        updates.first_reminder_status = first_reminder_status;
        if (first_reminder_status === 'sent') {
          updates.first_reminder_sent_at = new Date().toISOString();
          updates.status = 'abandoned';
        }
      }
      if (second_reminder_status) {
        updates.second_reminder_status = second_reminder_status;
        if (second_reminder_status === 'sent') {
          updates.second_reminder_sent_at = new Date().toISOString();
          updates.recovery_outcome = 'abandoned_unpaid';
        }
      }
      if (recovery_outcome) {
        updates.recovery_outcome = recovery_outcome;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('checkouts').update(updates).eq('id', checkout_id);
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
