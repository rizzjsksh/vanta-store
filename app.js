const products = [
  {id:"tee-white",name:"Signature Tee — White",type:"T-SHIRT",price:0,color:"White",shape:"shirt",dark:false},
  {id:"tee-black",name:"Signature Tee — Black",type:"T-SHIRT",price:0,color:"Black",shape:"shirt",dark:true},
  {id:"hoodie-black",name:"Signature Hoodie — Black",type:"HOODIE",price:0,color:"Black",shape:"hoodie",dark:true},
  {id:"hoodie-white",name:"Signature Hoodie — White",type:"HOODIE",price:0,color:"White",shape:"hoodie",dark:false}
];
const grid=document.querySelector("#product-grid");
const cart=[];
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
function renderProducts(){
  grid.innerHTML=products.map(p=>`<article class="product-card"><div class="product-visual ${p.dark?"dark":""}"><span class="product-tag">VANTA / 001</span><div class="${p.shape}-shape"><span class="mock-logo">VANTA</span></div></div><div class="product-info"><div><h3>${p.name}</h3><p>${p.type} · ${p.color.toUpperCase()}</p></div><strong>COMING SOON</strong></div></article>`).join("");
}
function renderCart(){
  const count=cart.reduce((n,x)=>n+x.qty,0);
  document.querySelector("#cart-count").textContent=count;
  document.querySelector("#drawer-count").textContent=`(${count})`;
  document.querySelector("#cart-total").textContent=money(0);
  document.querySelector("#cart-items").innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><div class="cart-thumb">V</div><div><strong>${x.name}</strong><small>${x.color} · Size ${x.size} · Qty ${x.qty}</small></div><button class="remove-item" data-remove="${x.key}">REMOVE</button></div>`).join(""):'<p class="empty-cart">Your bag is currently empty.</p>';
}
const drawer=document.querySelector("#cart-drawer"),overlay=document.querySelector("#cart-overlay");
function openCart(){drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");overlay.hidden=false}
function closeCart(){drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");overlay.hidden=true}
document.querySelector("#open-cart").addEventListener("click",openCart);
document.querySelector("#close-cart").addEventListener("click",closeCart);
overlay.addEventListener("click",closeCart);
document.querySelector("#cart-items").addEventListener("click",e=>{const b=e.target.closest("[data-remove]");if(!b)return;const i=cart.findIndex(x=>x.key===b.dataset.remove);if(i>=0)cart.splice(i,1);renderCart()});
document.querySelector("#notify-form").addEventListener("submit",e=>{e.preventDefault();document.querySelector("#form-message").textContent="Thanks — launch notifications will be available when the mailing list is connected.";e.target.reset()});
document.querySelector("#year").textContent=new Date().getFullYear();
renderProducts();renderCart();