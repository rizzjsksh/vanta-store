/* ==========================================================================
   XANTA — REFORMIA THEME CLIENT CONTROLLER
   ========================================================================== */

(function () {
  "use strict";

  const XANTA_API = "https://vanta-api.rizzify.workers.dev";
  let allProducts = [];

  // DOM Elements
  const newArrivalsGrid = document.getElementById("new-arrivals-grid");
  const bottomsGrid = document.getElementById("bottoms-grid");
  const categoryProductsGrid = document.getElementById("category-products-grid");
  const categoryTabs = document.querySelectorAll(".category-tab");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const headerNav = document.getElementById("header-nav");

  // Cart Drawer Elements
  const cartDrawerBtn = document.getElementById("cart-drawer-btn");
  const cartDrawer = document.getElementById("cart-drawer");
  const cartDrawerOverlay = document.getElementById("cart-drawer-overlay");
  const cartDrawerClose = document.getElementById("cart-drawer-close");
  const cartDrawerItems = document.getElementById("cart-drawer-items");
  const cartCountBadge = document.getElementById("cart-count-badge");
  const drawerItemCount = document.getElementById("drawer-item-count");
  const drawerSubtotal = document.getElementById("drawer-subtotal");
  const shippingProgressBar = document.getElementById("shipping-progress-bar");
  const shippingNoticeText = document.getElementById("shipping-notice-text");

  // Search Modal Elements
  const searchTrigger = document.getElementById("search-trigger");
  const searchModal = document.getElementById("search-modal");
  const searchModalOverlay = document.getElementById("search-modal-overlay");
  const searchModalClose = document.getElementById("search-modal-close");
  const catalogSearchInput = document.getElementById("catalog-search-input");
  const searchResultsBox = document.getElementById("search-results-box");

  /* --------------------------------------------------------------------------
     Cart Management Helper
     -------------------------------------------------------------------------- */
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("xanta_cart") || "[]");
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem("xanta_cart", JSON.stringify(cart));
    updateCartDrawer();
  }

  function updateCartDrawer() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1), 0);

    if (cartCountBadge) cartCountBadge.textContent = count;
    if (drawerItemCount) drawerItemCount.textContent = count;
    if (drawerSubtotal) drawerSubtotal.textContent = `$${subtotal.toFixed(2)}`;

    // Free shipping threshold ($100)
    const threshold = 100;
    const progress = Math.min(100, Math.round((subtotal / threshold) * 100));
    if (shippingProgressBar) shippingProgressBar.style.width = `${progress}%`;
    if (shippingNoticeText) {
      if (subtotal >= threshold) {
        shippingNoticeText.textContent = "🎉 You've unlocked Free Priority Shipping!";
      } else {
        const remaining = (threshold - subtotal).toFixed(2);
        shippingNoticeText.textContent = `Add $${remaining} more for Free Priority Shipping`;
      }
    }

    if (!cartDrawerItems) return;

    if (cart.length === 0) {
      cartDrawerItems.innerHTML = '<p class="cart-empty-message">Your shopping bag is currently empty.</p>';
      return;
    }

    cartDrawerItems.innerHTML = cart
      .map((item, index) => {
        const itemTotal = ((Number(item.price) || 0) * (item.quantity || 1)).toFixed(2);
        const imgUrl = item.image ? (item.image.startsWith("http") ? item.image : `${XANTA_API}${item.image}`) : "/og-image.png";
        return `
          <div class="cart-drawer-item">
            <img src="${imgUrl}" alt="${escapeHtml(item.name)}" class="cart-item-img" loading="lazy">
            <div class="cart-item-details">
              <h4 class="cart-item-title">${escapeHtml(item.name)}</h4>
              <div class="cart-item-meta">${escapeHtml(item.colour || "")} ${item.size ? `· ${escapeHtml(item.size)}` : ""}</div>
              <div class="cart-item-price-row">
                <div class="cart-qty-ctrl">
                  <button type="button" class="qty-btn" data-action="dec" data-index="${index}" aria-label="Decrease quantity">-</button>
                  <span class="qty-display">${item.quantity || 1}</span>
                  <button type="button" class="qty-btn" data-action="inc" data-index="${index}" aria-label="Increase quantity">+</button>
                </div>
                <span style="font-weight:700; font-size:0.95rem;">$${itemTotal}</span>
                <button type="button" class="cart-item-remove" data-index="${index}" aria-label="Remove item">Remove</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Bind quantity and remove buttons
    cartDrawerItems.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        const action = btn.getAttribute("data-action");
        const currentCart = getCart();
        if (action === "inc") {
          currentCart[idx].quantity = (currentCart[idx].quantity || 1) + 1;
        } else if (action === "dec") {
          if (currentCart[idx].quantity > 1) {
            currentCart[idx].quantity -= 1;
          } else {
            currentCart.splice(idx, 1);
          }
        }
        saveCart(currentCart);
      });
    });

    cartDrawerItems.querySelectorAll(".cart-item-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        const currentCart = getCart();
        currentCart.splice(idx, 1);
        saveCart(currentCart);
      });
    });
  }

  function openCartDrawer() {
    updateCartDrawer();
    if (cartDrawer) cartDrawer.classList.add("active");
    if (cartDrawerOverlay) cartDrawerOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeCartDrawer() {
    if (cartDrawer) cartDrawer.classList.remove("active");
    if (cartDrawerOverlay) cartDrawerOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  /* --------------------------------------------------------------------------
     Product Card Builder
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

  function getFirstProductImage(p) {
    if (p.image) return p.image.startsWith("http") ? p.image : `${XANTA_API}${p.image}`;
    if (p.colourways && p.colourways.length > 0) {
      const cw = p.colourways[0];
      if (cw.front_image) return cw.front_image.startsWith("http") ? cw.front_image : `${XANTA_API}${cw.front_image}`;
      if (cw.images && cw.images.length > 0) {
        const img = cw.images[0];
        const url = img.url || img.key || img;
        return url.startsWith("http") ? url : `${XANTA_API}/images/${encodeURIComponent(url)}`;
      }
    }
    return "/og-image.png";
  }

  function renderProductCard(p) {
    const imgUrl = getFirstProductImage(p);
    const priceNum = Number(p.price) || 0;
    const priceFormatted = `$${priceNum.toFixed(2)}`;
    const category = p.category ? p.category.toUpperCase() : "APPAREL";
    const colourCount = (p.colourways && p.colourways.length) || 1;

    return `
      <article class="reformia-product-card" data-product-id="${escapeHtml(p.id)}">
        <a href="/product.html?id=${encodeURIComponent(p.id)}" class="card-media" aria-label="${escapeHtml(p.name)}">
          <img src="${imgUrl}" alt="${escapeHtml(p.name)} — XANTA Streetwear" loading="lazy" width="320" height="400">
          <span class="card-tag">${escapeHtml(category)}</span>
          <span class="card-quick-add">View Piece &rarr;</span>
        </a>
        <div class="card-info">
          <span class="card-category">${escapeHtml(category)} · ${colourCount} ${colourCount === 1 ? "COLOUR" : "COLOURS"}</span>
          <h3 class="card-title">
            <a href="/product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
          </h3>
          <div class="card-price-row">
            <span class="card-price">${priceFormatted}</span>
            <div class="card-colors" title="${colourCount} available colourways">
              <span class="color-dot" style="background:#14161A;"></span>
              <span class="color-dot" style="background:#EDEDED;"></span>
              <span class="color-dot" style="background:#5C7B96;"></span>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  /* --------------------------------------------------------------------------
     Fetch and Populate Storefront
     -------------------------------------------------------------------------- */
  async function loadStorefrontProducts() {
    try {
      const res = await fetch(`${XANTA_API}/api/products`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allProducts = data.products || data || [];
    } catch (e) {
      console.warn("Could not fetch remote products; falling back to local defaults:", e);
      allProducts = [
        {
          id: "xanta-mineral-wash-boxy-cotton-t-shirt",
          name: "XANTA Mineral Wash Boxy Cotton T-Shirt",
          category: "T-SHIRT",
          price: 48,
          image: "https://img.staticdj.com/587f8e156f494f69e43a152bb7320a8f.png",
          colourways: [{ colour: "Mineral Wash Black" }]
        },
        {
          id: "xanta-unisex-oversized-t-shirt",
          name: "XANTA Unisex Oversized T-Shirt",
          category: "T-SHIRT",
          price: 29.99,
          image: "https://img.staticdj.com/e21258013caaab5d8a2e6dc4dbbe60a3.png",
          colourways: [{ colour: "Pure White" }]
        },
        {
          id: "xanta-unisex-color-block-polo-shirt",
          name: "XANTA Unisex Color Block Polo Shirt",
          category: "T-SHIRT",
          price: 75.99,
          image: "https://img.staticdj.com/44536930962135343741002abf89e95c.png",
          colourways: [{ colour: "Mocha Brown" }]
        },
        {
          id: "xanta-distressed-blue-denim-shorts",
          name: "Distressed Blue XANTA Denim Shorts",
          category: "DENIM",
          price: 85,
          image: "https://img.staticdj.com/e9ef155a455f50172822418ba718628f.png",
          colourways: [{ colour: "Distressed Blue" }]
        },
        {
          id: "xanta-mens-loose-straight-pants",
          name: "XANTA Men's Loose Straight Pants",
          category: "PANTS",
          price: 68,
          image: "https://img.staticdj.com/1f1754d602fb9f6cc6f2d58a7d8aa765.jpeg",
          colourways: [{ colour: "Charcoal Grey" }]
        }
      ];
    }

    renderStorefrontSections();
  }

  function renderStorefrontSections() {
    // 1. New Arrivals: T-Shirts and Polos
    if (newArrivalsGrid) {
      const tees = allProducts.filter((p) => (p.category || "").toUpperCase().includes("T-SHIRT") || (p.category || "").toUpperCase().includes("POLO"));
      newArrivalsGrid.innerHTML = (tees.length > 0 ? tees : allProducts).slice(0, 4).map(renderProductCard).join("");
    }

    // 2. Bottoms: Denim & Pants
    if (bottomsGrid) {
      const bottoms = allProducts.filter((p) => {
        const cat = (p.category || "").toUpperCase();
        return cat.includes("DENIM") || cat.includes("PANT") || cat.includes("SHORT");
      });
      bottomsGrid.innerHTML = (bottoms.length > 0 ? bottoms : allProducts.slice(2, 5)).map(renderProductCard).join("");
    }

    // 3. Category Products: initial ALL render
    filterCategoryProducts("ALL");
  }

  function filterCategoryProducts(category) {
    if (!categoryProductsGrid) return;
    let filtered = allProducts;
    if (category === "T-SHIRT") {
      filtered = allProducts.filter((p) => (p.category || "").toUpperCase().includes("T-SHIRT") || (p.category || "").toUpperCase().includes("POLO"));
    } else if (category === "BOTTOMS") {
      filtered = allProducts.filter((p) => {
        const cat = (p.category || "").toUpperCase();
        return cat.includes("DENIM") || cat.includes("PANT") || cat.includes("SHORT");
      });
    } else if (category === "OUTERWEAR") {
      filtered = allProducts.filter((p) => (p.category || "").toUpperCase().includes("HOODIE") || (p.category || "").toUpperCase().includes("OUTERWEAR"));
      if (filtered.length === 0) {
        categoryProductsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; color: var(--color-muted);">
            <p style="font-size: 1.1rem; font-weight: 600; color: var(--color-ink); margin-bottom: 8px;">Outerwear & Hoodies arriving in Drop 02.</p>
            <p>Sign up to client updates or browse our current heavyweight tee and bottoms collection below.</p>
          </div>
        `;
        return;
      }
    }

    categoryProductsGrid.innerHTML = filtered.map(renderProductCard).join("");
  }

  /* --------------------------------------------------------------------------
     Event Listeners Initialization
     -------------------------------------------------------------------------- */
  function initEvents() {
    // Mobile navigation toggle
    if (mobileMenuBtn && headerNav) {
      mobileMenuBtn.addEventListener("click", () => {
        const isOpen = headerNav.classList.toggle("active");
        mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
      });
    }

    // Category tabs
    categoryTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        categoryTabs.forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        const cat = tab.getAttribute("data-category");
        filterCategoryProducts(cat);
      });
    });

    // Cart Drawer triggers
    if (cartDrawerBtn) cartDrawerBtn.addEventListener("click", openCartDrawer);
    if (cartDrawerClose) cartDrawerClose.addEventListener("click", closeCartDrawer);
    if (cartDrawerOverlay) cartDrawerOverlay.addEventListener("click", closeCartDrawer);

    // Search Modal triggers
    if (searchTrigger && searchModal && searchModalOverlay) {
      searchTrigger.addEventListener("click", () => {
        searchModal.style.display = "block";
        searchModalOverlay.classList.add("active");
        if (catalogSearchInput) catalogSearchInput.focus();
      });
    }

    function closeSearch() {
      if (searchModal) searchModal.style.display = "none";
      if (searchModalOverlay) searchModalOverlay.classList.remove("active");
    }

    if (searchModalClose) searchModalClose.addEventListener("click", closeSearch);
    if (searchModalOverlay) searchModalOverlay.addEventListener("click", closeSearch);

    // Search filter
    if (catalogSearchInput && searchResultsBox) {
      catalogSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
          searchResultsBox.innerHTML = "";
          return;
        }
        const matches = allProducts.filter((p) => {
          return (p.name || "").toLowerCase().includes(query) || (p.category || "").toLowerCase().includes(query) || (p.description || "").toLowerCase().includes(query);
        });

        if (matches.length === 0) {
          searchResultsBox.innerHTML = '<p style="padding: 16px; color: var(--color-muted); text-align: center;">No matching products found.</p>';
          return;
        }

        searchResultsBox.innerHTML = matches
          .map((p) => {
            const img = getFirstProductImage(p);
            return `
              <a href="/product.html?id=${encodeURIComponent(p.id)}" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eee;">
                <img src="${img}" alt="${escapeHtml(p.name)}" style="width: 48px; height: 60px; object-fit: cover; border-radius: 4px;">
                <div>
                  <div style="font-weight: 600; color: #14161A;">${escapeHtml(p.name)}</div>
                  <div style="font-size: 0.85rem; color: #6F7173;">$${Number(p.price || 0).toFixed(2)} · ${escapeHtml(p.category || "")}</div>
                </div>
              </a>
            `;
          })
          .join("");
      });
    }

    // Keyboard ESC to close drawers
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCartDrawer();
        closeSearch();
      }
    });

    // Initial cart load
    updateCartDrawer();
  }

  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    initEvents();
    loadStorefrontProducts();
  });
})();
