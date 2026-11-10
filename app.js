
/* --------------------------------------------------------------------------
   HTML Escaping Helper
   -------------------------------------------------------------------------- */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* --------------------------------------------------------------------------
   Dynamic Schema.org Product JSON-LD Injection
   -------------------------------------------------------------------------- */
function injectProductSchema(product) {
  const script = document.getElementById("product-schema");
  if (!script || !product) return;
  const productUrl = `https://xanta.pages.dev/product.html?id=${encodeURIComponent(product.id)}`;
  const price = Number(product.price);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name || "XANTA product",
    "description": product.description || "",
    "image": product.image || undefined,
    "sku": String(product.id),
    "category": product.category || "Apparel",
    "color": product.colour || undefined,
    "brand": { "@type": "Brand", "name": "XANTA" },
    "offers": Number.isFinite(price) && price > 0 ? {
      "@type": "Offer",
      "url": productUrl,
      "priceCurrency": "USD",
      "price": price.toFixed(2),
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.published === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "seller": { "@type": "Organization", "name": "XANTA", "url": "https://xanta.pages.dev/" }
    } : undefined
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
const fallbackProducts = [];

let liveCatalog = [];

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
  document.querySelectorAll("#cart-count, .cart-count-badge, .bottom-cart-badge").forEach(el => {
    el.textContent = count;
  });
}

function addToCart(item) {
  const cart = getCart();
  const existingIndex = cart.findIndex(
    i => i.id === item.id && i.size === item.size && (i.colour || "") === (item.colour || "")
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
  const badgeText = p.badge || (p.featured ? "Best Seller" : "New");
  const badgeClass = badgeText.toLowerCase().includes("hot") ? "badge-hot" : (badgeText.toLowerCase().includes("seller") ? "badge-seller" : "badge-new");
  const imgUrl = p.image ? (p.image.startsWith("http") || p.image.startsWith("/") ? p.image : XANTA_API + p.image) : "";
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const firstSize = sizes.find(s => s && typeof s === "object" && Number(s.price) > 0);
  const price = Number(p.price || firstSize?.price);
  const priceDisplay = Number.isFinite(price) && price > 0 ? `$${price.toFixed(2)}` : "View details";
  const prodId = escapeHtml(p.id);
  const prodName = escapeHtml(p.name || "XANTA Product");
  const image = imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${prodName} — ${escapeHtml(p.colour || 'XANTA')} garment" loading="lazy" decoding="async" width="480" height="600">` : `<div class="product-image-unavailable" aria-label="Product image unavailable">XANTA</div>`;
  return `
    <article class="top-pick-card" data-product-id="${prodId}">
      <div class="card-top-row">
        <span class="card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
        <button type="button" class="wishlist-btn" aria-label="Add ${prodName} to wishlist" onclick="toggleWishlist(this, '${prodId}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-visual-link" aria-label="View ${prodName}"><div class="card-visual">${image}</div></a>
      <div class="card-details-row">
        <div class="card-meta"><h3 class="card-title"><a href="product.html?id=${encodeURIComponent(p.id)}">${prodName}</a></h3><span class="card-price">${priceDisplay}</span></div>
        <button type="button" class="btn-card-add-cart" onclick="window.location.href='product.html?id=${encodeURIComponent(p.id)}'" aria-label="Choose options for ${prodName}">
          <span>Choose options</span>
        </button>
      </div>
    </article>`;
}
function quickAddToCart(productId) {
  window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
}

function toggleWishlist(btn, productId) {
  btn.classList.toggle("active");
  const svg = btn.querySelector("svg");
  if (btn.classList.contains("active")) {
    svg.setAttribute("fill", "var(--gold)");
    svg.setAttribute("stroke", "var(--gold)");
    showCartToast("Added to wishlist");
  } else {
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
  }
}

/* --------------------------------------------------------------------------
   Product Detail Page
   -------------------------------------------------------------------------- */
function renderProductDetail() {
  const container = document.getElementById("product-detail");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || (liveCatalog[0] ? liveCatalog[0].id : null);
  const product = liveCatalog.find(p => p.id === id);
  if (!product) {
    container.innerHTML = `<div style="grid-column:1/-1;padding:60px 0"><p class="eyebrow">PRODUCT NOT FOUND</p><a href="shop.html" class="btn-gold-pill">RETURN TO SHOP</a></div>`;
    return;
  }

  const isDark = (product.colour || "").toLowerCase().includes("black");
  const titleEl = document.getElementById("detail-name");
  const typeEl = document.getElementById("detail-type");
  const descEl = document.getElementById("detail-description");
  const visualEl = document.getElementById("detail-visual");
  const sizeSelect = document.getElementById("detail-size");
  const sizePillsContainer = document.getElementById("size-pills-row");
  const sizeLabel = document.getElementById("selected-size-label");
  const colourLabel = document.getElementById("selected-colour-label");
  const colourRow = document.getElementById("colour-pills-row");
  const priceEl = document.getElementById("detail-price");
  const featuresEl = document.getElementById("detail-features");
  const careEl = document.getElementById("detail-care");
  const sizeNoteEl = document.getElementById("detail-size-note");
  const btnAdd = document.getElementById("add-to-bag");
  const relatedEl = document.getElementById("related-products");

  if (titleEl) titleEl.textContent = product.name || "XANTA Essential";
  document.title = `${product.name || "XANTA Essential"} | XANTA`;
  injectProductSchema(product);
  const colourName = product.colour || "Standard";
  if (typeEl) typeEl.textContent = `XANTA ESSENTIALS · ${colourName.toUpperCase()}`;
  if (colourLabel) colourLabel.textContent = colourName.toUpperCase();
  if (descEl) descEl.textContent = product.description || "";

  // Determine available colourways: either inline inside product.colourways or separate products
  let colourways = Array.isArray(product.colourways) && product.colourways.length ? product.colourways : [];
  if (!colourways.length && product.colour) {
    colourways = [{
      id: product.id,
      colour: product.colour,
      hex: String(product.colour).toLowerCase().includes("black") ? "#111111" : (String(product.colour).toLowerCase().includes("wash") ? "#383838" : "#f4f4f4"),
      images: Array.isArray(product.gallery) && product.gallery.length ? product.gallery : (product.image ? [{ url: product.image, label: "Front View" }] : [])
    }];
  }

  let activeColourwayIndex = 0;
  let activeImageIndex = 0;

  function updateVisualDisplay() {
    const activeCw = colourways[activeColourwayIndex] || { colour: product.colour, images: [] };
    const images = Array.isArray(activeCw.images) && activeCw.images.length ? activeCw.images : (Array.isArray(product.gallery) && product.gallery.length ? product.gallery : (product.image ? [{ url: product.image, label: "Front View" }] : []));
    if (activeImageIndex >= images.length) activeImageIndex = 0;
    const curImg = images[activeImageIndex] || { url: product.image, label: "View" };
    const curUrl = curImg.url ? (curImg.url.startsWith("http") ? curImg.url : XANTA_API + curImg.url) : (product.image || "");

    if (colourLabel) colourLabel.textContent = (activeCw.colour || product.colour || "Standard").toUpperCase();

    if (visualEl) {
      const isDarkImg = (activeCw.colour || "").toLowerCase().includes("black") || isDark;
      visualEl.className = `product-visual detail-visual ${isDarkImg ? "dark" : ""}`;
      visualEl.innerHTML = curUrl
        ? `<img src="${escapeHtml(curUrl)}" alt="${escapeHtml(product.name || 'XANTA product')} — ${escapeHtml(activeCw.colour || 'View')} (${escapeHtml(curImg.label || 'Angle')})" loading="eager" fetchpriority="high" decoding="async" width="800" height="960">`
        : `<div class="product-image-unavailable" role="img" aria-label="Product image unavailable">XANTA</div>`;
    }

    const thumbRow = document.getElementById("detail-thumbnails-row");
    if (thumbRow) {
      if (images.length > 1) {
        thumbRow.innerHTML = images.map((img, idx) => {
          const u = img.url ? (img.url.startsWith("http") ? img.url : XANTA_API + img.url) : "";
          const lbl = img.label || (idx === 0 ? "Front" : (idx === 1 ? "Back" : `View ${idx+1}`));
          return `<button type="button" class="detail-thumb-btn ${idx === activeImageIndex ? 'active' : ''}" data-idx="${idx}" aria-label="View ${escapeHtml(lbl)}"><img src="${escapeHtml(u)}" alt="${escapeHtml(lbl)}" loading="lazy" width="90" height="110"><span class="detail-thumb-caption">${escapeHtml(lbl)}</span></button>`;
        }).join("");
        thumbRow.querySelectorAll(".detail-thumb-btn").forEach(btn => btn.addEventListener("click", () => {
          activeImageIndex = parseInt(btn.dataset.idx) || 0;
          updateVisualDisplay();
        }));
        thumbRow.style.display = "flex";
      } else {
        thumbRow.innerHTML = "";
        thumbRow.style.display = "none";
      }
    }
  }

  // Populate Colour pills
  if (colourRow) {
    if (colourways.length > 1) {
      colourRow.innerHTML = colourways.map((cw, i) => {
        const bg = cw.hex || (String(cw.colour || '').toLowerCase().includes('black') ? '#111' : (String(cw.colour || '').toLowerCase().includes('white') ? '#eee' : '#666'));
        return `<button type="button" class="colour-pill ${i === activeColourwayIndex ? 'active' : ''}" data-cw-idx="${i}"><span class="colour-swatch" style="background:${bg}"></span><span>${escapeHtml(cw.colour || `Option ${i+1}`)}</span></button>`;
      }).join("");
      colourRow.querySelectorAll(".colour-pill").forEach(pill => pill.addEventListener("click", () => {
        colourRow.querySelectorAll(".colour-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        activeColourwayIndex = parseInt(pill.dataset.cwIdx) || 0;
        activeImageIndex = 0;
        updateVisualDisplay();
      }));
    } else {
      const variants = liveCatalog.filter(p => p.id !== product.id && p.category === product.category && p.name === product.name);
      const available = [product, ...variants];
      colourRow.innerHTML = available.map((v, i) => `<button type="button" class="colour-pill ${v.id === product.id ? 'active' : ''}" data-product-id="${escapeHtml(v.id)}"><span class="colour-swatch" style="background:${String(v.colour || '').toLowerCase().includes('black') ? '#111' : '#eee'}"></span><span>${escapeHtml(v.colour || `Option ${i+1}`)}</span></button>`).join("");
      colourRow.querySelectorAll(".colour-pill").forEach(pill => pill.addEventListener("click", () => {
        const target = pill.getAttribute("data-product-id");
        if (target && target !== product.id) window.location.href = `product.html?id=${encodeURIComponent(target)}`;
      }));
    }
  }
  updateVisualDisplay();

  // Price & sizes setup
  const rawSizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : [{ size: "M", price: product.price }];
  const seenSizes = new Set();
  const uniqueSizes = rawSizes.filter(s => {
    if (seenSizes.has(s.size)) return false;
    seenSizes.add(s.size);
    return true;
  });

  if (sizeSelect) {
    sizeSelect.innerHTML = uniqueSizes.map(s => `<option value="${escapeHtml(s.size)}" data-price="${s.price || product.price}">${escapeHtml(s.size)} — $${Number(s.price || product.price).toFixed(2)}</option>`).join("");
  }

  if (sizePillsContainer) {
    sizePillsContainer.innerHTML = uniqueSizes.map((s, idx) => `
      <button type="button" class="size-pill ${idx === 0 ? "active" : ""}" data-size="${escapeHtml(s.size)}" data-price="${s.price || product.price}">
        ${escapeHtml(s.size)}
      </button>
    `).join("");

    sizePillsContainer.querySelectorAll(".size-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        sizePillsContainer.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        if (sizeSelect) sizeSelect.value = pill.dataset.size;
        if (sizeLabel) sizeLabel.textContent = pill.dataset.size;
        if (priceEl) priceEl.textContent = `$${Number(pill.dataset.price).toFixed(2)}`;
        if (sizeNoteEl) sizeNoteEl.textContent = "";
      });
    });
  }

  if (uniqueSizes.length > 0) {
    const initial = uniqueSizes[0];
    if (sizeLabel) sizeLabel.textContent = initial.size;
    if (priceEl) priceEl.textContent = `$${Number(initial.price || product.price).toFixed(2)}`;
  } else if (priceEl) {
    priceEl.textContent = `$${Number(product.price).toFixed(2)}`;
  }

  if (featuresEl) {
    const details = Array.isArray(product.details) ? product.details : [];
    featuresEl.innerHTML = details.length ? details.map(d => `<li>${escapeHtml(d)}</li>`).join("") : "<li>280 GSM luxury combed cotton construction</li><li>Architectural relaxed drape</li>";
  }

  if (careEl) {
    const care = Array.isArray(product.care) ? product.care : [];
    careEl.innerHTML = care.length ? care.map(c => `<li>${escapeHtml(c)}</li>`).join("") : "<li>Machine wash cold inside out</li><li>Hang dry recommended</li>";
  }
  const minus = document.getElementById("qty-minus");
  const plus = document.getElementById("qty-plus");
  if (minus && qtyInput) minus.onclick = () => { qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) - 1); };
  if (plus && qtyInput) plus.onclick = () => { qtyInput.value = Math.min(99, (parseInt(qtyInput.value) || 1) + 1); };
  if (btnAdd && uniqueSizes.length) btnAdd.onclick = () => {
    const selectedSize = sizePillsContainer?.querySelector(".size-pill.active")?.dataset.size || sizeSelect?.value;
    const selected = uniqueSizes.find(s => s.size === selectedSize);
    if (!selected) { if(sizeNoteEl) sizeNoteEl.textContent = "Please select an available size."; return; }
    const currentColour = colourways[activeColourwayIndex]?.colour || colourName;
    const activeCw = colourways[activeColourwayIndex];
    const currentImage = (activeCw?.images?.[0]?.url) || product.image || null;
    addToCart({ id: product.id, name: product.name, category: product.category || "", colour: currentColour, size: selected.size, price: selected.price, image: currentImage, quantity: Math.max(1, Math.min(99, parseInt(qtyInput?.value) || 1)) });
  };
  if (relatedEl) relatedEl.innerHTML = liveCatalog.filter(p => p.id !== product.id).slice(0, 4).map(productCard).join("");
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
      ? `<img src="${item.image.startsWith('http') ? item.image : XANTA_API + item.image}" alt="${escapeHtml(item.name)} in ${escapeHtml(item.colour || '')} (${escapeHtml(item.size)}) — XANTA Shopping Bag" title="${escapeHtml(item.name)}" class="cart-item-thumb" loading="lazy" decoding="async" width="80" height="96">`
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
      ? `<img src="${item.image.startsWith('http') ? item.image : XANTA_API + item.image}" alt="${escapeHtml(item.name)} in ${escapeHtml(item.colour || '')} (${escapeHtml(item.size)}) — XANTA Order Summary" title="${escapeHtml(item.name)}" class="summary-item-thumb" loading="lazy" decoding="async" width="80" height="96">`
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
      <img src="${heroUrl}" alt="${escapeHtml(heroTitle)} — XANTA Minimalist Luxury Streetwear &amp; 280 GSM Heavyweight Essentials Showcase" title="${escapeHtml(heroTitle)} — XANTA Showcase" class="hero-showcase-img" loading="eager" fetchpriority="high" decoding="async" width="1200" height="800">
      <div class="hero-garment-brand" id="hero-showcase-badge">${escapeHtml(heroTitle)}</div>
    `;
  } else {
    frame.classList.remove("has-image");
    frame.innerHTML = `
      <div class="hero-showcase-placeholder" id="hero-showcase-placeholder">
        <div class="hero-showcase-placeholder-mark">X</div>
        <p class="hero-showcase-placeholder-tag">XANTA ARCHIVE</p>
      </div>
      <div class="hero-garment-brand" id="hero-showcase-badge" style="display:none;">${escapeHtml(heroTitle)}</div>
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
      if (Array.isArray(data.products)) {
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
    console.warn("XANTA: Live Cloudflare API unavailable.", err);
  }

  // Render on homepage
  const featuredContainer = document.getElementById("featured-products");
  if (featuredContainer) {
    const featured = liveCatalog.filter(p => p.featured);
    const toShow = featured.length ? featured : liveCatalog;
    if (toShow.length) {
      featuredContainer.innerHTML = toShow.map(productCard).join("");
    } else {
      featuredContainer.innerHTML = `
        <div class="catalog-empty-notice">
          <div class="empty-mark">X</div>
          <p class="empty-title">NEW COLLECTION ARRIVING SOON</p>
          <p class="empty-sub">Our curated garments are currently in production. Check back soon or browse our brand story.</p>
        </div>
      `;
    }
  }

  // Render on shop page
  const allProductsContainer = document.getElementById("all-products");
  if (allProductsContainer) {
    if (liveCatalog.length) {
      allProductsContainer.innerHTML = liveCatalog.map(productCard).join("");
    } else {
      allProductsContainer.innerHTML = `
        <div class="catalog-empty-notice">
          <div class="empty-mark">X</div>
          <p class="empty-title">NEW COLLECTION ARRIVING SOON</p>
          <p class="empty-sub">New garments will appear here as soon as they are published from the studio.</p>
        </div>
      `;
    }
    initShopFilters();
  }

  // Render product detail page
  renderProductDetail();
}

/* Contact form: submit only through the backend, never show a false success. */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = document.getElementById("contact-status");
  const button = document.getElementById("contact-submit-btn");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("contact-name")?.value.trim() || "";
    const email = document.getElementById("contact-email")?.value.trim() || "";
    const subject = document.getElementById("contact-subject")?.value || "General Inquiries";
    const message = document.getElementById("contact-message")?.value.trim() || "";
    const website = document.getElementById("contact-website")?.value.trim() || "";
    const show = (text, kind) => { if (status) { status.textContent = text; status.className = `contact-status-box status-${kind}`; status.style.display = "block"; } };
    if (name.length < 2 || name.length > 100) { show("Enter your name (2–100 characters).", "error"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { show("Enter a valid email address.", "error"); return; }
    if (message.length < 5 || message.length > 5000) { show("Enter a message between 5 and 5,000 characters.", "error"); return; }
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = "SENDING…"; }
    try {
      const response = await fetch(XANTA_API + "/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, subject, message, website }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !(result.ok || result.success)) throw new Error(result.error || "Your message could not be submitted. Please try again.");
      show(result.message || "Your message was received. Thank you for contacting XANTA.", "success");
      form.reset();
    } catch (error) { show(error.message || "A connection error occurred. Please try again.", "error"); }
    finally { if (button) { button.disabled = false; button.textContent = button.dataset.originalText || "SUBMIT INQUIRY"; } }
  });
}

function initShopFilters() {
  const buttons = document.querySelectorAll(".shop-filter-bar .filter-pill");
  const grid = document.getElementById("all-products");
  if (!buttons.length || !grid) return;
  const applyFilter = selected => {
    buttons.forEach(item => item.classList.toggle("active", item === selected));
    const category = (selected?.dataset.category || "ALL").toUpperCase();
    const products = category === "ALL" ? liveCatalog : liveCatalog.filter(p => {
      const value = String(p.category || "").toUpperCase();
      if (category === "T-SHIRT") return ["T-SHIRT", "TSHIRT", "TEE"].includes(value);
      if (category === "PANTS") return ["PANTS", "SWEATPANTS", "TROUSERS"].includes(value);
      return value === category;
    });
    grid.innerHTML = products.length ? products.map(productCard).join("") : `<p class="size-note" style="grid-column:1/-1">No products are currently listed in this collection.</p>`;
  };
  buttons.forEach(button => button.addEventListener("click", () => applyFilter(button)));
  const requested = new URLSearchParams(location.search).get("category")?.toUpperCase();
  const initial = [...buttons].find(button => button.dataset.category === requested);
  if (initial) applyFilter(initial);
}

/* --------------------------------------------------------------------------
   Mobile Drawer & Navigation Initializer
   -------------------------------------------------------------------------- */
function initNavigation() {
  const toggle = document.getElementById("mobile-toggle");
  const drawer = document.getElementById("mobile-drawer");
  const closeBtn = document.getElementById("mobile-drawer-close");
  
  if (toggle && drawer) {
    toggle.addEventListener("click", () => {
      drawer.classList.toggle("open");
      const isOpen = drawer.classList.contains("open");
      toggle.setAttribute("aria-expanded", isOpen);
      drawer.setAttribute("aria-hidden", !isOpen);
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener("click", () => {
      drawer.classList.remove("open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
    });
  }

  // Close drawer when clicking outside
  document.addEventListener("click", (e) => {
    if (drawer && drawer.classList.contains("open") && !drawer.contains(e.target) && toggle && !toggle.contains(e.target)) {
      drawer.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
    }
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* --------------------------------------------------------------------------
   Main Initialization
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initContactForm();
  updateCartCount();
  
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  renderCartPage();
  renderCheckoutPage();
  loadVantaCatalog();
});
