
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
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.published === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "seller": { "@type": "Organization", "name": "XANTA", "url": "https://xanta.pages.dev/" },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "12.00",
          "currency": "USD"
        },
        "shippingDestination": [
          { "@type": "DefinedRegion", "addressCountry": "US" },
          { "@type": "DefinedRegion", "addressCountry": "GB" },
          { "@type": "DefinedRegion", "addressCountry": "CA" }
        ],
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 3,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 3,
            "maxValue": 7,
            "unitCode": "DAY"
          }
        }
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": ["US", "GB", "CA"],
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 14,
        "returnMethod": "https://schema.org/ReturnByMail",
        "returnFees": "https://schema.org/FreeReturn"
      }
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

/* --------------------------------------------------------------------------
   Live Price Sync (Shopping Bag / Checkout)
   Re-prices cart items against the database-backed catalog so the bag and
   checkout always show current selling prices instead of the snapshot that
   was captured when an item was first added.
   -------------------------------------------------------------------------- */
function syncCartPrices() {
  if (!liveCatalog.length) return;
  const cart = getCart();
  if (!cart.length) return;

  let changed = false;
  for (const item of cart) {
    const product = liveCatalog.find(p => String(p.id) === String(item.id));
    if (!product) continue;
    const livePrice = Number(product.price);
    if (Number.isFinite(livePrice) && livePrice > 0 && Number(item.price) !== livePrice) {
      item.price = livePrice;
      changed = true;
    }
  }
  if (changed) saveCart(cart);
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

  // Determine back view image if available
  let backImgUrl = "";
  if (Array.isArray(p.colourways) && p.colourways[0]?.images?.length > 1) {
    const backObj = p.colourways[0].images[1];
    backImgUrl = typeof backObj === "string" ? backObj : (backObj.url || backObj.src || "");
  } else if (Array.isArray(p.gallery) && p.gallery.length > 1) {
    const backObj = p.gallery[1];
    backImgUrl = typeof backObj === "string" ? backObj : (backObj.url || backObj.src || "");
  }
  if (backImgUrl && !backImgUrl.startsWith("http") && !backImgUrl.startsWith("/")) {
    backImgUrl = XANTA_API + backImgUrl;
  }

  const image = imgUrl
    ? (backImgUrl
        ? `<div class="card-visual"><img class="card-img-front" src="${escapeHtml(imgUrl)}" alt="${prodName} — Front View" loading="lazy" decoding="async" width="480" height="600"><img class="card-img-back" src="${escapeHtml(backImgUrl)}" alt="${prodName} — Back View" loading="lazy" decoding="async" width="480" height="600"></div>`
        : `<div class="card-visual"><img src="${escapeHtml(imgUrl)}" alt="${prodName}" loading="lazy" decoding="async" width="480" height="600"></div>`
      )
    : `<div class="card-visual"><div class="product-image-unavailable" aria-label="Product image unavailable">XANTA</div></div>`;

  const cws = Array.isArray(p.colourways) ? p.colourways : [];
  const coloursMarkup = cws.length > 1
    ? `<div class="card-colour-indicators" aria-label="${cws.length} available colours">
        ${cws.slice(0, 5).map(cw => `<a href="product.html?id=${encodeURIComponent(p.id)}&colour=${encodeURIComponent(cw.colour)}&view=front" class="card-colour-dot-link" aria-label="${escapeHtml(p.name)} in ${escapeHtml(cw.colour)}"><span class="card-colour-dot" style="background:${cw.hex || '#666'}" title="${escapeHtml(cw.colour || '')}"></span></a>`).join('')}
        ${cws.length > 5 ? `<span class="card-colour-more">+${cws.length - 5}</span>` : ''}
        <span class="card-colour-count">${cws.length} Colours</span>
       </div>`
    : (cws.length === 1 && cws[0]?.images?.length > 1 ? `<div class="card-colour-indicators"><span class="card-colour-count">Front &amp; Back Views</span></div>` : '');

  return `
    <article class="top-pick-card" data-product-id="${prodId}">
      <div class="card-top-row">
        <span class="card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
        <button type="button" class="wishlist-btn" aria-label="Add ${prodName} to wishlist" onclick="toggleWishlist(this, '${prodId}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>

      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-visual-link" aria-label="View ${prodName}">
        ${image}
      </a>

      <div class="card-details-row">
        <div class="card-meta">
          <h3 class="card-title"><a href="product.html?id=${encodeURIComponent(p.id)}">${prodName}</a></h3>
          ${coloursMarkup}
          <span class="card-price">${priceDisplay}</span>
        </div>
        <button type="button" class="btn-card-add-cart" onclick="window.location.href='product.html?id=${encodeURIComponent(p.id)}'" aria-label="Choose options for ${prodName}">
          <span>Options</span>
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
   Product Detail Page — Colourway-Specific Galleries & Front/Back Views
   -------------------------------------------------------------------------- */
function renderProductDetail() {
  const container = document.getElementById("product-detail");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || (liveCatalog[0] ? liveCatalog[0].id : null);
  const product = liveCatalog.find(p => String(p.id) === String(id));
  if (!product) {
    container.innerHTML = `<div style="grid-column:1/-1;padding:60px 0"><p class="eyebrow">PRODUCT NOT FOUND</p><a href="shop.html" class="btn-gold-pill">RETURN TO SHOP</a></div>`;
    return;
  }

  const titleEl = document.getElementById("detail-name");
  const typeEl = document.getElementById("detail-type");
  const descEl = document.getElementById("detail-description");
  const visualEl = document.getElementById("detail-visual");
  const viewTabsEl = document.getElementById("gallery-view-tabs");
  const thumbRow = document.getElementById("detail-thumbnails-row");
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
  const qtyInput = document.getElementById("detail-qty");

  if (titleEl) titleEl.textContent = product.name || "XANTA Essential";
  document.title = `${product.name || "XANTA Essential"} | XANTA`;
  injectProductSchema(product);
  const defaultColourName = product.colour || "Standard";
  if (descEl) descEl.textContent = product.description || "";

  // Helper: Announce updates to assistive screen readers
  function announceSr(message) {
    const sr = document.getElementById("gallery-sr-status");
    if (sr) {
      sr.textContent = "";
      setTimeout(() => { sr.textContent = message; }, 40);
    }
  }

  const resolveImageUrl = image => {
    if (!image) return "";
    if (typeof image === "string") {
      if (/^https?:\/\//i.test(image)) return image;
      return image.startsWith("/") ? image : `${XANTA_API}${image}`;
    }
    const direct = image.url || image.src;
    if (direct) {
      if (/^https?:\/\//i.test(direct)) return direct;
      return direct.startsWith("/") ? direct : `${XANTA_API}${direct}`;
    }
    const key = image.key || image.image_key;
    return key ? `${XANTA_API}/images/${encodeURIComponent(key)}` : "";
  };

  const normaliseImages = images => (Array.isArray(images) ? images : []).map((image, index) => {
    const object = typeof image === "string" ? { url: image } : (image || {});
    return {
      url: resolveImageUrl(object),
      label: object.label || (index === 0 ? "Front" : index === 1 ? "Back" : `Detail ${index + 1}`)
    };
  }).filter(image => image.url);

  let colourways = Array.isArray(product.colourways) && product.colourways.length
    ? product.colourways.filter(Boolean).map((cw, index) => ({
        id: cw.id || `${product.id}-colour-${index}`,
        colour: cw.colour || (index === 0 ? defaultColourName : `Option ${index + 1}`),
        hex: /^#[0-9a-f]{3,8}$/i.test(cw.hex || "") ? cw.hex : "",
        images: normaliseImages(cw.images && cw.images.length ? cw.images : (cw.image ? [cw.image] : []))
      }))
    : [];

  if (!colourways.length) {
    colourways = [{
      id: product.id,
      colour: defaultColourName,
      hex: "",
      images: normaliseImages(product.gallery?.length ? product.gallery : (product.image ? [{ url: product.image, label: "Front" }] : []))
    }];
  }

  /* --------------------------------------------------------------------------
     Colourway Selection & Persistence (URL query + localStorage)
     -------------------------------------------------------------------------- */
  const storageKey = `xanta_selected_colour_${product.id}`;
  const urlRequestedColour = (params.get("colour") || params.get("color") || "").trim().toLowerCase();
  let storedColour = "";
  try {
    if (window.localStorage && !urlRequestedColour) {
      storedColour = (window.localStorage.getItem(storageKey) || "").trim().toLowerCase();
    }
  } catch (e) {}

  const targetColour = urlRequestedColour || storedColour;
  let activeColourwayIndex = 0;
  if (targetColour) {
    const foundIdx = colourways.findIndex(cw =>
      cw.colour.toLowerCase() === targetColour ||
      cw.id.toLowerCase() === targetColour ||
      cw.colour.toLowerCase().includes(targetColour)
    );
    if (foundIdx >= 0) activeColourwayIndex = foundIdx;
  }

  let activeImageIndex = 0;
  let activeSize = "";
  let currentImages = [];
  let lastFocusedVisualElement = null;

  const getActiveColourway = () => colourways[activeColourwayIndex] || colourways[0];
  const getActiveImages = () => {
    const active = getActiveColourway();
    return (active && active.images && active.images.length)
      ? active.images
      : normaliseImages(product.gallery?.length ? product.gallery : (product.image ? [{ url: product.image, label: "Front" }] : []));
  };

  currentImages = getActiveImages();

  // Resolve initial view from URL parameter (?view=front or ?view=back or ?angle=back)
  const urlRequestedView = (params.get("view") || params.get("angle") || "").trim().toLowerCase();
  if (urlRequestedView && currentImages.length) {
    if (urlRequestedView === "back") {
      const backIdx = currentImages.findIndex(img => /back/i.test(img.label || ""));
      activeImageIndex = backIdx >= 0 ? backIdx : (currentImages.length > 1 ? 1 : 0);
    } else if (urlRequestedView === "front") {
      const frontIdx = currentImages.findIndex(img => /front/i.test(img.label || ""));
      activeImageIndex = frontIdx >= 0 ? frontIdx : 0;
    } else {
      const matchIdx = currentImages.findIndex(img => (img.label || "").toLowerCase().includes(urlRequestedView));
      if (matchIdx >= 0) {
        activeImageIndex = matchIdx;
      } else {
        const num = parseInt(urlRequestedView, 10);
        if (!isNaN(num) && num >= 0 && num < currentImages.length) {
          activeImageIndex = num;
        }
      }
    }
  }

  // Helper to keep browser URL in sync with active colourway and angle view
  function syncProductUrl() {
    if (!window.history || !window.history.replaceState) return;
    const currentCw = getActiveColourway();
    const currentImg = currentImages[activeImageIndex];
    const viewSlug = currentImg?.label ? currentImg.label.trim().toLowerCase() : "front";
    const colourParam = currentCw?.colour ? currentCw.colour : defaultColourName;
    const newUrl = `product.html?id=${encodeURIComponent(product.id)}&colour=${encodeURIComponent(colourParam)}&view=${encodeURIComponent(viewSlug)}`;
    window.history.replaceState(null, "", newUrl);
  }

  // Preload alternate angle(s) for the active colourway so mobile view switches are instantaneous
  function preloadAlternateAngles(images, activeIdx) {
    if (!Array.isArray(images) || images.length < 2) return;
    images.forEach((img, idx) => {
      if (idx !== activeIdx && img && img.url) {
        const preload = new Image();
        preload.decoding = "async";
        preload.src = img.url;
      }
    });
  }

  // Preload primary image for remaining colourways on idle to accelerate colourway switching on mobile
  function preloadOtherColourways(cws, currentCwIdx) {
    if (!Array.isArray(cws) || cws.length < 2) return;
    const timer = window.requestIdleCallback || (cb => setTimeout(cb, 900));
    timer(() => {
      cws.forEach((cw, idx) => {
        if (idx !== currentCwIdx && cw.images && cw.images[0] && cw.images[0].url) {
          const img = new Image();
          img.decoding = "async";
          img.src = cw.images[0].url;
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     Lightbox with Accessible Modal Dialog & Focus Trap
     -------------------------------------------------------------------------- */
  const ensureLightbox = () => {
    let dialog = document.getElementById("xanta-image-lightbox");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "xanta-image-lightbox";
    dialog.className = "xanta-image-lightbox";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Enlarged product image viewer");
    dialog.innerHTML = `
      <div id="lightbox-sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
      <button type="button" class="lightbox-close" aria-label="Close enlarged image viewer (Press Escape)">×</button>
      <button type="button" class="lightbox-arrow lightbox-prev" aria-label="View previous angle (Left Arrow)">‹</button>
      <div class="lightbox-img-wrap">
        <img class="lightbox-image" alt="XANTA product enlarged view">
      </div>
      <button type="button" class="lightbox-arrow lightbox-next" aria-label="View next angle (Right Arrow)">›</button>
      <p class="lightbox-caption" id="lightbox-caption" aria-live="polite"></p>`;
    document.body.appendChild(dialog);

    const closeBtn = dialog.querySelector(".lightbox-close");
    const prevBtn = dialog.querySelector(".lightbox-prev");
    const nextBtn = dialog.querySelector(".lightbox-next");

    function closeLightbox() {
      dialog.close();
      if (lastFocusedVisualElement && typeof lastFocusedVisualElement.focus === "function") {
        lastFocusedVisualElement.focus();
      }
    }

    closeBtn.addEventListener("click", closeLightbox);
    dialog.addEventListener("click", event => { if (event.target === dialog) closeLightbox(); });
    prevBtn.addEventListener("click", () => moveImage(-1));
    nextBtn.addEventListener("click", () => moveImage(1));

    // Keyboard trap and navigation within modal
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveImage(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveImage(1);
      } else if (event.key === "Tab") {
        const focusable = dialog.querySelectorAll("button:not([disabled])");
        if (focusable.length < 1) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    return dialog;
  };

  const updateLightbox = () => {
    const dialog = document.getElementById("xanta-image-lightbox");
    if (!dialog || !dialog.open) return;
    const image = currentImages[activeImageIndex];
    const activeCw = getActiveColourway();
    const colourText = activeCw?.colour || defaultColourName;
    const labelText = image?.label || "View";
    const img = dialog.querySelector(".lightbox-image");
    img.src = image?.url || "";
    img.alt = `Enlarged ${labelText} view of ${product.name || "XANTA product"} in ${colourText}`;
    const caption = `${colourText} · ${labelText} (${activeImageIndex + 1} of ${currentImages.length})`;
    dialog.querySelector(".lightbox-caption").textContent = caption;

    const lbSr = dialog.querySelector("#lightbox-sr-status");
    if (lbSr) {
      lbSr.textContent = `Viewing enlarged photo ${activeImageIndex + 1} of ${currentImages.length}: ${labelText} view of ${colourText}.`;
    }
  };

  function moveImage(direction, shouldAnnounce = true) {
    if (currentImages.length < 2) return;
    activeImageIndex = (activeImageIndex + direction + currentImages.length) % currentImages.length;
    syncProductUrl();
    updateVisualDisplay();
    updateLightbox();
    if (shouldAnnounce) {
      const activeCw = getActiveColourway();
      const currentImage = currentImages[activeImageIndex];
      announceSr(`Switched to ${currentImage?.label || 'angle'} view (${activeImageIndex + 1} of ${currentImages.length}) for ${activeCw?.colour}.`);
    }
  }

  // Touch swipe support on main image for mobile
  let touchStartX = 0;
  if (visualEl && !visualEl.dataset.swipeBound) {
    visualEl.dataset.swipeBound = "true";
    visualEl.addEventListener("touchstart", e => {
      if (e.changedTouches && e.changedTouches[0]) touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    visualEl.addEventListener("touchend", e => {
      if (e.changedTouches && e.changedTouches[0]) {
        const diff = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(diff) > 40) moveImage(diff < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  /* --------------------------------------------------------------------------
     Visual Display (Main Photo, View Tabs, Thumbnails)
     -------------------------------------------------------------------------- */
  function updateVisualDisplay() {
    const activeCw = getActiveColourway() || { colour: defaultColourName, images: [] };
    currentImages = getActiveImages();
    if (activeImageIndex >= currentImages.length) activeImageIndex = 0;
    syncProductUrl();
    preloadAlternateAngles(currentImages, activeImageIndex);
    preloadOtherColourways(colourways, activeColourwayIndex);
    const currentImage = currentImages[activeImageIndex];
    const isDarkColour = /black|charcoal|navy|midnight|dark/i.test(activeCw.colour || "");

    if (colourLabel) colourLabel.textContent = (activeCw.colour || defaultColourName).toUpperCase();
    if (typeEl) typeEl.textContent = `XANTA ESSENTIALS · ${(activeCw.colour || defaultColourName).toUpperCase()}`;

    // 1. Render Main Visual with accessible controls
    if (visualEl) {
      visualEl.className = `product-visual detail-visual ${isDarkColour ? "dark" : ""}`;
      const viewBadgeText = currentImage?.label ? `${currentImage.label.toUpperCase()} VIEW` : "STUDIO VIEW";
      visualEl.innerHTML = currentImage
        ? `
          <img class="detail-main-image" src="${escapeHtml(currentImage.url)}" alt="${escapeHtml(product.name || "XANTA product")} in ${escapeHtml(activeCw.colour || defaultColourName)} — ${escapeHtml(currentImage.label)} view" loading="eager" fetchpriority="high" decoding="async" width="1000" height="1200">
          <span class="gallery-view-label" aria-hidden="true">${escapeHtml(viewBadgeText)}</span>
          ${currentImages.length > 1 ? `
            <button type="button" class="gallery-arrow gallery-arrow-prev" aria-label="Previous product angle (${currentImages[(activeImageIndex - 1 + currentImages.length) % currentImages.length]?.label} view)">‹</button>
            <button type="button" class="gallery-arrow gallery-arrow-next" aria-label="Next product angle (${currentImages[(activeImageIndex + 1) % currentImages.length]?.label} view)">›</button>
            <span class="gallery-image-count" aria-label="Image ${activeImageIndex + 1} of ${currentImages.length}">${activeImageIndex + 1} / ${currentImages.length}</span>` : ""}
          <button type="button" class="gallery-zoom-btn" aria-label="Enlarge image of ${escapeHtml(product.name)} for closer inspection">＋</button>`
        : `<div class="product-image-unavailable" role="img" aria-label="Product image will be added">XANTA<span>PRODUCT IMAGE COMING SOON</span></div>`;

      const prev = visualEl.querySelector(".gallery-arrow-prev");
      const next = visualEl.querySelector(".gallery-arrow-next");
      if (prev) prev.addEventListener("click", () => moveImage(-1));
      if (next) next.addEventListener("click", () => moveImage(1));
      const zoom = visualEl.querySelector(".gallery-zoom-btn");
      if (zoom && currentImage) zoom.addEventListener("click", () => {
        lastFocusedVisualElement = zoom;
        const dialog = ensureLightbox();
        updateLightbox();
        if (!dialog.open) {
          dialog.showModal();
          dialog.querySelector(".lightbox-close")?.focus();
        }
      });
    }

    // 2. Render Dedicated View Selector Tabs with Full Keyboard Navigation
    if (viewTabsEl) {
      if (currentImages.length > 1) {
        viewTabsEl.innerHTML = currentImages.map((img, idx) => {
          const isSelected = idx === activeImageIndex;
          return `
            <button
              type="button"
              role="tab"
              class="gallery-view-tab ${isSelected ? 'active' : ''}"
              data-idx="${idx}"
              id="view-tab-${idx}"
              aria-controls="detail-visual"
              aria-selected="${isSelected}"
              tabindex="${isSelected ? '0' : '-1'}"
              aria-label="${escapeHtml(img.label)} view of ${escapeHtml(activeCw.colour)}${isSelected ? ', currently displayed' : ''}"
            >
              <svg class="view-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                ${idx === 0 ? '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="12" cy="10" r="3"></circle>' : '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>'}
              </svg>
              <span>${escapeHtml(img.label)} View</span>
            </button>
          `;
        }).join("");

        const tabs = viewTabsEl.querySelectorAll(".gallery-view-tab");
        tabs.forEach(tab => {
          tab.addEventListener("click", () => {
            const newImgIdx = Number(tab.dataset.idx) || 0;
            if (newImgIdx === activeImageIndex) return;
            activeImageIndex = newImgIdx;
            syncProductUrl();
            updateVisualDisplay();
            announceSr(`Showing ${currentImages[activeImageIndex]?.label} view of ${activeCw.colour}.`);
          });

          // WAI-ARIA roving tabindex keyboard navigation for tabs
          tab.addEventListener("keydown", event => {
            let targetIdx = null;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              targetIdx = (activeImageIndex + 1) % currentImages.length;
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              targetIdx = (activeImageIndex - 1 + currentImages.length) % currentImages.length;
            } else if (event.key === "Home") {
              event.preventDefault();
              targetIdx = 0;
            } else if (event.key === "End") {
              event.preventDefault();
              targetIdx = currentImages.length - 1;
            }
            if (targetIdx !== null) {
              activeImageIndex = targetIdx;
              syncProductUrl();
              updateVisualDisplay();
              const nextTab = viewTabsEl.querySelector(`.gallery-view-tab[data-idx="${targetIdx}"]`);
              if (nextTab) nextTab.focus();
              announceSr(`Showing ${currentImages[activeImageIndex]?.label} view of ${activeCw.colour}.`);
            }
          });
        });
        viewTabsEl.style.display = "flex";
      } else {
        viewTabsEl.innerHTML = "";
        viewTabsEl.style.display = "none";
      }
    }

    // 3. Render High-Resolution Thumbnail Strip with Full Keyboard Navigation
    if (thumbRow) {
      if (currentImages.length > 1) {
        thumbRow.innerHTML = currentImages.map((image, index) => {
          const isSelected = index === activeImageIndex;
          return `
            <button
              type="button"
              class="detail-thumb-btn ${isSelected ? "active" : ""}"
              data-idx="${index}"
              id="thumb-btn-${index}"
              aria-pressed="${isSelected}"
              aria-current="${isSelected ? 'true' : 'false'}"
              tabindex="${isSelected ? '0' : '-1'}"
              aria-label="Thumbnail ${index + 1} of ${currentImages.length}: ${escapeHtml(image.label)} view of ${escapeHtml(activeCw.colour)}${isSelected ? ', currently displayed' : ''}"
            >
              <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.label)} view of ${escapeHtml(activeCw.colour)}" loading="lazy" width="100" height="120">
              <span class="detail-thumb-caption" aria-hidden="true">${escapeHtml(image.label)}</span>
            </button>
          `;
        }).join("");

        const thumbBtns = thumbRow.querySelectorAll(".detail-thumb-btn");
        thumbBtns.forEach(button => {
          button.addEventListener("click", () => {
            const newImgIdx = Number(button.dataset.idx) || 0;
            if (newImgIdx === activeImageIndex) return;
            activeImageIndex = newImgIdx;
            syncProductUrl();
            updateVisualDisplay();
            announceSr(`Displaying ${currentImages[activeImageIndex]?.label} view (${activeImageIndex + 1} of ${currentImages.length}) of ${activeCw.colour}.`);
          });

          button.addEventListener("keydown", event => {
            let targetIdx = null;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              targetIdx = (activeImageIndex + 1) % currentImages.length;
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              targetIdx = (activeImageIndex - 1 + currentImages.length) % currentImages.length;
            } else if (event.key === "Home") {
              event.preventDefault();
              targetIdx = 0;
            } else if (event.key === "End") {
              event.preventDefault();
              targetIdx = currentImages.length - 1;
            }
            if (targetIdx !== null) {
              activeImageIndex = targetIdx;
              syncProductUrl();
              updateVisualDisplay();
              const nextThumb = thumbRow.querySelector(`.detail-thumb-btn[data-idx="${targetIdx}"]`);
              if (nextThumb) nextThumb.focus();
              announceSr(`Displaying ${currentImages[activeImageIndex]?.label} view (${activeImageIndex + 1} of ${currentImages.length}) of ${activeCw.colour}.`);
            }
          });
        });
        thumbRow.style.display = "flex";
      } else {
        thumbRow.innerHTML = "";
        thumbRow.style.display = "none";
      }
    }
    updateLightbox();
  }

  /* --------------------------------------------------------------------------
     Colourway Selector with State Persistence & Accessible Radiogroup
     -------------------------------------------------------------------------- */
  function selectColourway(newIdx, shouldFocus = false) {
    if (newIdx < 0 || newIdx >= colourways.length) return;
    if (newIdx === activeColourwayIndex && shouldFocus) {
      const activeBtn = colourRow?.querySelector(`.colour-pill[data-cw-idx="${newIdx}"]`);
      if (activeBtn) activeBtn.focus();
      return;
    }

    const prevImage = currentImages[activeImageIndex];
    const prevLabel = prevImage?.label ? prevImage.label.trim().toLowerCase() : "";

    activeColourwayIndex = newIdx;
    const currentCw = getActiveColourway();

    // Persist to localStorage so selection is restored when returning to product
    try {
      if (window.localStorage && currentCw) {
        window.localStorage.setItem(storageKey, currentCw.colour);
      }
    } catch (e) {}

    const newImages = getActiveImages();
    currentImages = newImages;

    // Preserve active angle view if available in the new colourway (e.g. Back view remains on Back view)
    if (prevLabel) {
      const matchIdx = newImages.findIndex(img => (img.label || "").trim().toLowerCase() === prevLabel);
      if (matchIdx >= 0) {
        activeImageIndex = matchIdx;
      } else if (activeImageIndex >= newImages.length) {
        activeImageIndex = 0;
      }
    } else if (activeImageIndex >= newImages.length) {
      activeImageIndex = 0;
    }

    // Persist to URL parameter with both colourway and view angle
    syncProductUrl();

    renderColourPills(shouldFocus);
    updateVisualDisplay();

    const viewName = newImages[activeImageIndex]?.label || "Front";
    announceSr(`Selected ${currentCw.colour} colourway (${newImages.length} angle view${newImages.length > 1 ? 's' : ''}). Displaying ${viewName} view.`);
  }

  function renderColourPills(focusActive = false) {
    if (!colourRow) return;
    if (colourways.length > 1) {
      colourRow.innerHTML = colourways.map((cw, index) => {
        const bg = cw.hex || (/white|cream|ivory/i.test(cw.colour) ? "#f4f1eb" : (/blue|navy/i.test(cw.colour) ? "#273b59" : (/brown|mocha/i.test(cw.colour) ? "#72513b" : (/grey|gray/i.test(cw.colour) ? "#858585" : (/black|charcoal/i.test(cw.colour) ? "#171717" : "#777777")))));
        const viewCount = cw.images?.length || 1;
        const viewNote = viewCount > 1 ? `${viewCount} views available` : "1 view available";
        const isSelected = index === activeColourwayIndex;
        return `
          <button
            type="button"
            role="radio"
            class="colour-pill ${isSelected ? "active" : ""}"
            data-cw-idx="${index}"
            id="colour-pill-${index}"
            aria-checked="${isSelected}"
            tabindex="${isSelected ? "0" : "-1"}"
            aria-label="${escapeHtml(cw.colour)} colourway, ${viewNote}${isSelected ? ", currently selected" : ""}"
          >
            <span class="colour-swatch" style="background:${bg}" aria-hidden="true"></span>
            <span>${escapeHtml(cw.colour)}</span>
          </button>
        `;
      }).join("");

      const pills = colourRow.querySelectorAll(".colour-pill");
      pills.forEach(pill => {
        pill.addEventListener("click", () => {
          const newIdx = Number(pill.dataset.cwIdx) || 0;
          selectColourway(newIdx, false);
        });

        // WAI-ARIA roving tabindex keyboard navigation for radio group
        pill.addEventListener("keydown", event => {
          let targetIdx = null;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            targetIdx = (activeColourwayIndex + 1) % colourways.length;
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            targetIdx = (activeColourwayIndex - 1 + colourways.length) % colourways.length;
          } else if (event.key === "Home") {
            event.preventDefault();
            targetIdx = 0;
          } else if (event.key === "End") {
            event.preventDefault();
            targetIdx = colourways.length - 1;
          }
          if (targetIdx !== null) {
            selectColourway(targetIdx, true);
          }
        });
      });

      if (focusActive) {
        const activePill = colourRow.querySelector(`.colour-pill[data-cw-idx="${activeColourwayIndex}"]`);
        if (activePill) activePill.focus();
      }
    } else {
      const singleCw = colourways[0] || { colour: defaultColourName, hex: "" };
      const bg = singleCw.hex || "#6b829e";
      colourRow.innerHTML = `
        <div class="single-colour-pill" role="status" aria-label="Only colourway available: ${escapeHtml(singleCw.colour)}">
          <span class="colour-swatch" style="background:${bg}" aria-hidden="true"></span>
          <span>${escapeHtml(singleCw.colour)}</span>
        </div>`;
    }
  }

  // Initial render of colourways and visual
  renderColourPills();
  updateVisualDisplay();

  /* --------------------------------------------------------------------------
     Shareable Product Link Handler (Preserves active colourway and angle view)
     -------------------------------------------------------------------------- */
  const shareBtn = document.getElementById("btn-share-product");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      syncProductUrl();
      const currentCw = getActiveColourway();
      const currentImg = currentImages[activeImageIndex];
      const viewLabel = currentImg?.label || "Front";
      const shareTitle = `${product.name || "XANTA Product"} — ${currentCw?.colour || defaultColourName} (${viewLabel} View) | XANTA`;
      const shareUrl = window.location.href;

      let shared = false;
      if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
        try {
          await navigator.share({
            title: shareTitle,
            text: `Check out ${product.name || "XANTA product"} in ${currentCw?.colour || defaultColourName} on XANTA.`,
            url: shareUrl
          });
          shared = true;
        } catch (_) {}
      }

      if (!shared && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          shared = true;
        } catch (_) {}
      }

      const labelEl = document.getElementById("share-btn-label");
      const prevText = labelEl ? labelEl.textContent : "Share View";
      if (labelEl) labelEl.textContent = "Link Copied ✓";
      shareBtn.classList.add("copied");
      shareBtn.setAttribute("aria-label", `Link copied to clipboard: ${product.name} in ${currentCw?.colour || defaultColourName}, ${viewLabel} view`);
      announceSr(`Shareable link copied to clipboard: ${product.name} in ${currentCw?.colour || defaultColourName}, ${viewLabel} view.`);

      setTimeout(() => {
        if (labelEl) labelEl.textContent = prevText;
        shareBtn.classList.remove("copied");
        shareBtn.setAttribute("aria-label", "Copy shareable link for this product colourway and angle view");
      }, 2400);
    });
  }

  /* --------------------------------------------------------------------------
     Size Selection & Form Handling
     -------------------------------------------------------------------------- */
  const rawSizes = (Array.isArray(product.sizes) && product.sizes.length
    ? product.sizes
    : [{ size: "M", price: product.price }]
  ).map(entry => (entry && typeof entry === "object"
    ? { size: entry.size, price: Number(entry.price || product.price) }
    : { size: String(entry), price: Number(product.price) }));
  const seenSizes = new Set();
  const uniqueSizes = rawSizes.filter(size => {
    const value = String(size.size || "").trim();
    if (!value || seenSizes.has(value)) return false;
    seenSizes.add(value);
    return true;
  });

  if (sizeSelect) {
    sizeSelect.innerHTML = uniqueSizes.map(size =>
      `<option value="${escapeHtml(size.size)}" data-price="${Number(size.price || product.price)}">${escapeHtml(size.size)} — $${Number(size.price || product.price).toFixed(2)}</option>`
    ).join("");
  }

  if (sizePillsContainer) {
    sizePillsContainer.setAttribute("role", "radiogroup");
    sizePillsContainer.setAttribute("aria-label", "Select garment size");
    sizePillsContainer.innerHTML = uniqueSizes.map((size, index) => `
      <button
        type="button"
        role="radio"
        class="size-pill ${index === 0 ? "active" : ""}"
        data-size="${escapeHtml(size.size)}"
        data-price="${Number(size.price || product.price)}"
        aria-checked="${index === 0}"
        tabindex="${index === 0 ? "0" : "-1"}"
        aria-label="Size ${escapeHtml(size.size)}, price $${Number(size.price || product.price).toFixed(2)}${index === 0 ? ", selected" : ""}"
      >
        ${escapeHtml(size.size)}
      </button>`).join("");

    const sizeBtns = sizePillsContainer.querySelectorAll(".size-pill");
    sizeBtns.forEach((button, bIdx) => {
      button.addEventListener("click", () => {
        sizeBtns.forEach((item, i) => {
          const selected = item === button;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-checked", String(selected));
          item.setAttribute("tabindex", selected ? "0" : "-1");
        });
        activeSize = button.dataset.size;
        if (sizeSelect) sizeSelect.value = activeSize;
        if (sizeLabel) sizeLabel.textContent = activeSize;
        if (priceEl) priceEl.textContent = `$${Number(button.dataset.price).toFixed(2)}`;
        if (sizeNoteEl) sizeNoteEl.textContent = "";
        announceSr(`Selected size ${activeSize}. Price: $${Number(button.dataset.price).toFixed(2)}.`);
      });

      button.addEventListener("keydown", event => {
        let targetIdx = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          targetIdx = (bIdx + 1) % sizeBtns.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          targetIdx = (bIdx - 1 + sizeBtns.length) % sizeBtns.length;
        }
        if (targetIdx !== null) {
          sizeBtns[targetIdx].click();
          sizeBtns[targetIdx].focus();
        }
      });
    });
  }

  if (uniqueSizes.length) {
    activeSize = String(uniqueSizes[0].size);
    if (sizeLabel) sizeLabel.textContent = activeSize;
    if (priceEl) priceEl.textContent = `$${Number(uniqueSizes[0].price || product.price).toFixed(2)}`;
  } else if (priceEl) {
    priceEl.textContent = `$${Number(product.price).toFixed(2)}`;
  }

  if (featuresEl) {
    const details = Array.isArray(product.details) ? product.details : [];
    featuresEl.innerHTML = details.length ? details.map(detail => `<li>${escapeHtml(detail)}</li>`).join("") : "<li>Premium everyday construction</li><li>Relaxed XANTA silhouette</li>";
  }
  if (careEl) {
    const care = Array.isArray(product.care) ? product.care : [];
    careEl.innerHTML = care.length ? care.map(item => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Machine wash cold inside out</li><li>Hang dry recommended</li>";
  }

  const minus = document.getElementById("qty-minus");
  const plus = document.getElementById("qty-plus");
  if (qtyInput) qtyInput.value = "1";
  if (minus && qtyInput) minus.onclick = () => { qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1); };
  if (plus && qtyInput) plus.onclick = () => { qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1); };

  if (btnAdd) btnAdd.onclick = () => {
    const selectedSize = sizePillsContainer?.querySelector(".size-pill.active")?.dataset.size || sizeSelect?.value || activeSize;
    const selected = uniqueSizes.find(size => String(size.size) === String(selectedSize));
    if (!selected) {
      if (sizeNoteEl) sizeNoteEl.textContent = "Please select an available size.";
      return;
    }
    const activeCw = getActiveColourway();
    const currentImage = activeCw?.images?.[0]?.url || product.image || null;
    addToCart({
      id: product.id,
      name: product.name,
      category: product.category || "",
      colour: activeCw?.colour || defaultColourName,
      size: selected.size,
      price: Number(selected.price || product.price),
      image: currentImage,
      quantity: Math.max(1, Math.min(99, parseInt(qtyInput?.value, 10) || 1))
    });
  };

  if (relatedEl) relatedEl.innerHTML = liveCatalog.filter(candidate => candidate.id !== product.id).slice(0, 4).map(productCard).join("");
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

  const paymentParams = new URLSearchParams(window.location.search);
  const paymentState = paymentParams.get("payment");
  const returnedOrder = paymentParams.get("order");
  if (paymentState === "success" && returnedOrder) {
    document.getElementById("checkout-content").innerHTML = '<div class="confirmation-card"><p class="eyebrow">XANTA / PAYMENT</p><h2>VERIFYING PAYMENT…</h2><p style="color:var(--muted)">Please wait while we confirm your payment securely.</p></div>';
    fetch(XANTA_API + "/api/checkout/status?order=" + encodeURIComponent(returnedOrder))
      .then(r => r.json().then(d => ({ok:r.ok,data:d})))
      .then(({ok,data}) => {
        if (!ok || !data.ok) throw new Error(data.error || "We could not verify this payment yet.");
        if (data.order.status === "paid") {
          localStorage.removeItem(CART_STORAGE_KEY); updateCartCount();
          document.getElementById("checkout-content").innerHTML = '<div class="confirmation-card"><p class="eyebrow">PAYMENT VERIFIED</p><h2>THANK YOU FOR YOUR ORDER.</h2><p style="color:var(--muted)">Your payment has been confirmed by Monime. Your XANTA order reference is:</p><div class="order-badge">' + escapeHtml(data.order.reference) + '</div><p>Total paid: $' + Number(data.order.total).toFixed(2) + ' USD</p><p style="color:var(--muted)">We will use your delivery details to process your order.</p><a href="shop.html" class="button button-dark">CONTINUE SHOPPING ↗</a></div>';
        } else {
          document.getElementById("checkout-content").innerHTML = '<div class="confirmation-card"><p class="eyebrow">PAYMENT PENDING</p><h2>WE ARE STILL CONFIRMING.</h2><p style="color:var(--muted)">Your order is not marked as paid yet. Please wait a moment and refresh this page. Do not pay again unless Monime shows the first attempt failed.</p><div class="order-badge">' + escapeHtml(data.order.reference) + '</div><button class="button button-dark" onclick="location.reload()">CHECK PAYMENT STATUS</button></div>';
        }
      }).catch(error => { document.getElementById("checkout-content").innerHTML = '<div class="confirmation-card"><h2>PAYMENT STATUS UNAVAILABLE</h2><p>' + escapeHtml(error.message) + '</p><button class="button button-dark" onclick="location.reload()">TRY AGAIN</button></div>'; });
    return;
  }
  if (paymentState === "cancelled") {
    document.getElementById("checkout-content").insertAdjacentHTML("afterbegin", '<div class="confirmation-card"><p class="eyebrow">PAYMENT NOT COMPLETED</p><h2>YOUR CART IS SAVED.</h2><p style="color:var(--muted)">Your payment was cancelled or not completed. You can try again below.</p></div>');
  }
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

  // Create a server-priced Monime checkout session; never mark orders paid in the browser.
  const form = document.getElementById("checkout-form");
  if (form) {
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = "CONNECTING TO MONIME…"; }
      const showError = message => {
        let box = document.getElementById("checkout-payment-error");
        if (!box) { box = document.createElement("p"); box.id = "checkout-payment-error"; box.setAttribute("role","alert"); box.style.cssText = "color:#b42318;margin:12px 0;font-size:13px"; form.querySelector(".checkout-section:last-child")?.prepend(box); }
        box.textContent = message;
      };
      try {
        const response = await fetch(XANTA_API + "/api/checkout/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: getCart().map(item => ({ id:item.id, size:item.size, colour:item.colour, quantity:item.quantity })),
            shippingMethod: document.getElementById("shipping-express")?.checked ? "express" : "standard",
            customer: {
              email: document.getElementById("cust-email").value.trim(),
              phone: document.getElementById("cust-phone").value.trim(),
              firstName: document.getElementById("cust-fname").value.trim(),
              lastName: document.getElementById("cust-lname").value.trim(),
              address: document.getElementById("cust-address").value.trim(),
              city: document.getElementById("cust-city").value.trim(),
              zip: document.getElementById("cust-zip").value.trim(),
              country: document.getElementById("cust-country").value
            }
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok || !result.redirectUrl) throw new Error(result.error || "Could not start Monime checkout.");
        window.location.assign(result.redirectUrl);
      } catch (error) {
        showError(error.message || "Payment could not be started. Your cart has been saved.");
        if (button) { button.disabled = false; button.textContent = button.dataset.originalText || "PAY SECURELY WITH MONIME ↗"; }
      }
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

  // Keep the shopping bag and checkout on current database pricing
  syncCartPrices();
  renderCartPage();
  renderCheckoutPage();

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
