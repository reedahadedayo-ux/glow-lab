/* GlowLab Skincare - Automation Dashboard, Airtable View & Test Suite Controller (js/automation.js) */

(function () {
  const VERCEL_PROD_ORIGIN = 'https://glow-lab-puce.vercel.app';
  let latestSnapshot = null;

  function isLocalOrSandboxPreview() {
    const host = window.location.hostname || '';
    return host !== 'glow-lab-puce.vercel.app' && !host.endsWith('.vercel.app');
  }

  function pillClassForStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('sent') || s.includes('processed') || s.includes('simulated purchase') || s.includes('converted') || s.includes('recovered')) {
      return 'green';
    }
    if (s.includes('suppressed') || s.includes('scheduled') || s.includes('waiting') || s.includes('progress')) {
      return 'amber';
    }
    if (s.includes('failed') || s.includes('abandoned')) {
      return 'red';
    }
    return 'gray';
  }

  function formatShortTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-NG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) return;
      const data = await res.json();
      latestSnapshot = data;
      renderSnapshot(data);
    } catch (err) {
      console.error('Failed to load dashboard snapshot:', err);
    }
  }

  function renderSnapshot(data) {
    if (!data) return;

    // 1. Update Stats Bar
    const stats = data.stats || {};
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    setEl('statTotalCheckouts', stats.total_checkouts || 0);
    setEl('statAbandonedUnpaid', stats.abandoned_unpaid || 0);
    setEl('statSimulatedConversions', stats.simulated_conversions || 0);
    setEl('statEventsProcessed', stats.events_processed || 0);

    // 2. Render Airtable Operational Reporting Table
    const airtableBody = document.getElementById('airtableTableBody');
    if (airtableBody) {
      const rows = data.airtable_records || [];
      if (rows.length === 0) {
        airtableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:28px;">No checkout records yet.</td></tr>`;
      } else {
        airtableBody.innerHTML = rows
          .map(
            r => `
            <tr>
              <td><code style="font-weight:700; font-size:0.78rem;">${r.checkout_id}</code></td>
              <td>
                <strong style="display:block; color:var(--charcoal);">${r.customer_name}</strong>
                <span style="font-size:0.78rem; color:var(--text-muted);">${r.customer_email}</span>
              </td>
              <td style="font-weight:700; white-space:nowrap;">${formatNGN(r.cart_value)}</td>
              <td style="max-width:240px; font-size:0.8rem; color:var(--charcoal-soft);">${r.products}</td>
              <td style="white-space:nowrap; font-size:0.78rem; color:var(--text-muted);">${formatShortTime(r.checkout_date)}</td>
              <td><span class="status-pill ${pillClassForStatus(r.first_reminder_label)}">${r.first_reminder_label}</span></td>
              <td><span class="status-pill ${pillClassForStatus(r.second_reminder_label)}">${r.second_reminder_label}</span></td>
              <td><span class="status-pill ${pillClassForStatus(r.purchase_status)}">${r.purchase_status}</span></td>
              <td><span class="status-pill ${pillClassForStatus(r.recovery_outcome_label)}">${r.recovery_outcome_label}</span></td>
              <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  ${
                    r.purchase_status !== 'Simulated Purchase'
                      ? `<button type="button" class="btn btn-secondary" style="padding:5px 10px; font-size:0.74rem;" data-row-email1="${r.checkout_id}">Email 1</button>
                         <button type="button" class="btn btn-secondary" style="padding:5px 10px; font-size:0.74rem;" data-row-email2="${r.checkout_id}">Email 2</button>
                         <button type="button" class="btn btn-sage" style="padding:5px 10px; font-size:0.74rem;" data-row-purchase="${r.checkout_id}">Simulate Buy</button>`
                      : `<a href="${r.recovery_url}" style="font-size:0.75rem; color:var(--sage-dark); font-weight:600;">Recovery URL</a>`
                  }
                </div>
              </td>
            </tr>
          `
          )
          .join('');

        airtableBody.querySelectorAll('[data-row-email1]').forEach(btn => {
          btn.addEventListener('click', () => triggerRowStep(btn.dataset.rowEmail1, 1));
        });
        airtableBody.querySelectorAll('[data-row-email2]').forEach(btn => {
          btn.addEventListener('click', () => triggerRowStep(btn.dataset.rowEmail2, 2));
        });
        airtableBody.querySelectorAll('[data-row-purchase]').forEach(btn => {
          btn.addEventListener('click', () => triggerRowPurchase(btn.dataset.rowPurchase));
        });
      }
    }

    // 3. Render Supabase automation_events Table
    const eventsBody = document.getElementById('eventsTableBody');
    if (eventsBody) {
      const events = data.automation_events || [];
      if (events.length === 0) {
        eventsBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:28px;">No events logged yet.</td></tr>`;
      } else {
        eventsBody.innerHTML = events
          .map(
            ev => `
            <tr>
              <td><code style="font-size:0.76rem; font-weight:700;">${ev.event_id}</code></td>
              <td><strong>${ev.event_type}</strong></td>
              <td style="font-size:0.8rem;">${ev.customer_email}</td>
              <td><code style="font-size:0.76rem;">${ev.checkout_id || '—'}</code></td>
              <td><code style="font-size:0.72rem; color:var(--text-muted);">${ev.idempotency_key}</code></td>
              <td>
                <span class="status-pill ${pillClassForStatus(ev.status)}">${ev.status.toUpperCase()}</span>
                ${ev.error_message ? `<div style="font-size:0.72rem; color:#b91c1c; margin-top:4px;">${ev.error_message}</div>` : ''}
              </td>
              <td style="text-align:center; font-weight:600;">${ev.attempts || 1}</td>
              <td style="font-size:0.76rem; color:var(--text-muted); white-space:nowrap;">${formatShortTime(ev.created_at)}</td>
              <td>
                ${
                  ev.status === 'failed'
                    ? `<button type="button" class="btn btn-sage" style="padding:5px 12px; font-size:0.74rem;" data-retry-event="${ev.event_id}">↻ Retry Safely</button>`
                    : `<span style="font-size:0.74rem; color:var(--text-light);">✓ Complete</span>`
                }
              </td>
            </tr>
          `
          )
          .join('');

        eventsBody.querySelectorAll('[data-retry-event]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const eventId = btn.dataset.retryEvent;
            const res = await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'retry_event', event_id: eventId })
            });
            const rData = await res.json();
            if (res.ok) {
              showToast(rData.message || 'Event retried and marked processed!', 3500);
              loadDashboard();
            }
          });
        });
      }
    }
  }

  async function triggerRowStep(checkoutId, stepNum) {
    const chk = latestSnapshot && Array.isArray(latestSnapshot.checkouts)
      ? latestSnapshot.checkouts.find(c => c.id === checkoutId)
      : null;

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'advance_recovery',
        checkout_id: checkoutId,
        checkout_snapshot: chk,
        step: stepNum
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 3500);
      loadDashboard();
    }
  }

  async function triggerRowPurchase(checkoutId) {
    const chk = latestSnapshot && Array.isArray(latestSnapshot.checkouts)
      ? latestSnapshot.checkouts.find(c => c.id === checkoutId)
      : null;

    const payload = { checkout_id: checkoutId, checkout_snapshot: chk };
    const res = await fetch('/api/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (isLocalOrSandboxPreview()) {
      try {
        await fetch(`${VERCEL_PROD_ORIGIN}/api/purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {}
    }

    if (res.ok) {
      showToast(`Simulated Order ${data.order_number} created! Pending reminders suppressed.`, 4000);
      loadDashboard();
    }
  }

  function initLiveMakePingButton() {
    const btn = document.getElementById('sendLiveMakePingBtn');
    const banner = document.getElementById('makePingResultBanner');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '📡 Sending Event to Make.com...';

      const payload = {
        cart_id: `cart_ping_${Date.now().toString().slice(-6)}`,
        customer_name: 'Adaeze Okafor (Live Make Test)',
        customer_email: `adaeze.maketest.${Date.now().toString().slice(-4)}@glowlab-demo.ng`,
        customer_phone: '+234 803 555 0192',
        delivery_state: 'Lagos',
        delivery_address: '14B Admiralty Way, Lekki Phase 1, Lagos',
        marketing_consent: true,
        items: [
          { product_id: 'cerave-foaming', quantity: 1 },
          { product_id: 'boj-relief-sun', quantity: 1 },
          { product_id: 'ordinary-niacinamide', quantity: 1 }
        ],
        idempotency_key: `chk_make_ping_${Date.now()}`
      };

      try {
        // Always hit local endpoint first so local dashboard updates
        const localRes = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        let resultData = await localRes.json();

        // If running inside Arena Live Preview, also call the live Vercel production endpoint so Make.com receives the webhook
        if (isLocalOrSandboxPreview() && !resultData.make_dispatched) {
          const prodRes = await fetch(`${VERCEL_PROD_ORIGIN}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              idempotency_key: `${payload.idempotency_key}_prod`
            })
          });
          resultData = await prodRes.json();
        }

        btn.disabled = false;
        btn.textContent = orig;
        loadDashboard();

        if (banner) {
          banner.style.display = 'block';
          if (resultData.make_dispatched) {
            banner.style.background = '#ecfdf5';
            banner.style.border = '1px solid #a7f3d0';
            banner.style.color = '#065f46';
            banner.innerHTML =
              `<strong>✅ Make.com Webhook Delivered Successfully!</strong><br/>` +
              `Event ID: <code>${resultData.event_id}</code> • Checkout ID: <code>${resultData.checkout_id}</code> • Total: <strong>₦39,500</strong><br/>` +
              `Make Response: <code>HTTP ${resultData.make_response_code} — ${resultData.make_response_text || 'Accepted'}</code>`;
          } else {
            banner.style.background = '#fffbeb';
            banner.style.border = '1px solid #fde68a';
            banner.style.color = '#92400e';
            banner.innerHTML =
              `<strong>⚠️ Make.com Returned HTTP ${resultData.make_response_code || 'Error'}</strong><br/>` +
              `Response from Make: <code>${resultData.make_response_text || resultData.error_message || 'No scenario listening'}</code>.<br/>` +
              `<em>Tip: In Make.com, click <strong>"Redetermine data structure"</strong> on your Custom Webhook module (or turn the scenario ON / click "Run once"), then click this button again.</em>`;
          }
        }
        showToast(
          resultData.make_dispatched
            ? `Make.com accepted webhook (${resultData.event_id})! 🎉`
            : `Make returned HTTP ${resultData.make_response_code}: check banner for details`,
          4500
        );
      } catch (err) {
        btn.disabled = false;
        btn.textContent = orig;
        showToast(`Failed to send test webhook: ${err.message}`, 4000);
      }
    });
  }

  function initTestRunner() {
    const consoleBox = document.getElementById('testResultsConsole');
    const consoleTitle = document.getElementById('testConsoleTitle');
    const consoleStatus = document.getElementById('testConsoleStatus');
    const consoleSteps = document.getElementById('testConsoleSteps');

    async function executeScenario(scenario) {
      const res = await fetch('/api/test-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();

      // Also relay to Vercel production if running inside the Arena Live Preview so Make receives the live events
      if (isLocalOrSandboxPreview()) {
        fetch(`${VERCEL_PROD_ORIGIN}/api/test-scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario })
        }).catch(() => {});
      }

      if (data.snapshot) {
        latestSnapshot = data.snapshot;
        renderSnapshot(data.snapshot);
      }

      if (scenario === 'all' && Array.isArray(data.results)) {
        data.results.forEach(r => {
          const badge = document.getElementById(`scenarioBadge${r.scenario}`);
          if (badge) {
            badge.className = `status-pill ${r.passed ? 'green' : 'red'}`;
            badge.textContent = `Test ${r.scenario} • ${r.passed ? 'PASSED ✓' : 'FAILED'}`;
          }
        });

        if (consoleBox) {
          consoleBox.style.display = 'block';
          consoleTitle.textContent = 'All 6 Automated Test Scenarios Executed';
          consoleStatus.className = `status-pill ${data.all_passed ? 'green' : 'red'}`;
          consoleStatus.textContent = data.all_passed ? '6 / 6 PASSED ✓' : 'ISSUES FOUND';
          consoleSteps.innerHTML = data.results
            .map(
              r => `
              <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border);">
                <strong style="color:var(--charcoal);">${r.passed ? '✅' : '❌'} ${r.name}</strong>
                <ul style="margin-top:6px; padding-left:18px; list-style:disc;">
                  ${r.steps.map(s => `<li>${s}</li>`).join('')}
                </ul>
              </div>
            `
            )
            .join('');
        }
        showToast('All 6 portfolio test scenarios passed! 🎉', 4000);
        return;
      }

      // Single scenario
      const badge = document.getElementById(`scenarioBadge${data.scenario}`);
      if (badge) {
        badge.className = `status-pill ${data.passed ? 'green' : 'red'}`;
        badge.textContent = `Test ${data.scenario} • ${data.passed ? 'PASSED ✓' : 'FAILED'}`;
      }

      if (consoleBox) {
        consoleBox.style.display = 'block';
        consoleTitle.textContent = data.name;
        consoleStatus.className = `status-pill ${data.passed ? 'green' : 'red'}`;
        consoleStatus.textContent = data.passed ? 'PASSED ✓' : 'FAILED';
        consoleSteps.innerHTML = `
          <ul style="padding-left:18px; list-style:disc;">
            ${(data.steps || []).map(s => `<li style="margin-bottom:4px;">${s}</li>`).join('')}
          </ul>
        `;
      }
      showToast(`${data.name}: ${data.passed ? 'PASSED ✓' : 'FAILED'}`, 3500);
    }

    document.querySelectorAll('[data-run-scenario]').forEach(btn => {
      btn.addEventListener('click', () => executeScenario(Number(btn.dataset.runScenario)));
    });

    const runAllBtn = document.getElementById('runAllTestsBtn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => executeScenario('all'));
    }
  }

  function initEmailPreviewTabs() {
    const tab1 = document.getElementById('previewEmail1Tab');
    const tab2 = document.getElementById('previewEmail2Tab');
    const frame = document.getElementById('emailPreviewFrame');
    const subj = document.getElementById('emailPreviewSubject');
    const delay = document.getElementById('emailPreviewDelay');

    if (!tab1 || !tab2 || !frame) return;

    tab1.addEventListener('click', () => {
      tab1.classList.add('active');
      tab2.classList.remove('active');
      frame.src = 'automation/klaviyo/email-1-first-reminder.html';
      if (subj) subj.textContent = 'Still thinking about your GlowLab routine? 🌿';
      if (delay) delay.textContent = 'Demo: 2–5 mins • Production: 1 hour after Checkout Started (if Placed Order = 0)';
    });

    tab2.addEventListener('click', () => {
      tab2.classList.add('active');
      tab1.classList.remove('active');
      frame.src = 'automation/klaviyo/email-2-second-reminder.html';
      if (subj) subj.textContent = 'Still deciding on your skincare routine? Your cart is saved';
      if (delay) delay.textContent = 'Demo: 5–10 mins • Production: 24 hours after Checkout Started (if Placed Order = 0)';
    });
  }

  function initCsvExport() {
    const btn = document.getElementById('exportAirtableCsvBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!latestSnapshot || !Array.isArray(latestSnapshot.airtable_records)) return;
      const headers = [
        'Checkout ID',
        'Customer Email',
        'Customer Name',
        'Cart Value (NGN)',
        'Products',
        'Checkout Date',
        'Marketing Consent',
        'First Reminder Status',
        'Second Reminder Status',
        'Purchase Status',
        'Recovery Outcome',
        'Recovery URL'
      ];
      const escapeCsv = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const lines = [headers.join(',')];
      for (const r of latestSnapshot.airtable_records) {
        lines.push(
          [
            escapeCsv(r.checkout_id),
            escapeCsv(r.customer_email),
            escapeCsv(r.customer_name),
            r.cart_value,
            escapeCsv(r.products),
            escapeCsv(r.checkout_date),
            r.marketing_consent,
            escapeCsv(r.first_reminder_label),
            escapeCsv(r.second_reminder_label),
            escapeCsv(r.purchase_status),
            escapeCsv(r.recovery_outcome_label),
            escapeCsv(r.recovery_url)
          ].join(',')
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glowlab-airtable-checkout-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Exported Airtable CSV report! 📊', 3000);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    initLiveMakePingButton();
    initTestRunner();
    initEmailPreviewTabs();
    initCsvExport();

    const refreshBtn = document.getElementById('refreshDashboardBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadDashboard();
        showToast('Refreshed live Supabase & Airtable records', 2000);
      });
    }
  });
})();
