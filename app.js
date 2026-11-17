
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
   Screen-reader announcer
   --------------------------------------------------------------------------
   A single polite live region for the whole page. Messages are cleared and
   re-set so repeated identical messages are still announced.
   -------------------------------------------------------------------------- */
function announce(message) {
  const region = document.getElementById("xanta-announcer");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => { region.textContent = message; }, 50);
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
  const live = document.getElementById("xanta-announcer");
  if (live) {
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = count === 1 ? "1 item in your bag." : `${count} items in your bag.`;
    }, 50);
  }
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
  document.querySelectorAll("#cart-count, .cart-count-badge, .bottom-cart-badge, #cart-count-badge")
    .forEach(badge => badge.dispatchEvent(new CustomEvent("xanta:bump")));
  renderCartPage();

  window.dispatchEvent(new CustomEvent("xanta:cart-updated", { detail: { item, cart } }));
  if (window.XANTAReformia && typeof window.XANTAReformia.openCartDrawer === "function") {
    window.XANTAReformia.openCartDrawer();
  }
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
/* --------------------------------------------------------------------------
   Product Card Component — the archive "lot" card
   --------------------------------------------------------------------------
   A card is one archive lot: a numbered lot label, the garment on a light
   specimen panel, and a strip of real colour swatches that swaps the garment
   image in place so shoppers can browse colourways without leaving the grid.
   -------------------------------------------------------------------------- */
function productCard(p, options) {
  const opts = options || {};
  const prodId = escapeHtml(p.id);
  const prodName = escapeHtml(p.name || "XANTA Product");
  const isLead = !!opts.lead;

  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const firstSize = sizes.find(s => s && typeof s === "object" && Number(s.price) > 0);
  const price = Number(p.price || firstSize?.price);
  const priceDisplay = Number.isFinite(price) && price > 0 ? `$${price.toFixed(2)}` : "View product";

  const cws = Array.isArray(p.colourways) ? p.colourways : [];
  const lotCode = `LOT ${String(p.sort_order || 0).padStart(2, "0")}`;
  const badgeText = p.featured ? `${lotCode} · FEATURED` : lotCode;
  const badgeClass = p.featured ? "badge-seller" : "badge-new";

  const resolve = url => (!url ? "" : (url.startsWith("http") || url.startsWith("/") ? url : XANTA_API + url));
  const imageAt = (cw, index) => {
    const imgs = (cw && cw.images) || [];
    const im = imgs[index];
    if (!im) return "";
    return typeof im === "string" ? im : (im.url || im.src || "");
  };

  const frontUrl = resolve(imageAt(cws[0], 0) || p.image || "");
  const backUrl = resolve(imageAt(cws[0], 1));

  // The lead card is above the fold, so it loads eagerly; everything else waits.
  const loadAttrs = isLead
    ? 'loading="eager" fetchpriority="high"'
    : 'loading="lazy" fetchpriority="low"';

  const image = frontUrl
    ? `<div class="card-visual" data-lot-panel>
         <img class="card-img-front" data-lot-front src="${escapeHtml(frontUrl)}" alt="${prodName} — front view" ${loadAttrs} decoding="async" width="800" height="1000">
         ${backUrl ? `<img class="card-img-back" data-lot-back src="${escapeHtml(backUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async" width="800" height="1000">` : ""}
       </div>`
    : `<div class="card-visual"><div class="product-image-unavailable" role="img" aria-label="Product image unavailable">XANTA</div></div>`;

  const lotStrip = cws.length
    ? `<div class="lot-strip" role="group" aria-label="Colours for ${prodName}">
         ${cws.map((cw, i) => `
           <button type="button" class="lot-swatch" style="--swatch:${escapeHtml(cw.hex || "#777777")}"
                   data-lot-index="${i}" data-product-id="${prodId}"
                   aria-pressed="${i === 0}"
                   aria-label="${escapeHtml(cw.colour || `Colour ${i + 1}`)}"><span class="sr-only">${escapeHtml(cw.colour || "")}</span></button>`).join("")}
       </div>`
    : "";

  return `
    <article class="top-pick-card" data-reveal="up" data-product-id="${prodId}">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-visual-link" aria-label="View ${prodName}, ${escapeHtml(priceDisplay)}">
        ${image}
      </a>
      <div class="card-details-row">
        <div class="card-meta">
          <h3 class="card-title"><a href="product.html?id=${encodeURIComponent(p.id)}">${prodName}</a></h3>
          <span class="card-price">${priceDisplay}</span>
        </div>
      </div>
      ${lotStrip}
    </article>`;
}

/* --------------------------------------------------------------------------
   Lot Strip — swap the garment image when a colour swatch is chosen
   -------------------------------------------------------------------------- */
function handleLotSwatch(event) {
  const swatch = event.target.closest(".lot-swatch");
  if (!swatch) return;

  const card = swatch.closest(".top-pick-card");
  if (!card) return;

  const productId = swatch.getAttribute("data-product-id");
  const index = Number(swatch.getAttribute("data-lot-index"));
  const product = liveCatalog.find(p => String(p.id) === productId);
  const colourway = product && (product.colourways || [])[index];
  if (!colourway) return;

  card.querySelectorAll(".lot-swatch").forEach(el => {
    el.setAttribute("aria-pressed", String(el === swatch));
  });

  const label = card.querySelector("[data-lot-label]");
  if (label) label.textContent = colourway.colour || "";

  const imageAt = (cw, i) => {
    const imgs = (cw && cw.images) || [];
    const im = imgs[i];
    if (!im) return "";
    return typeof im === "string" ? im : (im.url || im.src || "");
  };
  const resolve = url => (!url ? "" : (url.startsWith("http") || url.startsWith("/") ? url : XANTA_API + url));

  const front = card.querySelector("[data-lot-front]");
  const back = card.querySelector("[data-lot-back]");
  const nextFront = resolve(imageAt(colourway, 0));
  const nextBack = resolve(imageAt(colourway, 1));

  if (front && nextFront) front.src = nextFront;
  if (back) {
    if (nextBack) {
      back.src = nextBack;
      back.style.display = "";
    } else {
      back.style.display = "none";
    }
  }

  announce(`${product.name} — ${colourway.colour} selected.`);
}

function quickAddToCart(productId) {
  window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
}

function toggleWishlist(btn, productId) {
  const active = btn.classList.toggle("active");
  btn.setAttribute("aria-pressed", String(active));
  const svg = btn.querySelector("svg");
  if (svg) {
    svg.setAttribute("fill", active ? "var(--oxide)" : "none");
    svg.setAttribute("stroke", active ? "var(--oxide)" : "currentColor");
  }
  const label = btn.getAttribute("aria-label") || "";
  btn.setAttribute("aria-label", active ? label.replace(/^Save /, "Remove ") : label.replace(/^Remove /, "Save "));
  announce(active ? "Saved to your wishlist." : "Removed from your wishlist.");
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
  const bcEl = document.getElementById("breadcrumb-product-name");
  if (bcEl) bcEl.textContent = (product.name || "Product").toUpperCase();
  if (typeEl) typeEl.textContent = `XANTA // DROP 01 · ${product.category || "ESSENTIALS"}`;
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
  if (minus && qtyInput) minus.onclick = () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
    announce(`Quantity ${qtyInput.value}`);
  };
  if (plus && qtyInput) plus.onclick = () => {
    qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
    announce(`Quantity ${qtyInput.value}`);
  };

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

  if (relatedEl) {
    if (window.XANTAReformia && typeof window.XANTAReformia.renderProductCard === "function") {
      relatedEl.innerHTML = liveCatalog.filter(candidate => candidate.id !== product.id).slice(0, 4).map(p => window.XANTAReformia.renderProductCard(p)).join("");
    } else {
      relatedEl.innerHTML = liveCatalog.filter(candidate => candidate.id !== product.id).slice(0, 4).map(p => productCard(p)).join("");
    }
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
      <div class="cart-empty">
        <div class="cart-empty-mark" aria-hidden="true">X</div>
        <h2 class="cart-empty-title">Your bag is empty</h2>
        <p class="cart-empty-text">Edition 001 is five pieces in 280&ndash;420 GSM cotton. Choose a lot and it will appear here with your size and colour.</p>
        <a href="shop.html" class="btn-gold-pill">Shop the collection</a>
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

  const img = document.getElementById("hero-showcase-img");
  const placeholder = document.getElementById("hero-showcase-placeholder");
  const badge = document.getElementById("hero-showcase-badge");
  const footerTag = document.getElementById("hero-footer-tag");

  const heroKey = (settings && settings.hero_image_key) || "";
  let heroUrl = (settings && settings.hero_image_url) || null;
  let heroTitle = (settings && settings.hero_title) || "EDITION 001";
  let heroBadge = (settings && settings.hero_badge) || "LIMITED RUN // 280 GSM";

  // Resolve which lot the hero is showing so the swatch strip stays in sync.
  let heroProduct = null;
  if (Array.isArray(liveCatalog)) {
    if (heroKey) {
      const encoded = encodeURIComponent(heroKey);
      heroProduct = liveCatalog.find(p => (p.image || "").includes(encoded)) || null;
    }
    if (!heroProduct) {
      heroProduct = liveCatalog.find(p => p.featured && p.image)
        || liveCatalog.find(p => p.image)
        || null;
    }
  }
  if (!heroUrl && heroProduct) heroUrl = heroProduct.image;

  if (img) {
    if (heroUrl) {
      img.src = heroUrl;
      img.alt = `${heroTitle} — XANTA Edition 001`;
      img.hidden = false;
      if (placeholder) placeholder.hidden = true;
    } else {
      img.hidden = true;
      if (placeholder) placeholder.hidden = false;
    }
  }
  if (badge) badge.textContent = heroTitle;
  if (footerTag) footerTag.textContent = heroBadge;

  renderHeroLots(heroProduct);
}

/* --------------------------------------------------------------------------
   Hero Lot Strip — the archive colourway rail beneath the specimen stage
   -------------------------------------------------------------------------- */
function renderHeroLots(product) {
  const row = document.getElementById("hero-lot-row");
  if (!row) return;

  const cws = (product && product.colourways) || [];
  if (!cws.length) {
    row.innerHTML = "";
    return;
  }

  row.innerHTML = cws.map((cw, i) => `
    <button type="button" class="lot-swatch" style="--swatch:${escapeHtml(cw.hex || "#777777")}"
            data-hero-lot="${i}" data-product-id="${escapeHtml(product.id)}"
            aria-pressed="${i === 0}" aria-label="Show ${escapeHtml(cw.colour || `colour ${i + 1}`)}">
      <span class="sr-only">${escapeHtml(cw.colour || "")}</span>
    </button>`).join("")
    + `<span class="hero-lot-caption">${cws.length} colour lots</span>`;
}

function handleHeroLotSwatch(event) {
  const swatch = event.target.closest("[data-hero-lot]");
  if (!swatch) return;

  const productId = swatch.getAttribute("data-product-id");
  const index = Number(swatch.getAttribute("data-hero-lot"));
  const product = liveCatalog.find(p => String(p.id) === productId);
  const colourway = product && (product.colourways || [])[index];
  if (!colourway) return;

  const imgs = colourway.images || [];
  const first = imgs[0];
  const url = typeof first === "string" ? first : (first?.url || first?.src || "");
  if (!url) return;

  document.querySelectorAll("[data-hero-lot]").forEach(el => {
    el.setAttribute("aria-pressed", String(el === swatch));
  });

  const img = document.getElementById("hero-showcase-img");
  if (img) {
    img.classList.add("is-swapping");
    window.setTimeout(() => { img.src = url; }, 140);
    window.setTimeout(() => { img.classList.remove("is-swapping"); }, 460);
  }

  announce(`${product.name} — ${colourway.colour} selected.`);
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
        const countEl = document.getElementById("hero-piece-count");
        if (countEl) countEl.textContent = String(liveCatalog.length);
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
    const toShow = liveCatalog;
    if (toShow.length) {
      featuredContainer.innerHTML = toShow.map(p => productCard(p, { lead: false })).join("");
      if (window.XANTAMotion) window.XANTAMotion.refresh();
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
      allProductsContainer.innerHTML = liveCatalog.map((p, i) => productCard(p, { lead: i === 0 })).join("");
      if (window.XANTAMotion) window.XANTAMotion.refresh();
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

  // Related products render last, so let the motion layer pick them up too.
  if (window.XANTAMotion) window.XANTAMotion.refresh();
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

  // Lot strips swap the garment image in place (delegated so it survives re-renders)
  document.addEventListener("click", handleLotSwatch);
  document.addEventListener("click", handleHeroLotSwatch);

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  renderCartPage();
  renderCheckoutPage();
  loadVantaCatalog();
});
