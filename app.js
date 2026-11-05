
/* --------------------------------------------------------------------------
   Dynamic Schema.org Product JSON-LD Injection
   -------------------------------------------------------------------------- */
function injectProductSchema(product) {
  let script = document.getElementById("product-schema");
  if (!script) {
    script = document.createElement("script");
    script.id = "product-schema";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  const imgUrl = product.image
    ? (product.image.startsWith("http") ? product.image : XANTA_API + product.image)
    : "https://xanta.pages.dev/og-image.png";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": [imgUrl],
    "description": product.description || "XANTA 280 GSM luxury heavyweight cotton streetwear t-shirt in architectural box-cut silhouette.",
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": "XANTA"
    },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "USD",
      "price": (Number(product.price) || 39.99).toFixed(2),
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "XANTA"
      },
      "eligibleRegion": [
        { "@type": "Country", "name": "United States", "identifier": "US" },
        { "@type": "Country", "name": "United Kingdom", "identifier": "GB" },
        { "@type": "Country", "name": "Canada", "identifier": "CA" }
      ],
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingDestination": [
          { "@type": "DefinedRegion", "addressCountry": "US" },
          { "@type": "DefinedRegion", "addressCountry": "GB" },
          { "@type": "DefinedRegion", "addressCountry": "CA" }
        ],
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 3,
            "maxValue": 7,
            "unitCode": "d"
          }
        }
      }
    }
  };
  script.textContent = JSON.stringify(schema, null, 2);
}

/* ==========================================================================
   XANTA Storefront Engine
   High-End E-Commerce & State Management
   ========================================================================== */

const XANTA_API = "https://vanta-api.rizzify.workers.dev";
const CART_STORAGE_KEY = "xanta_cart";
const ORDERS_STORAGE_KEY = "xanta_orders";

// Fallback catalog in case Cloudflare API is temporarily offline
const fallbackProducts = [
  {
    id: "tee-white",
    name: "XANTA Signature Tee",
    type: "T-SHIRT",
    category: "T-SHIRT",
    colour: "White",
    colourLabel: "WHITE",
    shape: "shirt",
    dark: false,
    price: 39.99,
    priceFrom: 39.99,
    description: "Quiet confidence. Unmistakable identity. The XANTA Signature Tee brings minimalist design into everyday streetwear. Featuring understated XANTA lettering, a relaxed silhouette and dropped shoulders, it delivers a clean, effortless look without unnecessary detail. Made with medium-weight cotton fabric, it combines everyday comfort with durable double-needle stitching.",
    details: [
      "Custom heavyweight 6 oz / 280 GSM combed cotton",
      "Relaxed architectural silhouette with dropped shoulders",
      "Double-needle reinforced stitching at sleeves, collar and hem",
      "Pre-shrunk to retain proportion across washes",
      "Available in sizes XS–3XL"
    ],
    care: [
      "Machine wash cold (30°C / 86°F) inside-out",
      "Use mild detergent; do not use chlorine bleach",
      "Hang dry recommended or tumble dry low",
      "Iron on low temperature; do not iron decoration",
      "Do not dry clean"
    ],
    sizes: [
      {size:"XS", price:39.99},
      {size:"S", price:39.99},
      {size:"M", price:39.99},
      {size:"L", price:39.99},
      {size:"XL", price:39.99},
      {size:"2XL", price:39.99},
      {size:"3XL", price:40.99}
    ],
    published: true,
    featured: true
  },
  {
    id: "tee-black",
    name: "XANTA Oversized Signature Tee",
    type: "T-SHIRT",
    category: "T-SHIRT",
    colour: "Black",
    colourLabel: "BLACK",
    shape: "shirt",
    dark: true,
    price: 39.99,
    priceFrom: 39.99,
    description: "Make a statement without saying too much. The XANTA Oversized Signature Tee brings a relaxed boxy silhouette together with understated XANTA lettering. Its dropped shoulders and clean minimalist design create a confident streetwear look. Made from soft, combed and ring-spun cotton, this medium-weight tee offers everyday comfort with a modern oversized shape.",
    details: [
      "100% Airlume combed and ring-spun heavyweight cotton",
      "Medium-weight 6 oz / 280 GSM luxury jersey weave",
      "Relaxed oversized box-cut fit engineered for drape",
      "Dropped shoulders with clean collar ribbing",
      "Available in sizes XS–3XL"
    ],
    care: [
      "Machine wash cold (30°C / 86°F) inside-out",
      "Use mild detergent; do not use chlorine bleach",
      "Hang dry recommended or tumble dry low",
      "Iron on low temperature; do not iron decoration",
      "Do not dry clean"
    ],
    sizes: [
      {size:"XS", price:39.99},
      {size:"S", price:39.99},
      {size:"M", price:39.99},
      {size:"L", price:39.99},
      {size:"XL", price:39.99},
      {size:"2XL", price:39.99},
      {size:"3XL", price:40.99}
    ],
    published: true,
    featured: true
  }
];

let liveCatalog = [...fallbackProducts];

/* --------------------------------------------------------------------------
   Cart State Management
   -------------------------------------------------------------------------- */
function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read cart from localStorage", e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
  } catch (e) {
    console.error("Failed to save cart to localStorage", e);
  }
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  document.querySelectorAll("#cart-count, .cart-count-badge").forEach(el => {
    el.textContent = count;
  });
}

function addToCart(item) {
  const cart = getCart();
  const existingIndex = cart.findIndex(
    i => i.id === item.id && i.size === item.size
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity += item.quantity;
  } else {
    cart.push(item);
  }

  saveCart(cart);
  showCartToast(item);
  renderCartPage();
}

function updateCartQuantity(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  saveCart(cart);
  renderCartPage();
}

function removeCartItem(index) {
  const cart = getCart();
  if (!cart[index]) return;
  cart.splice(index, 1);
  saveCart(cart);
  renderCartPage();
}

function showCartToast(item) {
  let toast = document.getElementById("cart-toast-banner");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "cart-toast-banner";
    toast.className = "cart-toast";
    const anchor = document.getElementById("product-detail") || document.querySelector(".page-main");
    if (anchor) anchor.prepend(toast);
  }
  toast.innerHTML = `
    <span>✓ ADDED TO BAG: <strong>${item.name}</strong> (${item.size}) · QTY ${item.quantity}</span>
    <div>
      <a href="cart.html">VIEW BAG ↗</a>
      <a href="checkout.html" style="margin-left:14px">CHECKOUT ↗</a>
    </div>
  `;
  toast.style.display = "flex";
  clearTimeout(window.cartToastTimer);
  window.cartToastTimer = setTimeout(() => {
    if (toast) toast.style.display = "none";
  }, 6000);
}

/* --------------------------------------------------------------------------
   Product Card Component
   -------------------------------------------------------------------------- */
function productCard(p) {
  const isDark = (p.colour || "").toLowerCase() === "black";
  const imgHtml = p.image 
    ? `<img src="${p.image.startsWith('http') ? p.image : XANTA_API + p.image}" alt="${p.name}">`
    : `
      <div class="mock-garment ${isDark ? 'dark' : ''}">
        <svg class="mock-garment-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M 30,10 Q 50,22 70,10 L 94,30 L 82,46 L 74,40 L 74,110 L 26,110 L 26,40 L 18,46 L 6,30 Z" />
          <path d="M 38,12 L 38,24" stroke-dasharray="2,2" />
          <path d="M 62,12 L 62,24" stroke-dasharray="2,2" />
        </svg>
        <div class="mock-garment-label">XANTA</div>
      </div>
    `;
  const priceDisplay = Number(p.price || (p.sizes && p.sizes[0] && p.sizes[0].price) || 39.99).toFixed(2);
  
  return `
    <article class="product-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="product-visual ${isDark ? "dark" : ""}">
          <span class="product-tag">${p.category || "ESSENTIALS 001"}</span>
          ${imgHtml}
          <div class="product-hover-overlay">
            <span>EXPLORE PIECE ↗</span>
          </div>
        </div>
        <div class="product-info">
          <div>
            <h3>${p.name}</h3>
            <p>${p.category || "T-SHIRT"} · ${String(p.colour || "").toUpperCase()} · 280 GSM</p>
          </div>
          <strong>$${priceDisplay}</strong>
        </div>
      </a>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   Product Detail Page
   -------------------------------------------------------------------------- */
function renderProductDetail() {
  const container = document.getElementById("product-detail");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || "tee-white";
  const product = liveCatalog.find(p => p.id === id) || liveCatalog[0];
  if (!product) return;

  const isDark = (product.colour || "").toLowerCase() === "black";
  const titleEl = document.getElementById("detail-name");
  const typeEl = document.getElementById("detail-type");
  const descEl = document.getElementById("detail-description");
  const visualEl = document.getElementById("detail-visual");
  const sizeSelect = document.getElementById("detail-size");
  const sizePillsContainer = document.getElementById("size-pills-row");
  const priceEl = document.getElementById("detail-price");
  const featuresEl = document.getElementById("detail-features");
  const careEl = document.getElementById("detail-care");
  const sizeNoteEl = document.getElementById("detail-size-note");
  const btnAdd = document.getElementById("add-to-bag");

  if (titleEl) titleEl.textContent = product.name;

  if (product.name) {
    document.title = `${product.name} — 280 GSM Heavyweight Tee | XANTA`;
  }
  injectProductSchema(product);

  if (typeEl) typeEl.textContent = `XANTA ESSENTIALS 001 · ${String(product.colour || "").toUpperCase()}`;
  if (descEl) descEl.textContent = product.description || "";
  
  if (visualEl) {
    visualEl.className = `product-visual detail-visual ${isDark ? "dark" : ""}`;
    visualEl.innerHTML = product.image
      ? `<img src="${product.image.startsWith('http') ? product.image : XANTA_API + product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover">`
      : `
        <span class="product-tag">XANTA / ESSENTIALS 001</span>
        <div class="mock-garment ${isDark ? 'dark' : ''}">
          <svg class="mock-garment-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 30,10 Q 50,22 70,10 L 94,30 L 82,46 L 74,40 L 74,110 L 26,110 L 26,40 L 18,46 L 6,30 Z" />
            <path d="M 38,12 L 38,24" stroke-dasharray="2,2" />
            <path d="M 62,12 L 62,24" stroke-dasharray="2,2" />
          </svg>
          <div class="mock-garment-label">XANTA</div>
        </div>
      `;
  }

  const sizes = (product.sizes && product.sizes.length) ? product.sizes : [{size: "M", price: product.price || 39.99}];
  
  const updatePrice = (chosenSize) => {
    const selected = sizes.find(s => s.size === chosenSize) || sizes[0];
    const pVal = Number(selected ? selected.price : product.price || 39.99);
    if (priceEl) priceEl.textContent = `$${pVal.toFixed(2)}`;
    if (btnAdd) btnAdd.textContent = `ADD TO BAG — $${pVal.toFixed(2)} ↗`;
  };

  // Populate interactive size selector pills
  if (sizePillsContainer) {
    sizePillsContainer.innerHTML = sizes.map((s, idx) => `
      <button type="button" class="size-pill ${idx === 0 ? 'active' : ''}" data-size="${s.size}">
        ${s.size}
      </button>
    `).join("");

    sizePillsContainer.querySelectorAll(".size-pill").forEach(pill => {
      pill.onclick = () => {
        sizePillsContainer.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const sVal = pill.getAttribute("data-size");
        if (sizeSelect) sizeSelect.value = sVal;
        updatePrice(sVal);
      };
    });
  }

  if (sizeSelect) {
    sizeSelect.innerHTML = sizes.map(s => `<option value="${s.size}">${s.size}</option>`).join("");
    sizeSelect.onchange = () => updatePrice(sizeSelect.value);
  }

  updatePrice(sizes[0].size);

  if (featuresEl) {
    featuresEl.innerHTML = (product.details || []).map(item => `<li>${item}</li>`).join("");
  }
  if (careEl) {
    careEl.innerHTML = (product.care || []).map(item => `<li>${item}</li>`).join("");
  }
  if (sizeNoteEl) {
    sizeNoteEl.textContent = "Fits true to size. Designed with dropped shoulders for a relaxed architectural streetwear silhouette.";
  }

  // Hook up quantity controls and Add to Bag
  const qtyInput = document.getElementById("detail-qty");
  const btnMinus = document.getElementById("qty-minus");
  const btnPlus = document.getElementById("qty-plus");

  if (btnMinus && qtyInput) {
    btnMinus.onclick = () => {
      const current = parseInt(qtyInput.value) || 1;
      if (current > 1) qtyInput.value = current - 1;
    };
  }
  if (btnPlus && qtyInput) {
    btnPlus.onclick = () => {
      const current = parseInt(qtyInput.value) || 1;
      if (current < 99) qtyInput.value = current + 1;
    };
  }

  if (btnAdd) {
    btnAdd.onclick = () => {
      const chosenSize = sizeSelect ? sizeSelect.value : (sizes[0] ? sizes[0].size : "M");
      const sizeObj = sizes.find(s => s.size === chosenSize) || sizes[0];
      const chosenPrice = Number(sizeObj ? sizeObj.price : product.price || 39.99);
      const chosenQty = parseInt(qtyInput ? qtyInput.value : 1) || 1;

      addToCart({
        id: product.id,
        name: product.name,
        category: product.category || "T-SHIRT",
        colour: product.colour || "",
        size: chosenSize,
        price: chosenPrice,
        image: product.image || null,
        quantity: chosenQty
      });
    };
  }
}

/* --------------------------------------------------------------------------
   Shopping Bag Page
   -------------------------------------------------------------------------- */
function renderCartPage() {
  const cartContainer = document.getElementById("cart-page-items");
  if (!cartContainer) return;

  const cart = getCart();
  const subtotalDisplay = document.querySelector(".cart-page-total strong");
  const checkoutBtn = document.getElementById("cart-checkout-btn");

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div style="padding: 60px 0; text-align: left;">
        <p class="eyebrow">YOUR BAG IS CURRENTLY EMPTY</p>
        <p style="font-size: 15px; color: var(--muted); margin: 12px 0 28px;">Explore Edition 001 and select your essential pieces.</p>
        <a href="shop.html" class="button button-dark">EXPLORE COLLECTION ↗</a>
      </div>
    `;
    if (subtotalDisplay) subtotalDisplay.textContent = "$0.00";
    if (checkoutBtn) {
      checkoutBtn.style.opacity = "0.5";
      checkoutBtn.style.pointerEvents = "none";
    }
    return;
  }

  if (checkoutBtn) {
    checkoutBtn.style.opacity = "1";
    checkoutBtn.style.pointerEvents = "auto";
  }

  let subtotal = 0;
  const rowsHtml = cart.map((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    const imgHtml = item.image
      ? `<img src="${item.image.startsWith('http') ? item.image : XANTA_API + item.image}" alt="${item.name}" class="cart-item-thumb">`
      : `<div class="cart-item-thumb">XANTA</div>`;

    return `
      <div class="cart-item-row">
        ${imgHtml}
        <div class="cart-item-details">
          <h3>${item.name}</h3>
          <p>${item.colour ? item.colour.toUpperCase() + ' · ' : ''}SIZE: ${item.size}</p>
        </div>
        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
        <div class="quantity-control" style="margin-bottom:0">
          <button type="button" class="quantity-btn" onclick="updateCartQuantity(${index}, -1)">–</button>
          <input type="text" class="quantity-input" value="${item.quantity}" readonly>
          <button type="button" class="quantity-btn" onclick="updateCartQuantity(${index}, 1)">+</button>
        </div>
        <div class="cart-item-total">$${itemTotal.toFixed(2)}</div>
        <button type="button" class="cart-remove-btn" onclick="removeCartItem(${index})" aria-label="Remove item">REMOVE</button>
      </div>
    `;
  }).join("");

  cartContainer.innerHTML = `<div class="cart-items-container">${rowsHtml}</div>`;
  if (subtotalDisplay) subtotalDisplay.textContent = `$${subtotal.toFixed(2)}`;
}

/* --------------------------------------------------------------------------
   Checkout Page
   -------------------------------------------------------------------------- */
function renderCheckoutPage() {
  const checkoutSection = document.getElementById("checkout-form-section");
  const summaryItemsContainer = document.getElementById("checkout-summary-items");
  if (!checkoutSection || !summaryItemsContainer) return;

  const cart = getCart();
  if (cart.length === 0) {
    document.getElementById("checkout-content").innerHTML = `
      <div class="confirmation-card">
        <p class="eyebrow">CHECKOUT</p>
        <h2>YOUR BAG IS EMPTY</h2>
        <p style="color:var(--muted);margin:14px 0 24px">You have no items in your shopping bag to checkout.</p>
        <a href="shop.html" class="button button-dark">EXPLORE COLLECTION ↗</a>
      </div>
    `;
    return;
  }

  // Render items in summary sidebar
  let subtotal = 0;
  summaryItemsContainer.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    const imgHtml = item.image
      ? `<img src="${item.image.startsWith('http') ? item.image : XANTA_API + item.image}" class="summary-item-thumb">`
      : `<div class="summary-item-thumb">XANTA</div>`;

    return `
      <div class="summary-item-card">
        ${imgHtml}
        <div style="flex:1">
          <strong style="display:block;margin-bottom:2px">${item.name}</strong>
          <div style="font-size:11px;color:var(--muted)">${item.colour} · Size ${item.size} · Qty ${item.quantity}</div>
        </div>
        <div style="font-weight:700">$${itemTotal.toFixed(2)}</div>
      </div>
    `;
  }).join("");

  // Update totals
  const subtotalEl = document.getElementById("summary-subtotal");
  const shippingEl = document.getElementById("summary-shipping");
  const grandTotalEl = document.getElementById("summary-grand-total");

  let shippingCost = subtotal >= 100 ? 0 : 10;
  const standardShippingRadio = document.getElementById("shipping-standard");
  const expressShippingRadio = document.getElementById("shipping-express");

  const updateCheckoutTotal = () => {
    if (expressShippingRadio && expressShippingRadio.checked) {
      shippingCost = 25;
    } else {
      shippingCost = subtotal >= 100 ? 0 : 10;
    }
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `$${(subtotal + shippingCost).toFixed(2)}`;
  };

  if (standardShippingRadio) standardShippingRadio.onchange = updateCheckoutTotal;
  if (expressShippingRadio) expressShippingRadio.onchange = updateCheckoutTotal;
  updateCheckoutTotal();

  // Handle Checkout Form Submission
  const form = document.getElementById("checkout-form");
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      const orderId = "XANTA-" + Math.floor(100000 + Math.random() * 900000);
      const email = document.getElementById("cust-email").value;
      const firstName = document.getElementById("cust-fname").value;
      const lastName = document.getElementById("cust-lname").value;
      const address = document.getElementById("cust-address").value;
      const city = document.getElementById("cust-city").value;
      const zip = document.getElementById("cust-zip").value;
      const country = document.getElementById("cust-country").value;
      const phone = document.getElementById("cust-phone").value;

      const orderData = {
        orderId,
        date: new Date().toISOString(),
        customer: { firstName, lastName, email, phone },
        shippingAddress: { address, city, zip, country },
        items: cart,
        subtotal,
        shippingCost,
        total: subtotal + shippingCost,
        status: "CONFIRMED_PREORDER"
      };

      try {
        const past = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
        past.unshift(orderData);
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(past));
      } catch (err) {
        console.error(err);
      }

      // Clear cart
      localStorage.removeItem(CART_STORAGE_KEY);
      updateCartCount();

      // Show Confirmation Screen
      document.getElementById("checkout-content").innerHTML = `
        <div class="confirmation-card">
          <p class="eyebrow" style="color:var(--ink)">ORDER RECORDED // 001</p>
          <h2>THANK YOU, ${firstName.toUpperCase()}.</h2>
          <p style="color:var(--muted);font-size:14px;line-height:1.7">Your order has been recorded in inventory. A confirmation reference has been registered for your delivery.</p>
          <div class="order-badge">ORDER REF: ${orderId}</div>
          
          <div class="order-recap-box">
            <strong>DELIVERY DISPATCH DETAILS</strong><br>
            ${firstName} ${lastName}<br>
            ${address}<br>
            ${city}, ${zip}, ${country}<br>
            Email: ${email} · Phone: ${phone || 'N/A'}<br><br>
            <strong>ORDER BREAKDOWN</strong><br>
            ${cart.map(i => `· ${i.quantity}x ${i.name} (${i.colour} / ${i.size}) — $${(i.price * i.quantity).toFixed(2)}`).join("<br>")}<br>
            Shipping: ${shippingCost === 0 ? "FREE" : "$" + shippingCost.toFixed(2)}<br>
            <strong>TOTAL: $${(subtotal + shippingCost).toFixed(2)}</strong>
          </div>

          <p style="font-size:12px;color:var(--muted);line-height:1.8">
            Your pieces are reserved in production. When live payment gateways (Monime) are activated, tracking and automated dispatch updates will link directly to this order reference.
          </p>

          <a href="shop.html" class="button button-dark" style="margin-top:24px;display:inline-block">CONTINUE SHOPPING ↗</a>
        </div>
      `;
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }
}

/* --------------------------------------------------------------------------
   Fetch Live Catalog from Cloudflare Worker
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Front Page Hero Dynamic Showcase
   -------------------------------------------------------------------------- */
function renderHeroShowcase(settings) {
  const frame = document.getElementById("hero-showcase-frame");
  if (!frame) return;

  const footerTag = document.getElementById("hero-footer-tag");
  let heroUrl = (settings && settings.hero_image_url) || null;
  let heroTitle = (settings && settings.hero_title) || "ESSENTIALS 001";
  let heroBadge = (settings && settings.hero_badge) || "LIMITED RUN // 280 GSM";

  // Fallback to any featured product that has an image
  if (!heroUrl && typeof liveCatalog !== "undefined" && Array.isArray(liveCatalog)) {
    const withImg = liveCatalog.find(p => p.image);
    if (withImg) {
      heroUrl = withImg.image;
      heroTitle = withImg.name;
    }
  }

  if (heroUrl) {
    frame.classList.add("has-image");
    frame.innerHTML = `
      <img src="${heroUrl}" alt="${heroTitle}" class="hero-showcase-img">
      <div class="hero-garment-brand" id="hero-showcase-badge">${heroTitle}</div>
    `;
  }
  if (footerTag && heroBadge) {
    footerTag.textContent = heroBadge;
  }
}

async function loadVantaCatalog() {
  // Try immediate cached hero render
  try {
    const cachedSettings = JSON.parse(localStorage.getItem("xanta_hero_settings") || "null");
    if (cachedSettings) renderHeroShowcase(cachedSettings);
  } catch(_) {}

  try {
    const res = await fetch(XANTA_API + "/api/products");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        liveCatalog = data.products;
      }
      if (data.settings) {
        try { localStorage.setItem("xanta_hero_settings", JSON.stringify(data.settings)); } catch(_) {}
        renderHeroShowcase(data.settings);
      } else {
        renderHeroShowcase(null);
      }
    }
  } catch (err) {
    console.warn("XANTA: Live Cloudflare API offline; using fallback catalog.", err);
  }

  // Render on homepage
  const featuredContainer = document.getElementById("featured-products");
  if (featuredContainer) {
    const featured = liveCatalog.filter(p => p.featured);
    featuredContainer.innerHTML = (featured.length ? featured : liveCatalog).map(productCard).join("");
  }

  // Render on shop page
  const allProductsContainer = document.getElementById("all-products");
  if (allProductsContainer) {
    allProductsContainer.innerHTML = liveCatalog.map(productCard).join("");
  }

  // Render product detail page
  renderProductDetail();
}

/* --------------------------------------------------------------------------
   Mobile Drawer & Navigation Initializer
   -------------------------------------------------------------------------- */
function initNavigation() {
  const toggle = document.getElementById("mobile-toggle");
  const drawer = document.getElementById("mobile-drawer");
  if (toggle && drawer) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      drawer.classList.toggle("open");
      const isOpen = drawer.classList.contains("open");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    drawer.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        toggle.classList.remove("active");
        drawer.classList.remove("open");
        document.body.style.overflow = "";
      });
    });
  }
}

/* --------------------------------------------------------------------------
   Main Initialization
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  updateCartCount();
  
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  renderCartPage();
  renderCheckoutPage();
  loadVantaCatalog();
});
