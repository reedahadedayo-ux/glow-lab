/* GlowLab Skincare - Checkout & Demo Purchase Simulation Controller (js/checkout.js) */

(function () {
  const VERCEL_PROD_ORIGIN = 'https://glow-lab-puce.vercel.app';
  let activeCheckout = null;
  let lastSubmittedPayload = null;

  function isLocalOrSandboxPreview() {
    const host = window.location.hostname || '';
    return host !== 'glow-lab-puce.vercel.app' && !host.endsWith('.vercel.app');
  }

  function renderOrderSummary() {
    if (!window.GlowLabCart) return;
    const summary = window.GlowLabCart.getSummary();

    const cartIdBadge = document.getElementById('summaryCartIdBadge');
    if (cartIdBadge) cartIdBadge.textContent = `Cart ID: ${summary.cart_id}`;

    const itemCountEl = document.getElementById('summaryItemCount');
    const subtotalEl = document.getElementById('summarySubtotal');
    const totalEl = document.getElementById('summaryTotal');

    if (itemCountEl) itemCountEl.textContent = `${summary.item_count} item${summary.item_count === 1 ? '' : 's'}`;
    if (subtotalEl) subtotalEl.textContent = formatNGN(summary.subtotal);
    if (totalEl) totalEl.textContent = formatNGN(summary.total);

    const itemsContainer = document.getElementById('checkoutSummaryItems');
    const emptyHelper = document.getElementById('emptyCartHelper');
    const submitBtn = document.getElementById('startCheckoutBtn');

    if (!itemsContainer) return;

    if (summary.items.length === 0) {
      itemsContainer.innerHTML = '';
      if (emptyHelper) emptyHelper.style.display = 'block';
      if (submitBtn && !activeCheckout) submitBtn.disabled = false;
      return;
    }

    if (emptyHelper) emptyHelper.style.display = 'none';

    itemsContainer.innerHTML = summary.items
      .map(
        item => `
        <div class="cart-item-row" style="background:var(--white); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); margin-bottom:10px;">
          <div class="cart-item-thumb">
            <img src="images/${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100/FDF8F3/9AB19F?text=GlowLab'">
          </div>
          <div class="cart-item-info">
            <div class="cart-item-brand">${item.brand}</div>
            <h4>${item.name}</h4>
            <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">
              ${formatNGN(item.unit_price)} × ${item.quantity} = <strong style="color:var(--charcoal);">${formatNGN(item.line_total)}</strong>
            </div>
            <div class="cart-item-controls">
              <div class="qty-stepper">
                <button type="button" data-chk-dec="${item.product_id}" aria-label="Decrease quantity">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-chk-inc="${item.product_id}" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="cart-remove-btn" data-chk-remove="${item.product_id}">Remove</button>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    itemsContainer.querySelectorAll('[data-chk-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.chkDec;
        const found = summary.items.find(i => i.product_id === pid);
        if (found) window.GlowLabCart.updateQuantity(pid, found.quantity - 1);
      });
    });

    itemsContainer.querySelectorAll('[data-chk-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.chkInc;
        const found = summary.items.find(i => i.product_id === pid);
        if (found) window.GlowLabCart.updateQuantity(pid, found.quantity + 1);
      });
    });

    itemsContainer.querySelectorAll('[data-chk-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.GlowLabCart.removeItem(btn.dataset.chkRemove);
      });
    });
  }

  function showError(msg) {
    const errBox = document.getElementById('checkoutErrorBox');
    if (!errBox) return;
    if (!msg) {
      errBox.style.display = 'none';
      errBox.textContent = '';
      return;
    }
    errBox.textContent = `⚠️ ${msg}`;
    errBox.style.display = 'block';
  }

  function showSimFeedback(msg, tone = 'green') {
    const banner = document.getElementById('simFeedbackBanner');
    if (!banner) return;
    const styles = {
      green: { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46' },
      amber: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
      red: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' }
    };
    const s = styles[tone] || styles.green;
    banner.style.display = 'block';
    banner.style.background = s.bg;
    banner.style.border = `1px solid ${s.border}`;
    banner.style.color = s.color;
    banner.innerHTML = msg;
  }

  function formatMakeDiagnostic(data) {
    if (!data) return '';
    if (data.make_dispatched) {
      return `<br/><strong>📡 Make.com Webhook:</strong> Dispatched live (<code>HTTP ${data.make_response_code || 200} ${data.make_response_text || 'Accepted'}</code>)`;
    }
    if (data.make_webhook_configured && !data.make_dispatched) {
      return `<br/><strong>⚠️ Make.com Webhook Response:</strong> <code>HTTP ${data.make_response_code || 'Error'} — ${data.make_response_text || data.error_message || 'Ensure your Make scenario is ON or listening in Redetermine Data Structure mode'}</code>`;
    }
    return '';
  }

  function updateSimulationPanel(data) {
    const panel = document.getElementById('simulationPanel');
    if (!panel) return;
    panel.style.display = 'block';

    const chkIdEl = document.getElementById('simCheckoutId');
    const cartIdEl = document.getElementById('simCartId');
    const evtIdEl = document.getElementById('simEventId');
    const recLinkEl = document.getElementById('simRecoveryLink');
    const inspector = document.getElementById('simPayloadInspector');

    if (chkIdEl && data.checkout_id) chkIdEl.textContent = data.checkout_id;
    if (cartIdEl && (data.cart_id || (data.checkout && data.checkout.cart_id))) {
      cartIdEl.textContent = data.cart_id || data.checkout.cart_id;
    }
    if (evtIdEl && data.event_id) evtIdEl.textContent = data.event_id;
    if (recLinkEl && (data.recovery_url || (data.checkout && data.checkout.recovery_url))) {
      const url = data.recovery_url || data.checkout.recovery_url;
      recLinkEl.href = url;
      recLinkEl.textContent = url;
    }

    if (inspector) {
      const displayPayload = data.event ? data.event.payload : data;
      inspector.textContent = JSON.stringify(displayPayload, null, 2);
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function applyCustomerFromRecovery(customerData) {
    if (!customerData) return;
    const nameInput = document.getElementById('chkName');
    const emailInput = document.getElementById('chkEmail');
    const phoneInput = document.getElementById('chkPhone');
    const stateSelect = document.getElementById('chkState');
    const addressInput = document.getElementById('chkAddress');
    const consentCheck = document.getElementById('chkMarketingConsent');

    if (nameInput && customerData.full_name) nameInput.value = customerData.full_name;
    if (emailInput && customerData.email) emailInput.value = customerData.email;
    if (phoneInput && customerData.phone) phoneInput.value = customerData.phone;
    if (stateSelect && customerData.delivery_state) stateSelect.value = customerData.delivery_state;
    if (addressInput && customerData.delivery_address) addressInput.value = customerData.delivery_address;
    if (consentCheck && typeof customerData.marketing_consent === 'boolean') {
      consentCheck.checked = customerData.marketing_consent;
    }

    const alertBanner = document.getElementById('recoveryAlertBanner');
    const alertText = document.getElementById('recoveryAlertText');
    if (alertBanner && alertText) {
      alertBanner.style.display = 'block';
      alertText.textContent = `Welcome back, ${customerData.full_name || customerData.email}! Your cart (${customerData.recovered_checkout_id || 'saved session'}) has been restored from Supabase. You can complete your simulated purchase below.`;
    }
  }

  function ensureDemoDefaultsReady() {
    if (!window.GlowLabCart) return;
    const params = new URLSearchParams(window.location.search);
    const isRecovering = params.has('recover_checkout') || params.has('recovery_token') || params.has('cart_id');

    // If cart is empty on initial visit to /checkout, auto-load the 3-product routine so 1-click checkout works immediately
    const summary = window.GlowLabCart.getSummary();
    if (!isRecovering && summary.items.length === 0) {
      window.GlowLabCart.addItem('cerave-foaming', 1);
      window.GlowLabCart.addItem('boj-relief-sun', 1);
      window.GlowLabCart.addItem('ordinary-niacinamide', 1);
      renderOrderSummary();
    }

    // Pre-fill default fictional customer if fields are blank
    const nameInput = document.getElementById('chkName');
    const emailInput = document.getElementById('chkEmail');
    const phoneInput = document.getElementById('chkPhone');
    const stateSelect = document.getElementById('chkState');
    const addressInput = document.getElementById('chkAddress');

    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = 'Adaeze Okafor';
    }
    if (emailInput && !emailInput.value.trim()) {
      emailInput.value = `adaeze.okafor.${Date.now().toString().slice(-4)}@glowlab-demo.ng`;
    }
    if (phoneInput && !phoneInput.value.trim()) {
      phoneInput.value = '+234 803 555 0192';
    }
    if (stateSelect && !stateSelect.value) {
      stateSelect.value = 'Lagos';
    }
    if (addressInput && !addressInput.value.trim()) {
      addressInput.value = '14B Admiralty Way, Lekki Phase 1, Lagos';
    }
  }

  function initPresets() {
    const presets = {
      ada: {
        name: 'Adaeze Okafor',
        email: `adaeze.okafor.${Date.now().toString().slice(-4)}@glowlab-demo.ng`,
        phone: '+234 803 555 0192',
        state: 'Lagos',
        address: '14B Admiralty Way, Lekki Phase 1, Lagos',
        consent: true
      },
      kemi: {
        name: 'Kemi Balogun',
        email: `kemi.balogun.${Date.now().toString().slice(-4)}@glowlab-demo.ng`,
        phone: '+234 809 444 0811',
        state: 'Abuja (FCT)',
        address: '9 Adetokunbo Ademola Crescent, Wuse II, Abuja',
        consent: true
      },
      noconsent: {
        name: 'Seyi Lawal',
        email: `seyi.noconsent.${Date.now().toString().slice(-4)}@glowlab-demo.ng`,
        phone: '+234 802 777 0345',
        state: 'Lagos',
        address: '25 Allen Avenue, Ikeja, Lagos',
        consent: false
      }
    };

    document.querySelectorAll('[data-preset-customer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.presetCustomer;
        const p = presets[key];
        if (!p) return;
        document.getElementById('chkName').value = p.name;
        document.getElementById('chkEmail').value = p.email;
        document.getElementById('chkPhone').value = p.phone;
        document.getElementById('chkState').value = p.state;
        document.getElementById('chkAddress').value = p.address;
        document.getElementById('chkMarketingConsent').checked = p.consent;
        showError('');
        showToast(`Filled fictional test profile: ${p.name}`, 2500);
      });
    });

    const sampleBtn = document.getElementById('loadSampleRoutineBtn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        window.GlowLabCart.addItem('cerave-foaming', 1);
        window.GlowLabCart.addItem('boj-relief-sun', 1);
        window.GlowLabCart.addItem('ordinary-niacinamide', 1);
        renderOrderSummary();
      });
    }
  }

  function initCheckoutForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');

      let summary = window.GlowLabCart.getSummary();
      if (!summary.raw_items || summary.raw_items.length === 0) {
        window.GlowLabCart.addItem('cerave-foaming', 1);
        window.GlowLabCart.addItem('boj-relief-sun', 1);
        window.GlowLabCart.addItem('ordinary-niacinamide', 1);
        renderOrderSummary();
        summary = window.GlowLabCart.getSummary();
      }

      const customer_name = document.getElementById('chkName').value.trim() || 'Adaeze Okafor';
      const customer_email = document.getElementById('chkEmail').value.trim() || `adaeze.okafor.${Date.now().toString().slice(-4)}@glowlab-demo.ng`;
      const customer_phone = document.getElementById('chkPhone').value.trim() || '+234 803 555 0192';
      const delivery_state = document.getElementById('chkState').value || 'Lagos';
      const delivery_address = document.getElementById('chkAddress').value.trim() || '14B Admiralty Way, Lekki Phase 1, Lagos';
      const marketing_consent = document.getElementById('chkMarketingConsent').checked;

      const btn = document.getElementById('startCheckoutBtn');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Validating Cart & Dispatching Event...';

      const idempotency_key = `chk_idem_${summary.cart_id}_${customer_email.toLowerCase()}_${summary.subtotal}_${Date.now().toString().slice(0, -3)}`;

      const requestPayload = {
        cart_id: summary.cart_id,
        customer_name,
        customer_email,
        customer_phone,
        delivery_state,
        delivery_address,
        marketing_consent,
        items: summary.raw_items,
        idempotency_key
      };

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload)
        });
        let data = await res.json();

        // If running inside the Arena Live Preview sandbox (which cannot reach hook.eu1.make.com directly),
        // also relay through the live Vercel production endpoint so Make.com receives the real webhook immediately.
        if (res.ok && isLocalOrSandboxPreview() && !data.make_dispatched) {
          try {
            const prodRes = await fetch(`${VERCEL_PROD_ORIGIN}/api/checkout`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestPayload)
            });
            if (prodRes.ok) {
              const prodData = await prodRes.json();
              data.make_webhook_configured = prodData.make_webhook_configured;
              data.make_dispatched = prodData.make_dispatched;
              data.make_response_code = prodData.make_response_code;
              data.make_response_text = prodData.make_response_text;
            }
          } catch {}
        }

        btn.disabled = false;
        btn.textContent = origText;

        if (!res.ok) {
          showError(data.error || 'Checkout validation failed.');
          showToast(data.error || 'Checkout validation failed', 4000);
          return;
        }

        activeCheckout = data;
        lastSubmittedPayload = requestPayload;
        updateSimulationPanel(data);

        const badge = document.getElementById('simCheckoutStatusBadge');
        if (badge) {
          badge.className = 'status-pill green';
          badge.textContent = data.duplicate_ignored ? 'Duplicate Ignored (Idempotent)' : 'Checkout Started Dispatched';
        }

        const consentNote = data.marketing_consent
          ? 'Marketing consent is <strong>ON</strong> — Klaviyo abandoned-cart reminders #1 &amp; #2 are scheduled unless a purchase occurs.'
          : 'Marketing consent is <strong>OFF</strong> — Klaviyo recovery emails are automatically skipped (transactional distinction enforced).';

        showSimFeedback(
          `<strong>✓ Checkout Started Event Triggered (${data.event_id})</strong><br/>Server-validated total: <strong>${formatNGN(data.trusted_subtotal)}</strong> • Checkout ID: <code>${data.checkout_id}</code>.<br/>${consentNote}${formatMakeDiagnostic(data)}`,
          data.make_webhook_configured && !data.make_dispatched ? 'amber' : 'green'
        );
        showToast('Checkout Started event sent to Supabase, Make & Klaviyo! 🎉', 4000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = origText;
        showError(`Network error: ${err.message}`);
      }
    });
  }

  function initSimulationControls() {
    const purchaseBtn = document.getElementById('simulatePurchaseBtn');
    const duplicateBtn = document.getElementById('simulateDuplicateBtn');
    const email1Btn = document.getElementById('simTriggerEmail1Btn');
    const email2Btn = document.getElementById('simTriggerEmail2Btn');

    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', async () => {
        if (!activeCheckout || !activeCheckout.checkout_id) {
          showToast('Start a demo checkout first!', 3000);
          return;
        }
        purchaseBtn.disabled = true;
        const orig = purchaseBtn.textContent;
        purchaseBtn.textContent = 'Simulating Order...';

        const purchasePayload = {
          checkout_id: activeCheckout.checkout_id,
          checkout_snapshot: activeCheckout.checkout
        };

        try {
          const res = await fetch('/api/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(purchasePayload)
          });
          let data = await res.json();

          if (res.ok && isLocalOrSandboxPreview() && !data.make_dispatched) {
            try {
              const prodRes = await fetch(`${VERCEL_PROD_ORIGIN}/api/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchasePayload)
              });
              if (prodRes.ok) {
                const prodData = await prodRes.json();
                data.make_webhook_configured = prodData.make_webhook_configured;
                data.make_dispatched = prodData.make_dispatched;
                data.make_response_code = prodData.make_response_code;
                data.make_response_text = prodData.make_response_text;
              }
            } catch {}
          }

          purchaseBtn.disabled = false;
          purchaseBtn.textContent = orig;

          if (!res.ok) {
            showSimFeedback(`<strong>⚠️ Error:</strong> ${data.error}`, 'red');
            return;
          }

          activeCheckout.checkout = data.checkout || activeCheckout.checkout;
          updateSimulationPanel(data);
          const badge = document.getElementById('simCheckoutStatusBadge');
          if (badge) {
            badge.className = 'status-pill sage';
            badge.textContent = `Simulated Order: ${data.order_number}`;
          }

          const dupMsg = data.duplicate_ignored
            ? ' <em>(Idempotency check prevented duplicate order creation)</em>'
            : '';

          showSimFeedback(
            `<strong>🎉 Simulated Purchase Completed! Order: <code>${data.order_number}</code></strong>${dupMsg}<br/>` +
            `• Supabase <code>orders</code> record created (status: <code>simulated</code>)<br/>` +
            `• Checkout <code>${data.checkout_id}</code> marked as <code>converted</code> &amp; Cart marked as <code>purchased</code><br/>` +
            `• <code>Placed Order</code> event (<code>${data.event_id}</code>) sent to Make &amp; Klaviyo — pending recovery emails are now <strong>suppressed</strong> (${data.recovery_outcome}).${formatMakeDiagnostic(data)}`,
            data.make_webhook_configured && !data.make_dispatched ? 'amber' : 'green'
          );

          // Rotate local cart so a fresh session can start if needed
          window.GlowLabCart.clearCart(true);
          renderOrderSummary();
          showToast(`Simulated Order ${data.order_number} placed! Recovery emails suppressed.`, 4500);
        } catch (err) {
          purchaseBtn.disabled = false;
          purchaseBtn.textContent = orig;
          showSimFeedback(`Network error: ${err.message}`, 'red');
        }
      });
    }

    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', async () => {
        if (!lastSubmittedPayload) {
          showToast('Submit a checkout first to test duplicate protection.', 3000);
          return;
        }
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lastSubmittedPayload)
        });
        const data = await res.json();
        updateSimulationPanel(data);
        showSimFeedback(
          `<strong>🛡️ Idempotency Guard Verified!</strong><br/>` +
          `Submitted identical <code>idempotency_key</code> (<code>${data.idempotency_key}</code>). Server returned <code>duplicate_ignored: ${data.duplicate_ignored}</code> and original Event ID <code>${data.event_id}</code> without creating a duplicate checkout or firing a second Make/Klaviyo webhook.`,
          'amber'
        );
        showToast('Duplicate event blocked by idempotency check! 🛡️', 3500);
      });
    }

    async function triggerRecoveryStep(stepNum) {
      if (!activeCheckout || !activeCheckout.checkout_id) return;
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advance_recovery',
          checkout_id: activeCheckout.checkout_id,
          checkout_snapshot: activeCheckout.checkout,
          step: stepNum
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showSimFeedback(`<strong>⚠️ Error:</strong> ${data.error}`, 'red');
        return;
      }
      activeCheckout.checkout = data.checkout || activeCheckout.checkout;
      const tone = data.action.includes('suppressed') || data.action.includes('skipped') ? 'amber' : 'green';
      showSimFeedback(
        `<strong>⏱️ Klaviyo Flow Check (Step ${stepNum}):</strong> ${data.message}<br/>` +
        `First Reminder: <code>${data.checkout.first_reminder_status}</code> • Second Reminder: <code>${data.checkout.second_reminder_status}</code> • Outcome: <code>${data.checkout.recovery_outcome}</code>`,
        tone
      );
      showToast(data.message, 3500);
    }

    if (email1Btn) email1Btn.addEventListener('click', () => triggerRecoveryStep(1));
    if (email2Btn) email2Btn.addEventListener('click', () => triggerRecoveryStep(2));
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureDemoDefaultsReady();
    renderOrderSummary();
    initPresets();
    initCheckoutForm();
    initSimulationControls();

    // Listen for cart updates or recovery events
    window.addEventListener('glowlab:cart-updated', renderOrderSummary);
    window.addEventListener('glowlab:cart-recovered', (e) => {
      renderOrderSummary();
      if (e.detail && e.detail.customer) {
        applyCustomerFromRecovery({
          ...e.detail.customer,
          recovered_checkout_id: e.detail.checkout_id,
          recovery_token: e.detail.recovery_token
        });
      }
    });

    // Check if sessionStorage already holds recovered customer data
    try {
      const savedCustomer = sessionStorage.getItem('glowlab_recovered_customer');
      if (savedCustomer) {
        applyCustomerFromRecovery(JSON.parse(savedCustomer));
      }
    } catch {}
  });
})();
