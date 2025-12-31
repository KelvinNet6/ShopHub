function formatMK(amount) {
  return `MK ${Number(amount).toLocaleString("en-MW")}`;
}

function getGrid() {
  return document.getElementById("productsGrid");
}

// === GLOBAL VARIABLES ===
let wishlist = [];
let cart = JSON.parse(localStorage.getItem("shophub_cart")) || [];
let allProducts = [];
let pendingProduct = null;
let selectedSize = null;
let grid;

// === IMPROVED INITIALIZATION – Fixes logged-in product loading ===
let isInitialized = false;

async function initializeApp(force = false) {
  if (isInitialized && !force) {
    console.log("App already initialized – skipping");
    return;
  }
  isInitialized = true;

  console.log("Initializing app: loading wishlist + products");

  await loadWishlist();   // This will correctly detect user if session restored
  await loadProducts();

  updateCartCount();
}

// Main auth listener
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("Auth event:", event, "User:", session?.user?.id || "none");

  if (
    event === 'INITIAL_SESSION' ||
    event === 'SIGNED_IN' ||
    event === 'SIGNED_OUT' ||
    event === 'TOKEN_REFRESHED'
  ) {
    // 🔑 Always reset before init to avoid race conditions
    isInitialized = false;

    // 🔑 Always force init from auth events
    await initializeApp(true);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  grid = document.getElementById("productsGrid");

  if (!grid) {
    console.warn("productsGrid element not found!");
    return;
  }
});;



// Extra safety for back/forward cache
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    isInitialized = false;
    initializeApp(true);
  }
});

// === WISHLIST FUNCTIONS ===
async function loadWishlist() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    wishlist = [];
    return;
  }

  const { data, error } = await supabase
    .from("wishlist")
    .select("product_id")
    .eq("user_id", user.id);

  if (!error && data) {
    wishlist = data.map(item => item.product_id);
  } else {
    wishlist = [];
  }
}

async function toggleWishlist(product) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("Please log in to use wishlist ❤️");
    window.location.href = "Admin/adLogin.html";
    return;
  }

  const isLiked = wishlist.includes(product.id);

  if (isLiked) {
    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", product.id);

    if (!error) {
      wishlist = wishlist.filter(id => id !== product.id);
    }
  } else {
    const { error } = await supabase
      .from("wishlist")
      .insert({ user_id: user.id, product_id: product.id });

    if (!error) {
      wishlist.push(product.id);
    }
  }

  // Re-render current view to update all hearts
  filterAndSort();
}

// === PRODUCT LOADING & RENDERING ===
async function loadProducts() {
  console.log("loadProducts() called");

  const grid = getGrid();      
  if (!grid) return; 
  
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,price,image_url,has_sizes,categories(name)")
    .order("id");

  if (error) {
    console.error("Product load error:", error);
    grid.innerHTML = `<p style="text-align:center;color:#ff4444;padding:2rem;">Failed to load products. Please refresh.</p>`;
    allProducts = [];
    return;
  }

  if (!products || products.length === 0) {
    grid.innerHTML = `<p style="text-align:center;padding:2rem;">No products available at the moment.</p>`;
    allProducts = [];
    return;
  }

  allProducts = products;

  // Build category filters
  const categories = [...new Set(allProducts.map(p => p.categories?.name).filter(Boolean))];
  const options = `<option value="all">All Items</option>` +
    categories.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join("");

  const filterSelectEl = document.getElementById("filterSelect");
  const mobileFilterEl = document.getElementById("mobileFilter");
  if (filterSelectEl) filterSelectEl.innerHTML = options;
  if (mobileFilterEl) mobileFilterEl.innerHTML = options;

  // Initial render
  filterAndSort();
}

function renderProducts(products) {
  const grid = document.getElementById("productsGrid");

  if (!grid) {
    console.warn("renderProducts: productsGrid not found yet");
    return;
  }

  if (!products || products.length === 0) {
    grid.innerHTML = `<p style="text-align:center;padding:2rem;">No products found.</p>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const imgUrl = getPublicImageUrl(p.image_url);
    const isLiked = wishlist.includes(p.id);
    const heartClass = isLiked ? 'fas' : 'far';
    const likedClass = isLiked ? 'liked' : '';

    return `
      <a href="Home/viewproduct.html?id=${p.id}" class="product-card">
        <div class="product-image">
          <img src="${imgUrl}" alt="${p.name}" loading="lazy">
          <div class="like-btn ${likedClass}" data-product-id="${p.id}">
            <i class="${heartClass} fa-heart"></i>
          </div>
        </div>
        <div class="product-overlay">
          <div class="product-title">${p.name.toUpperCase()}</div>
          <div class="product-price">${formatMK(p.price)}</div>
          <div class="product-actions">
            <div class="action-btn view-btn">QUICK VIEW</div>
            <div class="action-btn cart-btn" data-product-id="${p.id}">
              <i class="fas fa-shopping-bag"></i> ADD TO CART
            </div>
          </div>
        </div>
        <div class="product-info">
          <div class="product-title">${p.name.toUpperCase()}</div>
          <div class="product-price">$${Number(p.price).toFixed(2)}</div>
          <div class="product-actions">
            <div class="action-btn view-btn">QUICK VIEW</div>
            <div class="action-btn cart-btn" data-product-id="${p.id}">
              <i class="fas fa-shopping-bag"></i> ADD TO CART
            </div>
          </div>
        </div>
      </a>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  grid = getGrid();
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const likeBtn = e.target.closest(".like-btn");
    if (likeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const productId = Number(likeBtn.dataset.productId);
      const product = allProducts.find(p => p.id === productId);
      if (product) toggleWishlist(product);
      return;
    }

    const cartBtn = e.target.closest(".cart-btn");
    if (cartBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleAddToCartClick(Number(cartBtn.dataset.productId));
    }
  });
});


// === FILTERING & SORTING ===
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const sortSelect = document.getElementById("sortSelect");

function filterAndSort() {
  let filtered = [...allProducts];

  // Search
  const query = searchInput?.value.toLowerCase().trim() || "";
  if (query) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
  }

  // Category filter
  const cat = filterSelect?.value || "all";
  if (cat !== "all") {
    filtered = filtered.filter(p => (p.categories?.name || '').toLowerCase() === cat);
  }

  // Sorting
  const sort = sortSelect?.value || "";
  if (sort === "price-low") filtered.sort((a, b) => a.price - b.price);
  else if (sort === "price-high") filtered.sort((a, b) => b.price - a.price);
  else if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));

  renderProducts(filtered);
}

if (searchInput) searchInput.addEventListener("input", filterAndSort);
if (filterSelect) filterSelect.addEventListener("change", filterAndSort);
if (sortSelect) sortSelect.addEventListener("change", filterAndSort);

// Sync mobile controls
const mobileSearch = document.getElementById("mobileSearch");
const mobileFilter = document.getElementById("mobileFilter");
const mobileSort = document.getElementById("mobileSort");

[mobileSearch, searchInput].forEach(el => el?.addEventListener("input", () => {
  if (searchInput && mobileSearch) {
    searchInput.value = mobileSearch.value = el.value;
    filterAndSort();
  }
}));

[mobileFilter, filterSelect].forEach(el => el?.addEventListener("change", () => {
  if (filterSelect && mobileFilter) {
    filterSelect.value = mobileFilter.value = el.value;
    filterAndSort();
  }
}));

[mobileSort, sortSelect].forEach(el => el?.addEventListener("change", () => {
  if (sortSelect && mobileSort) {
    sortSelect.value = mobileSort.value = el.value;
    filterAndSort();
  }
}));

// Bottom Sheet Controls
const trigger = document.getElementById('floatingTrigger');
const overlay = document.getElementById('bottomSheetOverlay');
const sheet = document.getElementById('bottomSheet');

if (trigger) trigger.addEventListener('click', () => {
  sheet.classList.toggle('open');
  overlay.classList.toggle('active');
});
if (overlay) overlay.addEventListener('click', () => {
  sheet.classList.remove('open');
  overlay.classList.remove('active');
});

// === CART FUNCTIONS ===
function addToCart(product) {
  const key = product.size ? `${product.id}-${product.size}` : product.id;
  const existing = cart.find(item => 
    item.id === product.id && item.size === product.size
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  localStorage.setItem("shophub_cart", JSON.stringify(cart));
  updateCartCount();

  alert(`${product.name}${product.size ? " (Size " + product.size + ")" : ""} added to bag!`);
}

function handleAddToCartClick(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  if (product.has_sizes) {
    pendingProduct = product;
    openSizeSelector(product);
  } else {
    addToCart(product);
  }
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountEl = document.getElementById("cartCount");
  const mobileCountEl = document.getElementById("mobileCartCount");
  if (cartCountEl) cartCountEl.textContent = count;
  if (mobileCountEl) mobileCountEl.textContent = count;
}

function renderCart() {
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<p class="empty-cart">Your bag is empty</p>`;
    cartTotalEl.textContent = "0.00";
    return;
  }

  cartItemsEl.innerHTML = cart.map(item => `
    <div style="display:flex; gap:1rem; padding:1rem 0; border-bottom:1px solid #222;">
      <img src="${getPublicImageUrl(item.image_url)}" style="width:80px;height:120px;object-fit:cover;border-radius:12px;">
      <div style="flex:1;">
        <div style="font-weight:700;">${item.name}</div>
        ${item.size ? `<div style="color:#aaa;font-size:0.9rem;">Size: ${item.size}</div>` : ''}
        <div style="color:#a78bfa;font-weight:800;">${formatMK(item.price)}</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-top:0.5rem;">
          <button style="width:36px;height:36px;background:#222;border:none;border-radius:50%;color:white;" onclick="updateQuantity(${item.id},'${item.size || ''}',-1)">−</button>
          <span style="min-width:30px;text-align:center;font-weight:700;">${item.quantity}</span>
          <button style="width:36px;height:36px;background:#222;border:none;border-radius:50%;color:white;" onclick="updateQuantity(${item.id},'${item.size || ''}',1)">+</button>
        </div>
        <div style="color:#ff4444;font-size:0.9rem;cursor:pointer;margin-top:0.5rem;" onclick="removeFromCart(${item.id},'${item.size || ''}')">Remove</div>
      </div>
    </div>
  `).join("");

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  cartTotalEl.textContent = formatMK(total);
}

window.removeFromCart = (id, size) => {
  size = size === '' ? undefined : size;
  cart = cart.filter(i => !(i.id === id && i.size === size));
  localStorage.setItem("shophub_cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
};

window.updateQuantity = (id, size, change) => {
  size = size === '' ? undefined : size;
  const item = cart.find(i => i.id === id && i.size === size);
  if (item) {
    item.quantity = Math.max(1, item.quantity + change);
    localStorage.setItem("shophub_cart", JSON.stringify(cart));
    updateCartCount();
    renderCart();
  }
};

// Cart Sidebar Controls
const cartSidebar = document.getElementById("cartSidebar");
const cartOverlay = document.getElementById("cartOverlay");
const openCartBtn = document.getElementById("openCart");
const closeCartBtn = document.getElementById("closeCart");

if (openCartBtn) openCartBtn.addEventListener("click", (e) => {
  e.preventDefault();
  cartSidebar.classList.add("open");
  cartOverlay.classList.add("active");
  renderCart();
});
if (closeCartBtn) closeCartBtn.addEventListener("click", () => {
  cartSidebar.classList.remove("open");
  cartOverlay.classList.remove("active");
});
if (cartOverlay) cartOverlay.addEventListener("click", () => {
  cartSidebar.classList.remove("open");
  cartOverlay.classList.remove("active");
});

// === SIZE SELECTOR ===
async function openSizeSelector(product) {
  selectedSize = null;

  const { data: sizes } = await supabase
    .from("product_sizes")
    .select("size")
    .eq("product_id", product.id)
    .neq("size", "DEFAULT");

  const sizeOptions = document.getElementById("sizeOptions");
  if (sizeOptions && sizes) {
    sizeOptions.innerHTML = sizes.map(s => `
      <div class="size-btn" onclick="selectSize('${s.size}', this)">${s.size}</div>
    `).join("");
  }

  document.getElementById("sizeSheet").classList.add("open");
  document.getElementById("sizeSheetOverlay").classList.add("active");
}

function selectSize(size, el) {
  selectedSize = size;
  document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

document.getElementById("confirmSizeBtn")?.addEventListener("click", () => {
  if (!selectedSize) {
    alert("Please select a size");
    return;
  }
  addToCart({ ...pendingProduct, size: selectedSize });
  closeSizeSelector();
});

function closeSizeSelector() {
  document.getElementById("sizeSheet").classList.remove("open");
  document.getElementById("sizeSheetOverlay").classList.remove("active");
  pendingProduct = null;
  selectedSize = null;
}

// === MOBILE NAV ===
const openMobileNavBtn = document.getElementById("openMobileNav");
const closeMobileNavBtn = document.getElementById("closeMobileNav");
const mobileNavOverlay = document.getElementById("mobileNavOverlay");
const mobileNav = document.getElementById("mobileNav");
const mobileCartLink = document.getElementById("mobileCartLink");

if (openMobileNavBtn) openMobileNavBtn.addEventListener("click", () => {
  mobileNav.classList.add("open");
  mobileNavOverlay.classList.add("active");
});
if (closeMobileNavBtn) closeMobileNavBtn.addEventListener("click", () => {
  mobileNav.classList.remove("open");
  mobileNavOverlay.classList.remove("active");
});
if (mobileNavOverlay) mobileNavOverlay.addEventListener("click", () => {
  mobileNav.classList.remove("open");
  mobileNavOverlay.classList.remove("active");
});
if (mobileCartLink) mobileCartLink.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("openCart")?.click();
  mobileNav.classList.remove("open");
  mobileNavOverlay.classList.remove("active");
});

// === VISITOR TRACKING ===
async function trackVisitor() {
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipRes.json();
    await supabase.from("visitors").insert({
      ip: ipData.ip,
      user_agent: navigator.userAgent
    });
  } catch (err) {
    console.error("Visitor log failed:", err);
  }
}

trackVisitor();
updateCartCount();
