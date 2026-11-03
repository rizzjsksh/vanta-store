const products = [
  {
    id: "tee-white",
    name: "VANTA Signature Tee",
    type: "T-SHIRT",
    colour: "White",
    colourLabel: "WHITE",
    shape: "shirt",
    dark: false,
    priceFrom: 39.99,
    description: "Quiet confidence. Unmistakable identity. The VANTA Signature Tee brings minimalist design into everyday streetwear. Featuring understated VANTA lettering, a relaxed silhouette and dropped shoulders, it delivers a clean, effortless look without unnecessary detail. Made with medium-weight cotton fabric, it combines everyday comfort with durable double-needle stitching.",
    details: ["Medium-weight 6 oz / 170 GSM fabric", "Relaxed silhouette with dropped shoulders", "Double-needle stitching at sleeves, neck and hem", "Tear-away label", "Available in XS–3XL"],
    care: ["Machine wash cold, up to 30°C", "Use non-chlorine bleach if needed", "Tumble dry on low heat", "Iron on low heat", "Do not dry clean"],
    sizes: [
      {size:"XS", price:39.99, cost:26.44},
      {size:"S", price:39.99, cost:26.44},
      {size:"M", price:39.99, cost:26.44},
      {size:"L", price:39.99, cost:26.44},
      {size:"XL", price:39.99, cost:26.44},
      {size:"2XL", price:39.99, cost:27.33},
      {size:"3XL", price:40.99, cost:29.33}
    ]
  },
  {
    id: "tee-black",
    name: "VANTA Oversized Signature Tee",
    type: "T-SHIRT",
    colour: "Black",
    colourLabel: "BLACK",
    shape: "shirt",
    dark: true,
    priceFrom: 39.99,
    description: "Make a statement without saying too much. The VANTA Oversized Signature Tee brings a relaxed boxy silhouette together with understated VANTA lettering. Its dropped shoulders and clean minimalist design create a confident streetwear look. Made from soft, combed and ring-spun cotton, this medium-weight tee offers everyday comfort with a modern oversized shape.",
    details: ["100% Airlume combed and ring-spun cotton; composition can vary by colour", "Medium-weight 6 oz / 170 GSM fabric", "Relaxed oversized boxy fit", "Dropped shoulders", "Tear-away label", "Available in XS–3XL"],
    care: ["Machine wash cold, up to 30°C", "Use non-chlorine bleach if needed", "Tumble dry on low heat", "Iron on low heat", "Do not dry clean"],
    sizes: [
      {size:"XS", price:39.99, cost:26.44},
      {size:"S", price:39.99, cost:26.44},
      {size:"M", price:39.99, cost:26.44},
      {size:"L", price:39.99, cost:26.44},
      {size:"XL", price:39.99, cost:26.44},
      {size:"2XL", price:39.99, cost:27.33},
      {size:"3XL", price:40.99, cost:29.33}
    ]
  }
];

const $ = selector => document.querySelector(selector);

function productCard(product) {
  return `<article class="product-card">
    <a href="product.html?id=${product.id}" aria-label="View ${product.name}">
      <div class="product-visual ${product.dark ? "dark" : ""}">
        <span class="product-tag">VANTA / ESSENTIALS 001</span>
        <div class="shirt-shape"><span class="mock-logo">VANTA</span></div>
      </div>
      <div class="product-info">
        <div><h3>${product.name}</h3><p>T-SHIRT · ${product.colourLabel}</p></div>
        <strong>FROM $39.99</strong>
      </div>
    </a>
  </article>`;
}

function renderProductDetail() {
  const root = $("#product-detail");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const product = products.find(item => item.id === id);
  if (!product) {
    $("#detail-name").textContent = "PRODUCT NOT FOUND";
    return;
  }

  $("#detail-name").textContent = product.name;
  $("#detail-type").textContent = "VANTA ESSENTIALS 001 · " + product.colourLabel;
  $("#detail-description").textContent = product.description;
  $("#detail-visual").className = "product-visual detail-visual " + (product.dark ? "dark" : "");
  $("#detail-visual").innerHTML = '<span class="product-tag">VANTA / ESSENTIALS 001</span><div class="shirt-shape"><span class="mock-logo">VANTA</span></div>';

  const sizeSelect = $("#detail-size");
  sizeSelect.innerHTML = product.sizes.map(item => `<option value="${item.size}">${item.size}</option>`).join("");
  const price = $("#detail-price");
  const updatePrice = () => {
    const selected = product.sizes.find(item => item.size === sizeSelect.value) || product.sizes[0];
    price.textContent = "$" + selected.price.toFixed(2);
  };
  sizeSelect.addEventListener("change", updatePrice);
  updatePrice();

  $("#detail-features").innerHTML = product.details.map(item => "<li>" + item + "</li>").join("");
  $("#detail-care").innerHTML = product.care.map(item => "<li>" + item + "</li>").join("");
  $("#detail-size-note").textContent = "Available sizes: XS, S, M, L, XL, 2XL and 3XL. Shipping is calculated separately at checkout once delivery rates are configured.";
}

function init() {
  if ($("#featured-products")) $("#featured-products").innerHTML = products.map(productCard).join("");
  if ($("#all-products")) $("#all-products").innerHTML = products.map(productCard).join("");
  renderProductDetail();
  if ($("#cart-page-items")) $("#cart-page-items").innerHTML = '<p class="empty-cart">Your bag is currently empty. Orders will open soon.</p>';
  if ($("#year")) $("#year").textContent = new Date().getFullYear();
  if ($("#cart-count")) $("#cart-count").textContent = "0";
}

document.addEventListener("DOMContentLoaded", init);
