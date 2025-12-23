
    let wishlist = [];

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

  if (!error) {
    wishlist = data.map(item => item.product_id);
  }
}

   async function toggleWishlist(product, event) {
  event.preventDefault();
  event.stopPropagation();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("Please log in to use wishlist ❤️");
    window.location.href = "Admin/adLogin.html";
    return;
  }

  const btn = event.target.closest('.like-btn');
  const icon = btn.querySelector('i');

  const isLiked = wishlist.includes(product.id);

  if (isLiked) {
    await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", product.id);

    wishlist = wishlist.filter(id => id !== product.id);
    btn.classList.remove("liked");
    icon.classList.replace("fas", "far");
  } else {
    await supabase
      .from("wishlist")
      .insert({
        user_id: user.id,
        product_id: product.id
      });

    wishlist.push(product.id);
    btn.classList.add("liked");
    icon.classList.replace("far", "fas");
  }
}

    // Mobile Nav (from top)
    const openMobileNavBtn = document.getElementById("openMobileNav");
    const closeMobileNavBtn = document.getElementById("closeMobileNav");
    const mobileNavOverlay = document.getElementById("mobileNavOverlay");
    const mobileNav = document.getElementById("mobileNav");
    const mobileCartLink = document.getElementById("mobileCartLink");

    openMobileNavBtn.addEventListener("click", () => {
      mobileNav.classList.add("open");
      mobileNavOverlay.classList.add("active");
    });
    closeMobileNavBtn.addEventListener("click", () => {
      mobileNav.classList.remove("open");
      mobileNavOverlay.classList.remove("active");
    });
    mobileNavOverlay.addEventListener("click", () => {
      mobileNav.classList.remove("open");
      mobileNavOverlay.classList.remove("active");
    });
    mobileCartLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("openCart").click();
      mobileNav.classList.remove("open");
      mobileNavOverlay.classList.remove("active");
    });

    // Cart
    let cart = JSON.parse(localStorage.getItem("shophub_cart")) || [];
    let allProducts = [];

    const cartSidebar = document.getElementById("cartSidebar");
    const cartOverlay = document.getElementById("cartOverlay");
    const openCartBtn = document.getElementById("openCart");
    const closeCartBtn = document.getElementById("closeCart");
    const cartItemsEl = document.getElementById("cartItems");
    const cartTotalEl = document.getElementById("cartTotal");

    openCartBtn.addEventListener("click", e => { e.preventDefault(); cartSidebar.classList.add("open"); cartOverlay.classList.add("active"); renderCart(); });
    closeCartBtn.addEventListener("click", () => { cartSidebar.classList.remove("open"); cartOverlay.classList.remove("active"); });
    cartOverlay.addEventListener("click", () => { cartSidebar.classList.remove("open"); cartOverlay.classList.remove("active"); });

function addToCart(product) {
  const existing = cart.find(
    item => item.id === product.id && item.size === product.size
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  localStorage.setItem("shophub_cart", JSON.stringify(cart));
  updateCartCount();

  alert(
    `${product.name}${product.size ? " (Size " + product.size + ")" : ""} added to bag!`
  );
}

let pendingProduct = null;

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
      const count = cart.reduce((s, i) => s + i.quantity, 0);
      document.getElementById("cartCount").textContent = count;
      const mobileCount = document.getElementById("mobileCartCount");
      if (mobileCount) mobileCount.textContent = count;
    }

   function renderCart() {
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
        <div style="color:#a78bfa;font-weight:800;">$${item.price.toFixed(2)}</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-top:0.5rem;">
          <button style="width:36px;height:36px;background:#222;border:none;border-radius:50%;color:white;" onclick="updateQuantity(${item.id},'${item.size}',-1)">−</button>
          <span style="min-width:30px;text-align:center;font-weight:700;">${item.quantity}</span>
          <button style="width:36px;height:36px;background:#222;border:none;border-radius:50%;color:white;" onclick="updateQuantity(${item.id},'${item.size}',1)">+</button>
        </div>
        <div style="color:#ff4444;font-size:0.9rem;cursor:pointer;margin-top:0.5rem;" onclick="removeFromCart(${item.id},'${item.size}')">Remove</div>
      </div>
    </div>
  `).join("");

  cartTotalEl.textContent = cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
}

window.removeFromCart = (id, size) => {
  cart = cart.filter(i => !(i.id === id && i.size === size));
  localStorage.setItem("shophub_cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
};

window.updateQuantity = (id, size, change) => {
  const item = cart.find(i => i.id === id && i.size === size);
  if (item) item.quantity = Math.max(1, item.quantity + change);
  localStorage.setItem("shophub_cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
};


    // Products
    const grid = document.getElementById("productsGrid");

    function renderProducts(products) {
      grid.innerHTML = products.map(p => {
        const imgUrl = getPublicImageUrl(p.image_url);
       const isLiked = wishlist.includes(p.id);
        const heartClass = isLiked ? 'fas' : 'far';
        return `
          <a href="Home/viewproduct.html?id=${p.id}" class="product-card">
            <div class="product-image">
              <img src="${imgUrl}" alt="${p.name}" loading="lazy">
              <div class="like-btn ${isLiked ? 'liked' : ''}" onclick="event.preventDefault();event.stopPropagation();toggleWishlist({id:${p.id},name:'${p.name.replace(/'/g,"\\'")}',price:${p.price},image_url:'${p.image_url}'}, event);">
                <i class="${heartClass} fa-heart"></i>
              </div>
            </div>
            <div class="product-overlay">
              <div class="product-title">${p.name.toUpperCase()}</div>
              <div class="product-price">$${Number(p.price).toFixed(2)}</div>
              <div class="product-actions">
                <div class="action-btn view-btn">QUICK VIEW</div>
             <div class="action-btn cart-btn"
  onclick="event.preventDefault();
           event.stopPropagation();
           handleAddToCartClick(${p.id})">
  <i class="fas fa-shopping-bag"></i> ADD TO CART
</div>

              </div>
            </div>
            <div class="product-info">
              <div class="product-title">${p.name.toUpperCase()}</div>
              <div class="product-price">$${Number(p.price).toFixed(2)}</div>
              <div class="product-actions">
                <div class="action-btn view-btn">QUICK VIEW</div>
                <div class="action-btn cart-btn"
  onclick="event.preventDefault();
           event.stopPropagation();
           handleAddToCartClick(${p.id})">
  <i class="fas fa-shopping-bag"></i> ADD TO CART
</div>

              </div>
            </div>
          </a>
        `;
      }).join("");
    }

    async function loadProducts() {
      await loadWishlist();
        
      const { data: products } = await supabase
      .from("products")
      .select("id,name,price,image_url,has_sizes,categories(name)")
      .order("id");
      allProducts = products || [];
      const categories = [...new Set(allProducts.map(p => p.categories?.name).filter(Boolean))];
      const options = `<option value="all">All Items</option>` + categories.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join("");
      document.getElementById("filterSelect").innerHTML = options;
      document.getElementById("mobileFilter").innerHTML = options;
      renderProducts(allProducts);
    }

    const searchInput = document.getElementById("searchInput");
    const filterSelect = document.getElementById("filterSelect");
    const sortSelect = document.getElementById("sortSelect");

    function filterAndSort() {
      let filtered = allProducts;
      const query = searchInput.value.toLowerCase().trim();
      if (query) filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
      const cat = filterSelect.value;
      if (cat !== "all") filtered = filtered.filter(p => (p.categories?.name || '').toLowerCase() === cat);
      const sort = sortSelect.value;
      filtered.sort((a,b) => {
        if (sort === "price-low") return a.price - b.price;
        if (sort === "price-high") return b.price - b.price;
        if (sort === "name") return a.name.localeCompare(b.name);
        return 0;
      });
      renderProducts(filtered);
    }

    searchInput.addEventListener("input", filterAndSort);
    filterSelect.addEventListener("change", filterAndSort);
    sortSelect.addEventListener("change", filterAndSort);

    // Bottom Sheet
    const trigger = document.getElementById('floatingTrigger');
    const overlay = document.getElementById('bottomSheetOverlay');
    const sheet = document.getElementById('bottomSheet');
    const mobileSearch = document.getElementById('mobileSearch');
    const mobileFilter = document.getElementById('mobileFilter');
    const mobileSort = document.getElementById('mobileSort');

    trigger.addEventListener('click', () => {
      sheet.classList.toggle('open');
      overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', () => {
      sheet.classList.remove('open');
      overlay.classList.remove('active');
    });

    [mobileSearch, searchInput].forEach(el => el.addEventListener('input', () => {
      searchInput.value = mobileSearch.value = el.value;
      filterAndSort();
    }));
    [mobileFilter, filterSelect].forEach(el => el.addEventListener('change', () => {
      filterSelect.value = mobileFilter.value = el.value;
      filterAndSort();
    }));
    [mobileSort, sortSelect].forEach(el => el.addEventListener('change', () => {
      sortSelect.value = mobileSort.value = el.value;
      filterAndSort();
    }));

    // Init
    loadProducts();
    updateCartCount();

    async function trackVisitor() {
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        await supabase.from("visitors").insert({ ip: ipData.ip, user_agent: navigator.userAgent });
      } catch (err) { console.error("Visitor log failed:", err); }
    }
    trackVisitor();

let selectedSize = null;

async function openSizeSelector(product) {
  selectedSize = null;

  const { data: sizes } = await supabase
    .from("product_sizes")
    .select("size")
    .eq("product_id", product.id)
    .neq("size", "DEFAULT");

  const sizeOptions = document.getElementById("sizeOptions");
  sizeOptions.innerHTML = sizes.map(s => `
    <div class="size-btn" onclick="selectSize('${s.size}', this)">
      ${s.size}
    </div>
  `).join("");

  document.getElementById("sizeSheet").classList.add("open");
  document.getElementById("sizeSheetOverlay").classList.add("active");
}

function selectSize(size, el) {
  selectedSize = size;
  document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

document.getElementById("confirmSizeBtn").addEventListener("click", () => {
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
}

supabase.auth.onAuthStateChange(async () => {
  await loadWishlist();
  renderProducts(allProducts);
});
