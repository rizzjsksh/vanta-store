/* VANTA Storefront Engine */
const VANTA_API = "https://vanta-api.rizzify.workers.dev";
const CART_STORAGE_KEY = "vanta_cart";
const ORDERS_STORAGE_KEY = "vanta_orders";

// Fallback catalog in case API is temporarily offline
const fallbackProducts = [
  {
    id: "tee-white",
    name: "VANTA Signature Tee",
    type: "T-SHIRT",
    category: "T-SHIRT",
    colour: "White",
    colourLabel: "WHITE",
    shape: "shirt",
    dark: false,
    price: 39.99,
    priceFrom: 39.99,
    description: "Quiet confidence. Unmistakable identity. The VANTA Signature Tee brings minimalist design into everyday streetwear. Featuring understated VANTA lettering, a relaxed silhouette and dropped shoulders, it delivers a clean, effortless look without unnecessary detail. Made with medium-weight cotton fabric, it combines everyday comfort with durable double-needle stitching.",
    details: ["Medium-weight 6 oz / 170 GSM fabric", "Relaxed silhouette with dropped shoulders", "Double-needle stitching at sleeves, neck and hem", "Tear-away label", "Available in XS–3XL"],
    care: ["Machine wash cold, up to 30°C", "Use non-chlorine bleach if needed", "Tumble dry on low heat", "Iron on low heat", "Do not dry clean"],
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
    name: "VANTA Oversized Signature Tee",
    type: "T-SHIRT",
    category: "T-SHIRT",
    colour: "Black",
    colourLabel: "BLACK",
    shape: "shirt",
    dark: true,
    price: 39.99,
    priceFrom: 39.99,
    description: "Make a statement without saying too much. The VANTA Oversized Signature Tee brings a relaxed boxy silhouette together with understated VANTA lettering. Its dropped shoulders and clean minimalist design create a confident streetwear look. Made from soft, combed and ring-spun cotton, this medium-weight tee offers everyday comfort with a modern oversized shape.",
    details: ["100% Airlume combed and ring-spun cotton; composition can vary by colour", "Medium-weight 6 oz / 170 GSM fabric", "Relaxed oversized boxy fit", "Dropped shoulders", "Tear-away label", "Available in XS–3XL"],
    care: ["Machine wash cold, up to 30°C", "Use non-chlorine bleach if needed", "Tumble dry on low heat", "Iron on low heat", "Do not dry clean"],
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

/* CART STATE & HELPERS */
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
  const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
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
      <a href="checkout.html">CHECKOUT ↗</a>
    </div>
  `;
  toast.style.display = "flex";
  clearTimeout(window.cartToastTimer);
  window.cartToastTimer = setTimeout(() => {
    if (toast) toast.style.display = "none";
  }, 6000);
}

/* PRODUCT CARD COMPONENT */
function productCard(p) {
  const isDark = (p.colour || "").toLowerCase() === "black";
  const imgHtml = p.image 
    ? `<img src="${p.image.startsWith('http') ? p.image : VANTA_API + p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">`
    : `<span class="product-tag">VANTA / ESSENTIALS 001</span><div class="shirt-shape"><span class="mock-logo">VANTA</span></div>`;
  const priceDisplay = Number(p.price || (p.sizes && p.sizes[0] && p.sizes[0].price) || 39.99).toFixed(2);
  
  return `
    <article class="product-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="product-visual ${isDark ? "dark" : ""}">
          ${imgHtml}
        </div>
        <div class="product-info">
          <div>
            <h3>${p.name}</h3>
            <p>${p.category || "T-SHIRT"} · ${String(p.colour || "").toUpperCase()}</p>
          </div>
          <strong>$${priceDisplay}</strong>
        </div>
      </a>
    </article>
  `;
}

/* RENDER PRODUCT DETAIL PAGE */
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
  const priceEl = document.getElementById("detail-price");
  const featuresEl = document.getElementById("detail-features");
  const careEl = document.getElementById("detail-care");
  const sizeNoteEl = document.getElementById("detail-size-note");

  if (titleEl) titleEl.textContent = product.name;
  if (typeEl) typeEl.textContent = `VANTA ESSENTIALS 001 · ${String(product.colour || "").toUpperCase()}`;
  if (descEl) descEl.textContent = product.description || "";
  
  if (visualEl) {
    visualEl.className = `product-visual detail-visual ${isDark ? "dark" : ""}`;
    visualEl.innerHTML = product.image
      ? `<img src="${product.image.startsWith('http') ? product.image : VANTA_API + product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover">`
      : `<span class="product-tag">VANTA / ESSENTIALS 001</span><div class="shirt-shape"><span class="mock-logo">VANTA</span></div>`;
  }

  const sizes = (product.sizes && product.sizes.length) ? product.sizes : [{size: "M", price: product.price || 39.99}];
  if (sizeSelect) {
    sizeSelect.innerHTML = sizes.map(s => `<option value="${s.size}">${s.size}</option>`).join("");
    const updatePrice = () => {
      const selected = sizes.find(s => s.size === sizeSelect.value) || sizes[0];
      const pVal = Number(selected ? selected.price : product.price || 39.99);
      if (priceEl) priceEl.textContent = `$${pVal.toFixed(2)}`;
    };
    sizeSelect.onchange = updatePrice;
    updatePrice();
  }

  if (featuresEl) {
    featuresEl.innerHTML = (product.details || []).map(item => `<li>${item}</li>`).join("");
  }
  if (careEl) {
    careEl.innerHTML = (product.care || []).map(item => `<li>${item}</li>`).join("");
  }
  if (sizeNoteEl) {
    sizeNoteEl.textContent = "Available sizes: XS, S, M, L, XL, 2XL and 3XL. Designed for a comfortable modern fit.";
  }

  // Hook up quantity controls and Add to Bag
  const qtyInput = document.getElementById("detail-qty");
  const btnMinus = document.getElementById("qty-minus");
  const btnPlus = document.getElementById("qty-plus");
  const btnAdd = document.getElementById("add-to-bag");

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
      const chosenSize = sizeSelect ? sizeSelect.value : "M";
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

/* RENDER CART PAGE */
function renderCartPage() {
  const cartContainer = document.getElementById("cart-page-items");
  if (!cartContainer) return;

  const cart = getCart();
  const subtotalDisplay = document.querySelector(".cart-page-total strong");
  const checkoutBtn = document.getElementById("cart-checkout-btn");

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div style="padding: 40px 0; text-align: left;">
        <p class="empty-cart" style="font-size: 14px; margin-bottom: 20px;">Your bag is currently empty.</p>
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
      ? `<img src="${item.image.startsWith('http') ? item.image : VANTA_API + item.image}" alt="${item.name}" class="cart-item-thumb">`
      : `<div class="cart-item-thumb">VANTA</div>`;

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
        <button type="button" class="cart-remove-btn" onclick="removeCartItem(${index})">REMOVE</button>
      </div>
    `;
  }).join("");

  cartContainer.innerHTML = `<div class="cart-items-container">${rowsHtml}</div>`;
  if (subtotalDisplay) subtotalDisplay.textContent = `$${subtotal.toFixed(2)}`;
}

/* RENDER CHECKOUT PAGE */
function renderCheckoutPage() {
  const checkoutSection = document.getElementById("checkout-form-section");
  const summaryItemsContainer = document.getElementById("checkout-summary-items");
  if (!checkoutSection || !summaryItemsContainer) return;

  const cart = getCart();
  if (cart.length === 0) {
    document.getElementById("checkout-content").innerHTML = `
      <div class="confirmation-card">
        <h2>YOUR BAG IS EMPTY</h2>
        <p>You have no items in your shopping bag to checkout.</p>
        <a href="shop.html" class="button button-dark" style="margin-top:20px;display:inline-block">EXPLORE COLLECTION ↗</a>
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
      ? `<img src="${item.image.startsWith('http') ? item.image : VANTA_API + item.image}" class="summary-item-thumb">`
      : `<div class="summary-item-thumb">VANTA</div>`;

    return `
      <div class="summary-item-card">
        ${imgHtml}
        <div style="flex:1">
          <strong>${item.name}</strong>
          <div style="font-size:11px;color:#777">${item.colour} · ${item.size} · Qty: ${item.quantity}</div>
        </div>
        <div>$${itemTotal.toFixed(2)}</div>
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
      const orderId = "VANTA-" + Math.floor(100000 + Math.random() * 900000);
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

      // Store order in localStorage
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
          <p class="eyebrow" style="color:#2e7d32">ORDER CONFIRMED</p>
          <h2>THANK YOU, ${firstName.toUpperCase()}.</h2>
          <p>Your order has been recorded successfully. A confirmation summary has been registered for your delivery.</p>
          <div class="order-badge">ORDER REF: ${orderId}</div>
          
          <div class="order-recap-box">
            <strong>DELIVERY DETAILS</strong><br>
            ${firstName} ${lastName}<br>
            ${address}<br>
            ${city}, ${zip}, ${country}<br>
            Email: ${email} · Phone: ${phone || 'N/A'}<br><br>
            <strong>ORDER SUMMARY</strong><br>
            ${cart.map(i => `· ${i.quantity}x ${i.name} (${i.colour} / ${i.size}) — $${(i.price * i.quantity).toFixed(2)}`).join("<br>")}<br>
            Shipping: ${shippingCost === 0 ? "FREE" : "$" + shippingCost.toFixed(2)}<br>
            <strong>TOTAL: $${(subtotal + shippingCost).toFixed(2)}</strong>
          </div>

          <p style="font-size:12px;color:#666;line-height:1.7">
            Your items are now reserved in production. When live payment gateways (Monime) launch, tracking and automated dispatch updates will link directly to this order reference.
          </p>

          <a href="shop.html" class="button button-dark" style="margin-top:20px;display:inline-block">CONTINUE SHOPPING ↗</a>
        </div>
      `;
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }
}

/* FETCH LIVE CATALOG FROM CLOUDFLARE WORKER */
async function loadVantaCatalog() {
  try {
    const res = await fetch(VANTA_API + "/api/products");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        liveCatalog = data.products;
      }
    }
  } catch (err) {
    console.warn("VANTA: Live Cloudflare API offline; using fallback catalog.", err);
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

/* MAIN INITIALIZATION */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  renderCartPage();
  renderCheckoutPage();
  loadVantaCatalog();
});
