/* GlowLab Skincare - Vanilla JS (Storefront + Persistent Cart + Checkout Automation) */

const PRODUCTS = [
  {
    id: 'cerave-foaming',
    name: 'CeraVe Foaming Facial Cleanser',
    brand: 'CeraVe',
    price: 14500,
    comparePrice: 16800,
    image: 'cerave-foaming-cleanser.jpg',
    category: 'Cleansers',
    skinType: 'Oily, Combination',
    concern: 'Excess Oil, Acne',
    desc: 'Gentle foaming cleanser with 3 essential ceramides to cleanse without disrupting the skin barrier.',
    longDesc: 'A deep-cleansing yet non-stripping foaming cleanser developed with dermatologists. Removes excess oil, dirt and makeup while maintaining the skin’s natural barrier with ceramides and niacinamide. Ideal for oily to normal skin, morning and night.',
    ingredients: ['Ceramides NP, AP, EOP', 'Niacinamide', 'Hyaluronic Acid'],
    howTo: 'Wet skin, lather, massage gently, rinse.'
  },
  {
    id: 'cetaphil-gentle',
    name: 'Cetaphil Gentle Skin Cleanser',
    brand: 'Cetaphil',
    price: 13200,
    comparePrice: null,
    image: 'cetaphil-cleanser.jpg',
    category: 'Cleansers',
    skinType: 'Sensitive, Dry',
    concern: 'Sensitivity, Dryness',
    desc: 'Mild, non-irritating cleanser that soothes skin while removing dirt and impurities.',
    longDesc: 'The cult-favorite gentle cleanser for sensitive skin. Soap-free, fragrance-free, and clinically proven to clean without irritation. Can be used with or without water, making it perfect for reactive and dry skin types.',
    ingredients: ['Pro-Vitamin B5', 'Niacinamide', 'Glycerin'],
    howTo: 'Apply to skin, massage, rinse or wipe off.'
  },
  {
    id: 'cerave-cream',
    name: 'CeraVe Moisturizing Cream',
    brand: 'CeraVe',
    price: 17800,
    comparePrice: 19500,
    image: 'cerave-moisturizing-cream.jpg',
    category: 'Moisturizers',
    skinType: 'Dry, Sensitive',
    concern: 'Barrier Repair, Dryness',
    desc: 'Rich, non-greasy cream with MVE Technology for 24-hour hydration and barrier repair.',
    longDesc: 'A dermatologist-favorite for intensely dry skin. This rich cream restores and maintains the skin barrier with 3 essential ceramides and hyaluronic acid. Non-comedogenic, fragrance-free, and releases hydration throughout the day.',
    ingredients: ['3 Essential Ceramides', 'Hyaluronic Acid', 'Petrolatum'],
    howTo: 'Apply liberally morning and evening to face and body.'
  },
  {
    id: 'neutrogena-hydro',
    name: 'Neutrogena Hydro Boost Water Gel',
    brand: 'Neutrogena',
    price: 12500,
    comparePrice: null,
    image: 'neutrogena-hydro-boost.jpg',
    category: 'Moisturizers',
    skinType: 'Oily, Combination',
    concern: 'Dehydration, Dullness',
    desc: 'Lightweight water gel that quenches dry skin and keeps it hydrated all day.',
    longDesc: 'Oil-free, non-comedogenic water gel that instantly quenches with hyaluronic acid. Feels like water, acts like a long-lasting moisturizer. Perfect under makeup and SPF in Lagos humidity.',
    ingredients: ['Hyaluronic Acid', 'Glycerin', 'Olive Extract'],
    howTo: 'Use morning and night on clean skin.'
  },
  {
    id: 'boj-relief-sun',
    name: 'Beauty of Joseon Relief Sun SPF50+',
    brand: 'Beauty of Joseon',
    price: 15200,
    comparePrice: 17500,
    image: 'beauty-of-joseon-relief-sun.jpg',
    category: 'Sunscreens',
    skinType: 'All Skin Types',
    concern: 'Sun Protection, Soothing',
    desc: 'Lightweight, dewy chemical sunscreen with rice + probiotics. No white cast.',
    longDesc: 'Viral K-beauty sunscreen that hydrates like a serum while providing PA++++ protection. Rice extract and grain probiotics soothe and brighten. Zero white cast on deep skin tones – a GlowLab bestseller.',
    ingredients: ['Rice Extract', 'Niacinamide', 'Probiotics'],
    howTo: 'Apply 15 mins before sun. Reapply every 2 hours.'
  },
  {
    id: 'lrp-anthelios',
    name: 'La Roche-Posay Anthelios SPF50+',
    brand: 'La Roche-Posay',
    price: 18900,
    comparePrice: null,
    image: 'lrp-anthelios.jpg',
    category: 'Sunscreens',
    skinType: 'Sensitive, Oily',
    concern: 'Sun Protection, Shine',
    desc: 'Ultra-light fluid sunscreen with very high protection, anti-shine finish for sensitive skin.',
    longDesc: 'Dermatologist-recommended invisible fluid. Photostable, broad-spectrum SPF 50+ with Mexoryl filters. Ultra-resistant to sweat and humidity, ideal for Nigerian climate and acne-prone sensitive skin.',
    ingredients: ['Mexoryl XL & SX', 'Glycerin', 'Thermal Water'],
    howTo: 'Shake well, apply as last step AM.'
  },
  {
    id: 'eucerin-oil-control',
    name: 'Eucerin Oil Control SPF50+',
    brand: 'Eucerin',
    price: 16300,
    comparePrice: null,
    image: 'eucerin-oil-control.jpg',
    category: 'Sunscreens',
    skinType: 'Oily, Acne-Prone',
    concern: 'Oil Control, Acne',
    desc: 'Mattifying sun gel-cream with advanced oil control and dry-touch finish.',
    longDesc: 'Designed for oily and acne-prone skin. Controls oil for up to 8 hours with sebum-regulating technology while providing broad-spectrum SPF 50+. Dry touch, non-sticky.',
    ingredients: ['Licochalcone A', 'Glycyrrhetinic Acid', 'Mattifying Tech'],
    howTo: 'Apply generously before sun exposure.'
  },
  {
    id: 'ordinary-niacinamide',
    name: 'The Ordinary Niacinamide 10% + Zinc',
    brand: 'The Ordinary',
    price: 9800,
    comparePrice: 11500,
    image: 'the-ordinary-niacinamide.jpg',
    category: 'Serums',
    skinType: 'Oily, Combination',
    concern: 'Pores, Blemishes, Oil',
    desc: 'High-strength vitamin and mineral blemish formula to visibly reduce pores.',
    longDesc: 'Best-selling serum for blemish-prone skin. 10% Niacinamide (Vitamin B3) helps regulate sebum and even tone, while zinc balances. Perfect intro serum for beginners.',
    ingredients: ['Niacinamide 10%', 'Zinc PCA 1%', 'Tamarind'],
    howTo: 'Apply 1-2 drops AM/PM after cleansing.'
  },
  {
    id: 'cosrx-snail',
    name: 'COSRX Snail Mucin Essence',
    brand: 'COSRX',
    price: 14200,
    comparePrice: null,
    image: 'cosrx-snail-mucin.jpg',
    category: 'Serums',
    skinType: 'Dry, Dull, Sensitive',
    concern: 'Hydration, Repair',
    desc: '96% snail secretion filtrate to repair, hydrate and give glass-skin glow.',
    longDesc: 'K-beauty holy grail for barrier repair and glow. Lightweight essence that plumps, fades post-acne marks and calms irritation. Works beautifully under moisturizer.',
    ingredients: ['Snail Secretion Filtrate 96%', 'Sodium Hyaluronate', 'Allantoin'],
    howTo: 'Pat onto skin after toner, before moisturizer.'
  },
  {
    id: 'garnier-vitc',
    name: 'Garnier Vitamin C Serum',
    brand: 'Garnier',
    price: 8900,
    comparePrice: 10500,
    image: 'garnier-vitamin-c.jpg',
    category: 'Serums',
    skinType: 'All, Dull',
    concern: 'Hyperpigmentation, Brightening',
    desc: 'Brightening serum with Vitamin C + Niacinamide to reduce dark spots in 3 days.',
    longDesc: 'Affordable brightening powerhouse. Concentrated Vitamin C derivative + Niacinamide targets dark spots, hyperpigmentation and dullness without irritation. Great for Lagos sun-exposed skin.',
    ingredients: ['Vitamin C Derivative', 'Niacinamide', 'Salicylic Acid'],
    howTo: 'Apply 3-4 drops each morning, follow with SPF.'
  },
  {
    id: 'paulas-bha',
    name: 'Paula’s Choice 2% BHA Liquid Exfoliant',
    brand: 'Paula’s Choice',
    price: 21500,
    comparePrice: 24500,
    image: 'paulas-choice-bha.jpg',
    category: 'Exfoliants',
    skinType: 'Oily, Acne-Prone, Combo',
    concern: 'Blackheads, Texture, Pores',
    desc: 'Leave-on salicylic acid exfoliant to unclog pores and smooth texture.',
    longDesc: 'The OG pore-clearing treatment. 2% salicylic acid penetrates inside pores to dissolve blackheads, reduce breakouts and smooth bumps. Gentle enough for daily use after building tolerance.',
    ingredients: ['Salicylic Acid 2%', 'Green Tea Extract', 'Methylpropanediol'],
    howTo: 'Use 2-3x/week PM after cleansing. No rinse.'
  },
  {
    id: 'skin1004-centella',
    name: 'Skin1004 Centella Ampoule',
    brand: 'Skin1004',
    price: 13800,
    comparePrice: null,
    image: 'skin1004-centella.jpg',
    category: 'Treatments',
    skinType: 'Sensitive, Acne-Prone',
    concern: 'Soothing, Redness, Barrier',
    desc: '100% Centella Asiatica from Madagascar to calm and strengthen sensitive skin.',
    longDesc: 'Minimalist calming ampoule with only centella extract. Powerful for redness, irritation, and post-acne repair. Ideal for beginners and sensitive skin in harsh weather.',
    ingredients: ['Centella Asiatica Extract', 'Water', 'Butylene Glycol'],
    howTo: 'Apply a few drops AM/PM to soothe.'
  }
];

function formatNGN(n) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

/* ============================================================================
   Persistent Shopping Cart Manager (LocalStorage + Supabase / Server Sync)
   ============================================================================ */
const CART_ID_STORAGE_KEY = 'glowlab_cart_id';
const CART_ITEMS_STORAGE_KEY = 'glowlab_cart_items';
const RECOVERED_CUSTOMER_KEY = 'glowlab_recovered_customer';

function generateCartId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `cart_${window.crypto.randomUUID().split('-')[0]}${Date.now().toString(36).slice(-4)}`;
  }
  return `cart_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

const CartManager = {
  cartId: null,
  items: [], // [{ product_id, quantity }]
  syncTimer: null,

  init() {
    let savedId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (!savedId) {
      savedId = generateCartId();
      localStorage.setItem(CART_ID_STORAGE_KEY, savedId);
    }
    this.cartId = savedId;

    try {
      const raw = localStorage.getItem(CART_ITEMS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        this.items = parsed.filter(
          i => i && PRODUCTS.some(p => p.id === i.product_id) && Number.isInteger(Number(i.quantity)) && Number(i.quantity) > 0
        ).map(i => ({
          product_id: i.product_id,
          quantity: Math.min(50, Math.max(1, Number(i.quantity)))
        }));
      }
    } catch {
      this.items = [];
    }

    this.mountNavigationAndDrawer();
    this.updateUI();
    this.checkRecoveryParams();
  },

  saveLocal() {
    localStorage.setItem(CART_ID_STORAGE_KEY, this.cartId);
    localStorage.setItem(CART_ITEMS_STORAGE_KEY, JSON.stringify(this.items));
    this.updateUI();
    this.scheduleServerSync();
    window.dispatchEvent(new CustomEvent('glowlab:cart-updated', { detail: this.getSummary() }));
  },

  scheduleServerSync() {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncToServer();
    }, 180);
  },

  async syncToServer() {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_id: this.cartId,
          items: this.items
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Offline / static fallback gracefully preserves localStorage cart
    }
    return null;
  },

  async checkRecoveryParams() {
    const params = new URLSearchParams(window.location.search);
    const recoverToken = params.get('recover_checkout') || params.get('recovery_token');
    const queryCartId = params.get('cart_id');

    if (!recoverToken && !queryCartId) return;

    try {
      const qs = recoverToken
        ? `recover_checkout=${encodeURIComponent(recoverToken)}`
        : `cart_id=${encodeURIComponent(queryCartId)}`;
      const res = await fetch(`/api/cart?${qs}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.recovered && Array.isArray(data.items) && data.items.length > 0) {
        this.cartId = data.cart_id || this.cartId;
        this.items = data.items
          .filter(i => PRODUCTS.some(p => p.id === (i.product_id || i.id)))
          .map(i => ({
            product_id: i.product_id || i.id,
            quantity: Number(i.quantity) || 1
          }));

        if (data.customer) {
          sessionStorage.setItem(RECOVERED_CUSTOMER_KEY, JSON.stringify({
            ...data.customer,
            recovered_checkout_id: data.checkout_id,
            recovery_token: data.recovery_token
          }));
        }

        this.saveLocal();
        showToast('Welcome back! Your saved GlowLab routine has been restored to your cart. 💚', 5000);
        window.dispatchEvent(new CustomEvent('glowlab:cart-recovered', { detail: data }));
      } else if (data.cart && Array.isArray(data.items) && data.items.length > 0) {
        this.cartId = data.cart.id;
        this.items = data.items.map(i => ({
          product_id: i.product_id,
          quantity: Number(i.quantity) || 1
        }));
        this.saveLocal();
        showToast('Your saved cart has been restored! 🛍️', 3500);
      }
    } catch {
      // Ignore network errors
    }
  },

  addItem(productId, quantity = 1) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    const qty = Math.max(1, Number(quantity) || 1);
    const existing = this.items.find(i => i.product_id === productId);
    if (existing) {
      existing.quantity = Math.min(50, existing.quantity + qty);
    } else {
      this.items.push({ product_id: productId, quantity: Math.min(50, qty) });
    }
    this.saveLocal();
    showToast(`Added ${product.name} to cart (${this.getItemCount()} in cart) 🛍️`, 3000);
  },

  updateQuantity(productId, newQuantity) {
    const qty = Number(newQuantity);
    if (qty <= 0) {
      this.removeItem(productId);
      return;
    }
    const existing = this.items.find(i => i.product_id === productId);
    if (existing) {
      existing.quantity = Math.min(50, qty);
      this.saveLocal();
    }
  },

  removeItem(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    this.items = this.items.filter(i => i.product_id !== productId);
    this.saveLocal();
    if (product) {
      showToast(`Removed ${product.name} from cart`, 2500);
    }
  },

  clearCart(rotateCartId = false) {
    this.items = [];
    if (rotateCartId) {
      this.cartId = generateCartId();
    }
    this.saveLocal();
  },

  getDetailedItems() {
    return this.items
      .map(item => {
        const product = PRODUCTS.find(p => p.id === item.product_id);
        if (!product) return null;
        return {
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          image: product.image,
          unit_price: product.price,
          quantity: item.quantity,
          line_total: product.price * item.quantity
        };
      })
      .filter(Boolean);
  },

  getItemCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  },

  getSubtotal() {
    return this.getDetailedItems().reduce((sum, i) => sum + i.line_total, 0);
  },

  getSummary() {
    const detailed = this.getDetailedItems();
    const subtotal = detailed.reduce((sum, i) => sum + i.line_total, 0);
    return {
      cart_id: this.cartId,
      items: detailed,
      raw_items: this.items,
      item_count: this.getItemCount(),
      subtotal,
      total: subtotal,
      currency: 'NGN'
    };
  },

  openDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  },

  mountNavigationAndDrawer() {
    // 1. Ensure Checkout & Automation Dashboard links exist in .nav-links & #mobileMenu
    const navLinks = document.querySelector('.nav-links');
    if (navLinks && !navLinks.querySelector('a[href="checkout.html"]')) {
      const checkoutLink = document.createElement('a');
      checkoutLink.href = 'checkout.html';
      checkoutLink.textContent = 'Checkout';
      navLinks.appendChild(checkoutLink);
    }
    if (navLinks && !navLinks.querySelector('a[href="automation.html"]')) {
      const autoLink = document.createElement('a');
      autoLink.href = 'automation.html';
      autoLink.textContent = 'Automation';
      navLinks.appendChild(autoLink);
    }

    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu && !mobileMenu.querySelector('a[href="checkout.html"]')) {
      const lumiBtn = mobileMenu.querySelector('[data-chat-lumi]');
      const chkLink = document.createElement('a');
      chkLink.href = 'checkout.html';
      chkLink.textContent = 'Checkout';
      const autoLink = document.createElement('a');
      autoLink.href = 'automation.html';
      autoLink.textContent = 'Automation Dashboard';
      if (lumiBtn) {
        mobileMenu.insertBefore(chkLink, lumiBtn);
        mobileMenu.insertBefore(autoLink, lumiBtn);
      } else {
        mobileMenu.appendChild(chkLink);
        mobileMenu.appendChild(autoLink);
      }
    }

    // 2. Inject Cart Button with Badge into .nav-actions
    const navActions = document.querySelector('.nav-actions');
    if (navActions && !document.getElementById('navCartBtn')) {
      const cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.id = 'navCartBtn';
      cartBtn.className = 'cart-trigger-btn';
      cartBtn.setAttribute('aria-label', 'Open shopping cart');
      cartBtn.innerHTML = `
        <span>🛍️ Cart</span>
        <span class="cart-badge" id="navCartCount">0</span>
      `;
      cartBtn.addEventListener('click', () => this.openDrawer());
      navActions.insertBefore(cartBtn, navActions.firstChild);
    }

    // 3. Inject Slide-Over Cart Drawer into document.body
    if (!document.getElementById('cartDrawer')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'cartDrawerBackdrop';
      backdrop.className = 'cart-drawer-backdrop';
      backdrop.addEventListener('click', () => this.closeDrawer());

      const drawer = document.createElement('aside');
      drawer.id = 'cartDrawer';
      drawer.className = 'cart-drawer';
      drawer.setAttribute('aria-label', 'Shopping Cart');
      drawer.innerHTML = `
        <div class="cart-drawer-header">
          <div>
            <h3>🛍️ Your Skincare Cart <span class="cart-badge" id="drawerCartCount">0</span></h3>
            <div style="margin-top:6px;">
              <span class="cart-id-chip" id="drawerCartIdChip" title="Persistent Cart ID stored in LocalStorage & Supabase"></span>
            </div>
          </div>
          <button type="button" class="modal-close" id="closeCartDrawerBtn" aria-label="Close cart" style="position:static;">✕</button>
        </div>
        <div class="cart-drawer-body" id="cartDrawerBody"></div>
        <div class="cart-drawer-footer" id="cartDrawerFooter">
          <div class="cart-summary-line">
            <span>Subtotal</span>
            <strong id="cartDrawerSubtotal">₦0</strong>
          </div>
          <div class="cart-summary-line">
            <span>Shipping</span>
            <span style="font-size:0.82rem; color:var(--text-muted);">Calculated at checkout</span>
          </div>
          <div class="cart-summary-total">
            <span>Total (NGN)</span>
            <span id="cartDrawerTotal">₦0</span>
          </div>
          <div style="display:grid; gap:10px;">
            <a href="checkout.html" class="btn btn-primary" id="proceedCheckoutBtn" style="width:100%;">Proceed to Checkout →</a>
            <button type="button" class="btn btn-secondary" id="continueShoppingBtn" style="width:100%; padding:11px 20px;">Continue Shopping</button>
          </div>
          <p style="font-size:0.75rem; color:var(--text-light); text-align:center; margin-top:10px;">
            Persistent cart synced with Supabase • Demo checkout simulation
          </p>
        </div>
      `;

      document.body.appendChild(backdrop);
      document.body.appendChild(drawer);

      document.getElementById('closeCartDrawerBtn').addEventListener('click', () => this.closeDrawer());
      document.getElementById('continueShoppingBtn').addEventListener('click', () => this.closeDrawer());
    }
  },

  updateUI() {
    const count = this.getItemCount();
    const subtotal = this.getSubtotal();
    const detailed = this.getDetailedItems();

    const navBadge = document.getElementById('navCartCount');
    if (navBadge) {
      navBadge.textContent = String(count);
      navBadge.classList.toggle('has-items', count > 0);
    }

    const drawerBadge = document.getElementById('drawerCartCount');
    if (drawerBadge) {
      drawerBadge.textContent = String(count);
      drawerBadge.classList.toggle('has-items', count > 0);
    }

    const idChip = document.getElementById('drawerCartIdChip');
    if (idChip) {
      idChip.textContent = `Cart ID: ${this.cartId}`;
    }

    const subEl = document.getElementById('cartDrawerSubtotal');
    const totEl = document.getElementById('cartDrawerTotal');
    if (subEl) subEl.textContent = formatNGN(subtotal);
    if (totEl) totEl.textContent = formatNGN(subtotal);

    const bodyEl = document.getElementById('cartDrawerBody');
    if (!bodyEl) return;

    if (detailed.length === 0) {
      bodyEl.innerHTML = `
        <div class="cart-empty-state">
          <div style="font-size:2.4rem; margin-bottom:12px;">🧴</div>
          <h4 style="font-size:1.05rem; color:var(--charcoal); margin-bottom:6px;">Your skincare cart is empty</h4>
          <p style="font-size:0.88rem; margin-bottom:20px;">Explore our 12 dermatologist-inspired essentials or ask Lumi to build your routine.</p>
          <a href="products.html" class="btn btn-sage" style="font-size:0.88rem;">Browse Products →</a>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = detailed
      .map(
        item => `
        <div class="cart-item-row" data-cart-row="${item.product_id}">
          <div class="cart-item-thumb">
            <img src="images/${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100/FDF8F3/9AB19F?text=GlowLab'">
          </div>
          <div class="cart-item-info">
            <div class="cart-item-brand">${item.brand}</div>
            <h4>${item.name}</h4>
            <div style="font-size:0.84rem; color:var(--text-muted); font-weight:600;">
              ${formatNGN(item.unit_price)} each • <span style="color:var(--charcoal);">${formatNGN(item.line_total)}</span>
            </div>
            <div class="cart-item-controls">
              <div class="qty-stepper">
                <button type="button" data-cart-dec="${item.product_id}" aria-label="Decrease quantity">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-cart-inc="${item.product_id}" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="cart-remove-btn" data-cart-remove="${item.product_id}">Remove</button>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    bodyEl.querySelectorAll('[data-cart-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.cartDec;
        const found = this.items.find(i => i.product_id === pid);
        if (found) this.updateQuantity(pid, found.quantity - 1);
      });
    });

    bodyEl.querySelectorAll('[data-cart-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.cartInc;
        const found = this.items.find(i => i.product_id === pid);
        if (found) this.updateQuantity(pid, found.quantity + 1);
      });
    });

    bodyEl.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeItem(btn.dataset.cartRemove);
      });
    });
  }
};

window.GlowLabCart = CartManager;

/* ============================================================================
   Product Rendering, Filtering & Modal
   ============================================================================ */

function productCardHTML(p, showBadge = false) {
  const badge = p.comparePrice ? `<div class="badge-wrap"><span class="badge sage">Bestseller</span></div>` : (showBadge ? `<span class="badge">${p.category}</span>` : '');
  return `
  <article class="product-card" data-category="${p.category}" data-id="${p.id}">
    <div class="product-img">
      ${badge}
      <img src="images/${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/FDF8F3/9AB19F?text=${encodeURIComponent(p.brand)}'">
    </div>
    <div class="product-body">
      <div class="product-brand">${p.brand}</div>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${p.desc}</p>
      <div class="product-meta">
        <span class="meta-pill">${p.skinType.split(',')[0]}</span>
        <span class="meta-pill">${p.concern.split(',')[0]}</span>
      </div>
      <div class="product-foot">
        <div class="price">${formatNGN(p.price)} ${p.comparePrice ? `<small>${formatNGN(p.comparePrice)}</small>` : ''}</div>
        <div class="product-actions">
          <button class="btn btn-secondary btn-view" data-view="${p.id}">View</button>
          <button class="btn-add-cart" data-add-cart="${p.id}" aria-label="Add ${p.name} to cart">+ Add</button>
        </div>
      </div>
    </div>
  </article>`;
}

function renderProducts(containerId, limit = null, category = 'All') {
  const el = document.getElementById(containerId);
  if (!el) return;
  let list = [...PRODUCTS];
  if (category !== 'All') list = list.filter(p => p.category === category);
  if (limit) list = list.slice(0, limit);
  el.innerHTML = list.map(p => productCardHTML(p)).join('');
}

function renderAllWithFilter() {
  const grid = document.getElementById('allProductsGrid');
  if (!grid) return;
  grid.innerHTML = PRODUCTS.map(p => productCardHTML(p)).join('');
}

function initFilters() {
  const btns = document.querySelectorAll('[data-filter]');
  if (!btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      const featuredGrid = document.getElementById('featuredGrid');
      const allGrid = document.getElementById('allProductsGrid');
      if (featuredGrid && !allGrid) {
        renderProducts('featuredGrid', 8, cat);
        bindViewButtons();
      }
      if (allGrid) {
        const filtered = cat === 'All' ? PRODUCTS : PRODUCTS.filter(p => p.category === cat);
        allGrid.innerHTML = filtered.map(p => productCardHTML(p)).join('');
        bindViewButtons();
      }
    });
  });
}

function bindViewButtons() {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const product = PRODUCTS.find(p => p.id === btn.dataset.view);
      if (product) openModal(product);
    });
  });

  document.querySelectorAll('[data-add-cart]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.dataset.addCart;
      CartManager.addItem(pid, 1);
      const origText = btn.textContent;
      btn.textContent = '✓ Added';
      btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = origText;
        btn.classList.remove('added');
      }, 1000);
    });
  });

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const product = PRODUCTS.find(p => p.id === card.dataset.id);
      if (product) openModal(product);
    });
  });
}

let currentModalProduct = null;
let currentModalQty = 1;

function openModal(p) {
  const backdrop = document.getElementById('productModal');
  if (!backdrop) return;
  currentModalProduct = p;
  currentModalQty = 1;

  document.getElementById('modalImg').src = `images/${p.image}`;
  document.getElementById('modalImg').alt = p.name;
  document.getElementById('modalBrand').textContent = p.brand;
  document.getElementById('modalName').textContent = p.name;
  document.getElementById('modalPrice').innerHTML = `${formatNGN(p.price)} ${p.comparePrice ? `<small style="text-decoration:line-through;color:#9CA3AF;margin-left:8px;">${formatNGN(p.comparePrice)}</small>` : ''}`;
  document.getElementById('modalDesc').textContent = p.longDesc;
  document.getElementById('modalSkin').textContent = p.skinType;
  document.getElementById('modalConcern').textContent = p.concern;
  document.getElementById('modalCategory').textContent = p.category;
  document.getElementById('modalHowTo').textContent = p.howTo;
  const ingList = document.getElementById('modalIngredients');
  ingList.innerHTML = p.ingredients.map(i => `<li>${i}</li>`).join('');

  // Inject or update Modal Add-to-Cart bar without breaking Ask Lumi button
  let modalCartBar = document.getElementById('modalCartActionRow');
  if (!modalCartBar) {
    const modalBody = backdrop.querySelector('.modal-body');
    const lumiBtnRow = modalBody ? modalBody.querySelector('[data-chat-lumi]')?.parentElement : null;
    if (modalBody && lumiBtnRow) {
      modalCartBar = document.createElement('div');
      modalCartBar.id = 'modalCartActionRow';
      modalCartBar.className = 'modal-cart-bar';
      modalBody.insertBefore(modalCartBar, lumiBtnRow);
    }
  }

  if (modalCartBar) {
    modalCartBar.innerHTML = `
      <div class="qty-stepper">
        <button type="button" id="modalQtyDec" aria-label="Decrease quantity">−</button>
        <span id="modalQtyVal">1</span>
        <button type="button" id="modalQtyInc" aria-label="Increase quantity">+</button>
      </div>
      <button type="button" class="btn btn-sage" id="modalAddToCartBtn" style="flex:1; padding:11px 18px;">
        🛍️ Add to Cart • ${formatNGN(p.price)}
      </button>
    `;

    const qtyValEl = document.getElementById('modalQtyVal');
    const addBtnEl = document.getElementById('modalAddToCartBtn');

    document.getElementById('modalQtyDec').addEventListener('click', () => {
      currentModalQty = Math.max(1, currentModalQty - 1);
      qtyValEl.textContent = String(currentModalQty);
      addBtnEl.textContent = `🛍️ Add to Cart • ${formatNGN(p.price * currentModalQty)}`;
    });

    document.getElementById('modalQtyInc').addEventListener('click', () => {
      currentModalQty = Math.min(20, currentModalQty + 1);
      qtyValEl.textContent = String(currentModalQty);
      addBtnEl.textContent = `🛍️ Add to Cart • ${formatNGN(p.price * currentModalQty)}`;
    });

    addBtnEl.addEventListener('click', () => {
      if (currentModalProduct) {
        CartManager.addItem(currentModalProduct.id, currentModalQty);
        closeModal();
        CartManager.openDrawer();
      }
    });
  }

  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const backdrop = document.getElementById('productModal');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function initModal() {
  const backdrop = document.getElementById('productModal');
  if (!backdrop) return;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      CartManager.closeDrawer();
    }
  });
}

function initMobileMenu() {
  const toggle = document.getElementById('mobileToggle');
  const menu = document.getElementById('mobileMenu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
    toggle.innerHTML = open ? '✕' : '☰';
  });
  menu.querySelectorAll('a, .btn').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle.innerHTML = '☰';
    document.body.style.overflow = '';
  }));
}

function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
  // category filter for FAQ page
  const catBtns = document.querySelectorAll('.faq-cats button');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.faqCat;
      document.querySelectorAll('.faq-item').forEach(item => {
        if (cat === 'All' || item.dataset.category === cat) item.style.display = 'block';
        else item.style.display = 'none';
      });
    });
  });
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal, .stagger').forEach(el => observer.observe(el));
}

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 600) btn.classList.add('show');
    else btn.classList.remove('show');
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (
      href === path ||
      (path === '' && href === 'index.html') ||
      (path === 'index.html' && href === 'index.html') ||
      (href && href.replace('.html', '') === path)
    ) {
      a.classList.add('active');
    }
  });
}

function initChatButtons() {
  document.querySelectorAll('[data-chat-lumi]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (document.getElementById('lumi')) {
        document.getElementById('lumi').scrollIntoView({ behavior: 'smooth' });
      }
      // Try to open Botpress if loaded
      if (window.botpress) {
        try { window.botpress.open(); } catch {}
      }
      showToast('Lumi is ready to help you! ✨ Chat widget will appear here once Botpress is connected.', 4000);
    });
  });
}

function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const orig = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = orig;
      btn.disabled = false;
      form.reset();
      showToast('Message sent! We’ll reply within 2 hours during business hours. 💚', 4500);
    }, 1200);
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  CartManager.init();
  renderProducts('featuredGrid', 8, 'All');
  renderAllWithFilter();
  initFilters();
  bindViewButtons();
  initModal();
  initMobileMenu();
  initFAQ();
  initScrollReveal();
  initBackToTop();
  initActiveNav();
  initChatButtons();
  initContactForm();
  initSmoothScroll();

  // Add year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
