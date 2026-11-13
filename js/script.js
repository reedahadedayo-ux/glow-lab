/* GlowLab customer storefront. All prices/orders/tools are validated by the backend. */
"use strict";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
const storage = {
  get(key, fallback, session = false) {
    try {
      return (
        JSON.parse((session ? sessionStorage : localStorage).getItem(key)) ??
        fallback
      );
    } catch {
      return fallback;
    }
  },
  set(key, value, session = false) {
    try {
      (session ? sessionStorage : localStorage).setItem(
        key,
        JSON.stringify(value),
      );
    } catch {
      toast(
        "Browser storage is unavailable. Your changes may not survive a refresh.",
      );
    }
  },
  remove(key, session = false) {
    try {
      (session ? sessionStorage : localStorage).removeItem(key);
    } catch {}
  },
};
let products = [],
  category = new URLSearchParams(location.search).get("category") || "All",
  currentModal,
  modalTrigger;
let cart = storage.get("glowlab.cart.v1", []);
cart = Array.isArray(cart)
  ? cart.filter(
      (i) =>
        i &&
        typeof i.productId === "string" &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 20,
    )
  : [];
cart = cart
  .filter((i, n) => cart.findIndex((x) => x.productId === i.productId) === n)
  .slice(0, 30);
let config = {};
async function api(path, body) {
  let response;
  try {
    response = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Connection interrupted. Please retry. We have not confirmed that your request succeeded.",
    );
  }
  const result = await response.json().catch(() => ({
    error: "The server returned an unexpected response. Please try again.",
  }));
  if (!response.ok)
    throw new Error(result.error || "This request could not be completed.");
  return result;
}
function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove("show"), 4000);
}
function saveCart() {
  storage.set("glowlab.cart.v1", cart);
  updateCount();
}
function updateCount() {
  $$("[data-cart-count]").forEach(
    (el) => (el.textContent = cart.reduce((s, i) => s + i.quantity, 0)),
  );
}
function addToCart(ids) {
  let added = 0;
  for (const id of ids) {
    const p = products.find((p) => p.id === id);
    if (!p?.available) continue;
    const item = cart.find((i) => i.productId === id);
    const max = Math.min(20, p.stock ?? 20);
    if (item && item.quantity < max) {
      item.quantity++;
      added++;
    } else if (!item && max > 0 && cart.length < 30) {
      cart.push({ productId: id, quantity: 1 });
      added++;
    }
  }
  saveCart();
  renderCart();
  toast(
    added
      ? `${added} ${added === 1 ? "item" : "items"} added to your cart.`
      : "No items added. Check availability or quantity limits.",
  );
}
function card(p) {
  return `<article class="product-card" data-id="${escapeHTML(p.id)}"><div class="product-img"><span class="badge">${escapeHTML(p.category)}</span><a href="products.html?product=${encodeURIComponent(p.id)}" data-view="${escapeHTML(p.id)}"><img src="images/${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy"></a></div><div class="product-body"><div class="product-brand">${escapeHTML(p.brand)}</div><h3 class="product-name"><a href="products.html?product=${encodeURIComponent(p.id)}" data-view="${escapeHTML(p.id)}">${escapeHTML(p.name)}</a></h3><p class="product-desc">${escapeHTML(window.GlowLabCopy.productDescription(p))}</p><div class="product-foot"><div class="price">${money(p.price)}</div><span class="small">${p.available ? "Available to add" : "Currently unavailable"}</span><div class="product-actions"><button class="btn btn-secondary" data-view="${escapeHTML(p.id)}">Details</button><button class="btn btn-primary" data-add="${escapeHTML(p.id)}" ${!p.available ? "disabled" : ""}>Add to cart</button></div></div></div></article>`;
}
function renderProducts() {
  const search = $("#productSearch")?.value.toLowerCase().trim() || "";
  const filtered = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      `${p.name} ${p.brand} ${p.skin_type} ${p.category}`
        .toLowerCase()
        .includes(search),
  );
  const grid = $("#allProductsGrid") || $("#featuredGrid");
  if (grid)
    grid.innerHTML = filtered.length
      ? filtered
          .slice(0, $("#allProductsGrid") ? 100 : 8)
          .map(card)
          .join("")
      : '<p class="empty-state">No products match. Try a different name or category.</p>';
  if ($("#productCount"))
    $("#productCount").textContent =
      `${filtered.length} products · Prices in NGN`;
  $$("[data-filter]").forEach((b) =>
    b.classList.toggle("active", b.dataset.filter === category),
  );
}
function openModal(p, trigger) {
  const backdrop = $("#productModal");
  if (!backdrop) return;
  currentModal = p;
  modalTrigger = trigger || document.activeElement;
  $("#modalImg").src = "images/" + p.image;
  $("#modalImg").alt = p.name;
  $("#modalBrand").textContent = p.brand;
  $("#modalName").textContent = p.name;
  $("#modalPrice").textContent = money(p.price);
  $("#modalDesc").textContent = window.GlowLabCopy.productDescription(p);
  $("#modalCategory").textContent = p.category;
  $("#modalSize").textContent = p.size || p.volume || "Not listed";
  $("#modalAvailability").textContent = p.available
    ? "Available to add to your cart"
    : "Currently unavailable";
  $("#modalVerified").textContent = p.details_verified
    ? "Check the packaging for the latest ingredients and directions before use."
    : "We haven’t verified the full ingredients or directions for this product. Please check the manufacturer’s packaging before use.";
  $("#modalHowTo").textContent =
    (p.details_verified && p.usage) ||
    "Directions aren’t listed. Follow the manufacturer’s packaging.";
  $("#modalIngredients").textContent =
    (p.details_verified && (p.ingredients || []).join(" · ")) ||
    "Ingredients aren’t listed. Check the packaging for the full ingredient list.";
  $("#modalAdd").disabled = !p.available;
  backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
  $(".modal", backdrop).focus();
}
function closeModal() {
  const el = $("#productModal");
  if (!el) return;
  el.classList.remove("open");
  document.body.style.overflow = "";
  modalTrigger?.focus();
}
function cartLines() {
  return cart.map((i) => ({
    ...i,
    product: products.find((p) => p.id === i.productId),
  }));
}
function total() {
  return cartLines().reduce(
    (s, i) => s + (i.product?.price || 0) * i.quantity,
    0,
  );
}
function summaryHTML() {
  return `<h2>Order summary</h2>${cartLines()
    .map(
      (i) =>
        `<div class="summary-row"><span>${escapeHTML(i.product?.name || "Unavailable product")} × ${i.quantity}</span><strong>${money((i.product?.price || 0) * i.quantity)}</strong></div>`,
    )
    .join(
      "",
    )}<div class="summary-row"><span>Delivery (not dispatched)</span><span>${money(0)}</span></div><div class="summary-row total"><span>Total</span><span>${money(total())}</span></div><p class="small">Payment is simulated; no money is charged and no products are dispatched. Prices and availability are checked when you place your order.</p>`;
}
function renderCart() {
  const el = $("#cartContent");
  if (!el) return;
  if (!cart.length) {
    el.innerHTML =
      '<div class="empty-state"><h2>A fresh start.</h2><p>Your cart is empty. Find a few everyday essentials, or let Lumi help you choose.</p><a href="products.html" class="btn btn-primary">Explore the collection →</a><button class="text-link" data-chat-lumi>Build a routine with Lumi</button></div>';
    return;
  }
  el.innerHTML = `<div class="cart-layout"><div>${cartLines()
    .map(
      (i) =>
        `<article class="cart-item">${i.product ? `<img src="images/${escapeHTML(i.product.image)}" alt="${escapeHTML(i.product.name)}">` : "<span>—</span>"}<div><h2>${escapeHTML(i.product?.name || "Product no longer listed")}</h2><p class="small">${i.product?.available ? money(i.product.price) + " each" : "Unavailable — remove to continue"}</p><div class="quantity"><button data-quantity="${escapeHTML(i.productId)}" data-delta="-1" aria-label="Decrease ${escapeHTML(i.product?.name || "product")} quantity">−</button><span aria-label="Quantity">${i.quantity}</span><button data-quantity="${escapeHTML(i.productId)}" data-delta="1" aria-label="Increase ${escapeHTML(i.product?.name || "product")} quantity" ${i.quantity >= Math.min(20, i.product?.stock ?? 20) ? "disabled" : ""}>+</button></div><button class="remove-item" data-remove="${escapeHTML(i.productId)}">Remove</button></div><strong>${money((i.product?.price || 0) * i.quantity)}</strong></article>`,
    )
    .join(
      "",
    )}<a href="products.html" class="text-link">← Continue shopping</a></div><aside class="summary-card">${summaryHTML()}${cartLines().every((i) => i.product?.available) ? '<a class="btn btn-primary" href="checkout.html">Proceed to checkout →</a>' : '<p class="error">Remove unavailable products before checkout.</p>'}</aside></div>`;
}
function initCheckout() {
  const form = $("#checkoutForm");
  if (!form) return;
  form.dataset.ready = "true";
  $("#placeOrder").disabled = false;
  if (!cart.length) {
    $(".checkout-grid").innerHTML =
      '<div class="empty-state"><h2>Your cart is empty</h2><p>Add a product before checkout.</p><a class="btn btn-primary" href="products.html">Browse products</a></div>';
    return;
  }
  $("#checkoutSummary").innerHTML = summaryHTML();
  const saved = storage.get("glowlab.delivery", {}, true);
  for (const [key, value] of Object.entries(saved))
    if (form.elements[key]) form.elements[key].value = value;
  const customer = () =>
    Object.fromEntries(
      ["name", "email", "phone", "address", "city", "instructions"].map((k) => [
        k,
        form.elements[k].value.trim(),
      ]),
    );
  form.addEventListener("input", () =>
    storage.set("glowlab.delivery", customer(), true),
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = $("#placeOrder");
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Placing your order…";
    $("#checkoutError").textContent = "";
    const draft = { customer: customer(), items: cart.map((i) => ({ ...i })) };
    const fingerprint = JSON.stringify(draft);
    let attempt = storage.get("glowlab.attempt", null, true);
    if (!attempt || attempt.fingerprint !== fingerprint) {
      attempt = { fingerprint, key: crypto.randomUUID() };
      storage.set("glowlab.attempt", attempt, true);
    }
    try {
      const { order } = await api("checkout", {
        ...draft,
        idempotencyKey: attempt.key,
      });
      storage.set(
        "glowlab.receipt",
        { reference: order.reference, email: order.customer.email },
        true,
      );
      cart = [];
      saveCart();
      storage.remove("glowlab.delivery", true);
      location.href = "confirmation.html";
    } catch (error) {
      $("#checkoutError").textContent = error.message;
      button.disabled = false;
      button.textContent = "Try placing order again →";
    }
  });
}
async function loadConfirmation() {
  const el = $("#confirmationContent");
  if (!el) return;
  const receipt = storage.get("glowlab.receipt", null, true);
  if (!receipt) {
    el.innerHTML =
      '<h1>Find your order.</h1><p>Order details stay private. Use the browser that placed the order and your checkout email.</p><form id="recoverOrder" class="form"><label>Order reference<input class="input" name="reference" required maxlength="80"></label><label>Checkout email<input class="input" type="email" name="email" required></label><button class="btn btn-primary">Look up order</button><p class="error" role="alert"></p></form>';
    $("#recoverOrder").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const input = {
          reference: f.elements.reference.value,
          email: f.elements.email.value,
        };
        await api("orders/lookup", input);
        storage.set("glowlab.receipt", input, true);
        loadConfirmation();
      } catch (error) {
        $(".error", f).textContent = error.message;
      }
    });
    return;
  }
  try {
    const { order: o } = await api("orders/lookup", receipt);
    el.innerHTML = `<span class="eyebrow">Order received</span><h1>We’ve received <em>your order.</em></h1><p>Keep your reference below. Payment was simulated: no money was charged and no products will be dispatched.</p><div class="order-reference">${escapeHTML(o.reference)}</div><p class="small">Save this reference. Order lookup requires this browser and your checkout email.</p><div class="summary-card journey-content"><h2>Order confirmation</h2><div class="summary-row"><span>Order status</span><strong>${escapeHTML(window.GlowLabCopy.status(o.order_status))}</strong></div><div class="summary-row"><span>Fulfillment</span><strong>${escapeHTML(window.GlowLabCopy.status(o.fulfillment_status))}</strong></div><div class="summary-row"><span>Payment</span><strong>${escapeHTML(window.GlowLabCopy.payment(o))}</strong></div>${o.items.map((i) => `<div class="summary-row"><span>${escapeHTML(i.product_name)} × ${i.quantity}</span><strong>${money(i.line_total)}</strong></div>`).join("")}<div class="summary-row"><span>Subtotal</span><strong>${money(o.subtotal ?? o.total)}</strong></div><div class="summary-row"><span>Delivery</span><strong>${money(o.shipping_fee ?? o.delivery_fee ?? 0)}</strong></div><div class="summary-row total"><span>Total</span><span>${money(o.total)}</span></div><p class="small">Created ${escapeHTML(new Date(o.created_at).toLocaleString())}. No payment receipt is issued for a simulated payment.</p></div><div style="margin-top:25px;display:flex;gap:16px;flex-wrap:wrap"><button class="btn btn-primary" data-chat-lumi>Ask Lumi about this order</button><a href="products.html" class="btn btn-secondary">Continue exploring</a><a href="contact.html" class="text-link">Report a problem</a></div>`;
  } catch (error) {
    el.innerHTML = `<h1>We couldn’t retrieve your order.</h1><p class="error">${escapeHTML(error.message)}</p><button id="retryConfirmation" class="btn btn-primary">Retry lookup</button>`;
    $("#retryConfirmation").onclick = loadConfirmation;
  }
}
function initContact() {
  const form = $("#contactForm");
  if (!form) return;
  form.dataset.ready = "true";
  $("button[type=submit]", form).disabled = false;
  let key = crypto.randomUUID();
  form.addEventListener("input", () => (key = crypto.randomUUID()));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", form);
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "Saving ticket…";
    const status = $("#contactStatus");
    status.textContent = "";
    try {
      const { ticket } = await api("support", {
        name: $("#name").value,
        email: $("#email").value,
        issue: $("#message").value,
        priority: "normal",
        orderReference: $("#orderReference")?.value.trim() || "",
        idempotencyKey: key,
      });
      status.textContent = `Request received. Your reference is ${ticket.id}. Status: ${window.GlowLabCopy.status(ticket.status)}. No email confirmation is sent.`;
      form.reset();
      key = crypto.randomUUID();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit support ticket →";
    }
  });
}
function initLumi() {
  const launcher = document.createElement("button");
  launcher.className = "lumi-launcher";
  launcher.dataset.chatLumi = "";
  launcher.setAttribute("aria-controls", "lumiPanel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = "<span>✧</span> Ask Lumi";
  document.body.append(launcher);
  const panel = document.createElement("section");
  panel.id = "lumiPanel";
  panel.className = "lumi-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Lumi skincare shopping assistant");
  panel.innerHTML =
    '<header class="lumi-header"><span class="lumi-avatar">✧</span><div><h2>Lumi</h2><p>Your skincare shopping companion</p></div><button id="closeLumi" aria-label="Close Lumi">×</button></header><div class="lumi-history" id="lumiHistory" role="log" aria-live="polite" aria-relevant="additions"></div><form class="lumi-form" id="lumiForm"><label class="small" for="lumiInput">How can I help?</label><div class="lumi-input-row"><textarea class="input" id="lumiInput" placeholder="A simple routine for oily skin…" rows="2" maxlength="2000" required></textarea><button class="btn btn-primary" aria-label="Send message">↑</button></div><p class="lumi-disclaimer">AI shopping guidance, not medical advice. Messages are sent to Google Gemini. Please don’t share sensitive information.</p><button type="button" class="lumi-reset" id="resetLumi">Start a new conversation</button></form>';
  document.body.append(panel);
  if (!config.gemini)
    $(".lumi-header p", panel).textContent =
      "Lumi is currently unavailable. Browse Products or use Contact.";
  const history = $("#lumiHistory");
  let transcript = storage.get("glowlab.chat", [], true);
  let historyToken = storage.get("glowlab.historyToken", "", true);
  let busy = false,
    chatTrigger;
  if (!Array.isArray(transcript)) transcript = [];
  const persist = () => {
    storage.set("glowlab.chat", transcript.slice(-30), true);
    storage.set("glowlab.historyToken", historyToken, true);
  };
  const append = (role, text) => {
    const el = document.createElement("div");
    el.className = "lumi-message " + role;
    el.textContent = text;
    history.append(el);
    history.scrollTop = history.scrollHeight;
    return el;
  };
  function intro() {
    append(
      "assistant",
      "Hi, I’m Lumi, your AI shopping companion. I can help you explore products, think through a simple routine or check an order. What are you looking for today?",
    );
    const hints = document.createElement("div");
    hints.className = "lumi-suggestions";
    for (const text of [
      "Help me build a routine",
      "Find a cleanser",
      "Check my order",
    ]) {
      const b = document.createElement("button");
      b.textContent = text;
      b.onclick = () => {
        $("#lumiInput").value = text;
        $("#lumiInput").focus();
      };
      hints.append(b);
    }
    history.append(hints);
  }
  for (const message of transcript) {
    append(message.role, message.text);
    if (message.result) renderResult(message.result);
  }
  if (!transcript.length) intro();
  function renderResult(result) {
    const ps = (result.products || []).filter((p) =>
      products.some((x) => x.id === p.id),
    );
    if (ps.length) {
      const box = document.createElement("div");
      box.className = "lumi-products";
      const offered = ps.map((p) => products.find((x) => x.id === p.id));
      box.innerHTML = offered
        .map(
          (p) =>
            `<div class="lumi-product"><img src="images/${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}"><div><h4><a href="products.html?product=${encodeURIComponent(p.id)}">${escapeHTML(p.name)}</a></h4><p>${money(p.price)} · ${p.available ? "Available to add" : "Currently unavailable"}</p><label><input type="checkbox" value="${escapeHTML(p.id)}" ${!p.available ? "disabled" : ""}> Select for your cart</label></div></div>`,
        )
        .join("");
      if (result.routine) {
        const steps = document.createElement("div");
        steps.className = "routine-steps";
        const names = (ids) =>
          ids
            .map((id) => products.find((p) => p.id === id)?.name)
            .filter(Boolean)
            .join(" → ");
        steps.textContent = `Morning: ${names(result.routine.morning)}\nEvening: ${names(result.routine.evening)}\nRoutine total: ${money(result.routine.total)}${result.routine.incomplete ? " · Budget or availability did not cover a full routine." : ""}\n${result.routine.note}`;
        steps.style.whiteSpace = "pre-line";
        box.append(steps);
        for (const p of ps.filter((p) => p.reason)) {
          const reason = document.createElement("p");
          reason.className = "small";
          reason.textContent = p.name + ": " + p.reason;
          box.append(reason);
        }
      }
      const button = document.createElement("button");
      button.className = "btn btn-primary";
      button.textContent = "Add selected to cart";
      button.onclick = () => {
        const ids = $$("input:checked", box).map((el) => el.value);
        if (!ids.length) {
          toast("Select the products you want first.");
          return;
        }
        addToCart(ids);
        $$("input:checked", box).forEach((el) => (el.checked = false));
      };
      box.append(button);
      history.append(box);
    }
    if (result.ticket) {
      const box = document.createElement("div");
      box.className = "support-draft";
      const draft = result.ticket.draft;
      const text = document.createElement("p");
      text.textContent = `Review support ticket (not yet saved)\n${draft.name} · ${draft.email}\n${draft.issue}${draft.orderReference ? "\nOrder: " + draft.orderReference : ""}`;
      text.style.whiteSpace = "pre-wrap";
      box.append(text);
      const b = document.createElement("button");
      b.className = "btn btn-primary";
      b.textContent = "Submit ticket";
      b.onclick = async () => {
        b.disabled = true;
        try {
          const { ticket, historyToken: updatedHistory } = await api(
            "support/confirm",
            { token: result.ticket.token, historyToken },
          );
          if (updatedHistory) historyToken = updatedHistory;
          const message = `Support ticket ${ticket.id} saved. Status: ${ticket.status}. No email was sent.`;
          append("assistant", message);
          transcript.push({ role: "assistant", text: message });
          persist();
          b.textContent = "Ticket saved";
        } catch (error) {
          append("error", error.message);
          b.disabled = false;
        }
      };
      box.append(b);
      history.append(box);
    }
    history.scrollTop = history.scrollHeight;
  }
  function close() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    chatTrigger?.focus();
  }
  window.openLumi = (trigger) => {
    chatTrigger = trigger || document.activeElement;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    const menu = $("#mobileMenu");
    menu?.classList.remove("open");
    $("#mobileToggle")?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    $("#lumiInput").focus();
    history.scrollTop = history.scrollHeight;
  };
  $("#closeLumi").onclick = close;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });
  $("#resetLumi").onclick = () => {
    if (busy) return;
    historyToken = "";
    transcript = [];
    persist();
    history.replaceChildren();
    intro();
  };
  $("#lumiInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#lumiForm").requestSubmit();
    }
  });
  $("#lumiForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const input = $("#lumiInput");
    const message = input.value.trim();
    if (!message) return;
    busy = true;
    const send =
      $("button[type=submit]", panel) || $(".lumi-input-row button", panel);
    send.disabled = true;
    $("#resetLumi").disabled = true;
    append("user", message);
    transcript.push({ role: "user", text: message });
    input.value = "";
    persist();
    const loading = append("assistant", "Lumi is thinking…");
    loading.setAttribute("role", "status");
    try {
      const result = await api("lumi", {
        message,
        ...(historyToken ? { historyToken } : {}),
      });
      historyToken = result.historyToken;
      loading.remove();
      append("assistant", result.text);
      renderResult(result);
      transcript.push({
        role: "assistant",
        text: result.text,
        result: {
          products: result.products,
          routine: result.routine,
          ticket: result.ticket,
        },
      });
      persist();
    } catch (error) {
      loading.remove();
      append("error", error.message);
      input.value = message;
    } finally {
      busy = false;
      send.disabled = false;
      $("#resetLumi").disabled = false;
      input.focus();
    }
  });
}
function events() {
  document.addEventListener("click", (e) => {
    const chat = e.target.closest("[data-chat-lumi]");
    if (chat) {
      e.preventDefault();
      if ($("#productModal")?.classList.contains("open")) closeModal();
      window.openLumi?.(chat);
      return;
    }
    const add = e.target.closest("[data-add]");
    if (add) {
      addToCart([add.dataset.add]);
      return;
    }
    const view = e.target.closest("[data-view]");
    if (view) {
      e.preventDefault();
      const p = products.find((p) => p.id === view.dataset.view);
      if (p) openModal(p, view);
      return;
    }
    if (
      e.target.closest("[data-close-modal]") ||
      e.target.id === "productModal"
    ) {
      closeModal();
      return;
    }
    const quantity = e.target.closest("[data-quantity]");
    if (quantity) {
      const i = cart.find((i) => i.productId === quantity.dataset.quantity);
      if (i) {
        const p = products.find((p) => p.id === i.productId);
        i.quantity = Math.min(
          Math.min(20, p?.stock ?? 20),
          i.quantity + Number(quantity.dataset.delta),
        );
        if (i.quantity < 1) cart = cart.filter((x) => x !== i);
        saveCart();
        renderCart();
      }
      return;
    }
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      cart = cart.filter((i) => i.productId !== remove.dataset.remove);
      saveCart();
      renderCart();
    }
  });
  $("#modalAdd")?.addEventListener(
    "click",
    () => currentModal && addToCart([currentModal.id]),
  );
  $("#mobileToggle")?.addEventListener("click", () => {
    const open = $("#mobileMenu").classList.toggle("open");
    $("#mobileToggle").setAttribute("aria-expanded", String(open));
    $("#mobileToggle").textContent = open ? "×" : "☰";
  });
  $$("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.filter;
        renderProducts();
      }),
  );
  $("#productSearch")?.addEventListener("input", renderProducts);
  $$(".faq-q").forEach((b) => {
    b.setAttribute(
      "aria-expanded",
      String(b.closest(".faq-item").classList.contains("open")),
    );
    b.onclick = () => {
      const item = b.closest(".faq-item");
      item.classList.toggle("open");
      b.setAttribute("aria-expanded", String(item.classList.contains("open")));
    };
  });
  $$(".faq-cats button").forEach(
    (b) =>
      (b.onclick = () => {
        $$(".faq-cats button").forEach((x) =>
          x.classList.toggle("active", x === b),
        );
        $$(".faq-item").forEach(
          (i) =>
            (i.hidden =
              b.dataset.faqCat !== "All" &&
              b.dataset.faqCat !== i.dataset.category),
        );
      }),
  );
  document.addEventListener("keydown", (e) => {
    const modal = $("#productModal");
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab" && modal?.classList.contains("open")) {
      const focusable = $$(
        'button:not([disabled]),a[href],[tabindex="0"]',
        modal,
      );
      const first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "glowlab.cart.v1") {
      const saved = storage.get("glowlab.cart.v1", []);
      if (Array.isArray(saved)) {
        cart = saved.filter(
          (i) =>
            i &&
            typeof i.productId === "string" &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0 &&
            i.quantity <= 20,
        );
        updateCount();
        renderCart();
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  events();
  for (const form of $$("#checkoutForm,#contactForm"))
    form.addEventListener("submit", (e) => {
      if (form.dataset.ready !== "true") {
        e.preventDefault();
        toast(
          "The store is not connected yet. Please wait or refresh to retry.",
        );
      }
    });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-retry-store]")) location.reload();
  });
  updateCount();
  $("#year") && ($("#year").textContent = new Date().getFullYear());
  const path = location.pathname.replace(".html", "");
  $$(".nav-links a").forEach((a) =>
    a.classList.toggle(
      "active",
      a.pathname.replace(".html", "") === path ||
        (path === "/" && a.pathname === "/index.html"),
    ),
  );
  try {
    config = await api("config");
    initContact();
    await loadConfirmation();
    if ($("#policyContent")) {
      try {
        const { policies } = await api("policies");
        $("#policyContent").innerHTML = policies
          .map(window.GlowLabCopy.policy)
          .map(
            (p) =>
              `<section class="policy" id="${escapeHTML(p.slug)}"><h2>${escapeHTML(p.title)}</h2><p>${escapeHTML(p.content)}</p></section>`,
          )
          .join("");
      } catch (error) {
        $("#policyContent").innerHTML =
          `<p class="error" role="alert">${escapeHTML(error.message)}</p><button class="btn btn-secondary" data-retry-store>Try again</button>`;
      }
    }
    const result = await api("products");
    products = result.products;
    initLumi();
    renderProducts();
    renderCart();
    initCheckout();
    const id = new URLSearchParams(location.search).get("product");
    if (id) {
      const p = products.find((p) => p.id === id);
      if (p) openModal(p);
      else toast("That product is not listed.");
    }
  } catch (error) {
    for (const el of $$("#allProductsGrid,#featuredGrid,#cartContent"))
      el.innerHTML = `<div class="connection-state" role="alert"><h2>Let’s try that again.</h2><p class="error">${escapeHTML(error.message)}</p><button class="btn btn-secondary" data-retry-store>Try again</button></div>`;
    if ($("#checkoutError")) $("#checkoutError").textContent = error.message;
    if (!window.openLumi) initLumi();
    if ($("#contactForm") && !$("#contactForm").dataset.ready) initContact();
    if ($("#confirmationContent") && !$("#confirmationContent").children.length)
      await loadConfirmation();
    toast(error.message);
  }
});
