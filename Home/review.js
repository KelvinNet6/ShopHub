const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  function getPublicImageUrl(path) {
    if (!path) return 'https://i.pinimg.com/736x/4a/d8/f3/4ad8f37a3820e656419f4dd0b417e3c4.jpg';
    if (path.startsWith('http')) return path;
    return `https://nhyucbgjocmwrkqbjjme.supabase.co/storage/v1/object/public/products/${path.trim()}`;
  }

  let currentProduct = null;
  let wishlist = JSON.parse(localStorage.getItem("shophub_wishlist")) || [];

  function toggleWishlist(product, event) {
    const index = wishlist.findIndex(item => item.id === product.id);
    if (index > -1) {
      wishlist.splice(index, 1);
      alert(`${product.name} removed from wishlist`);
    } else {
      wishlist.push(product);
      alert(`${product.name} added to wishlist ❤️`);
    }
    localStorage.setItem("shophub_wishlist", JSON.stringify(wishlist));
    const btn = event.target.closest('.like-btn');
    btn.classList.toggle("liked");
    const icon = btn.querySelector('i');
    icon.classList.toggle('fas');
    icon.classList.toggle('far');
  }

  async function loadProduct() {
    if (!productId) {
      document.querySelector('.container').innerHTML = '<div class="error">No product ID in URL</div>';
      return;
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, price, image_url, brand_id")
      .eq("id", productId)
      .maybeSingle();

    if (error || !product) {
      document.querySelector('.container').innerHTML = `<div class="error">Product not found.</div>`;
      return;
    }

    currentProduct = product;

    document.getElementById("productName").textContent = product.name.toUpperCase();
    document.getElementById("productPrice").textContent = "$" + Number(product.price).toFixed(2);
    document.getElementById("mainImg").src = getPublicImageUrl(product.image_url);

    const isLiked = wishlist.some(item => item.id === product.id);
    const mainLikeBtn = document.getElementById("mainLikeBtn");
    mainLikeBtn.classList.toggle("liked", isLiked);
    mainLikeBtn.querySelector('i').classList.toggle('fas', isLiked);
    mainLikeBtn.querySelector('i').classList.toggle('far', !isLiked);

    mainLikeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(product, e);
    };

    loadRelated(product.brand_id || product.name.split(" ")[0]);
  }

  async function loadRelated(keyword) {
    let related = [];

    if (keyword && !isNaN(keyword)) {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .eq("brand_id", Number(keyword))
        .neq("id", currentProduct.id)
        .limit(8);
      if (data) related = data;
    }

    if (related.length === 0 && typeof keyword === "string") {
      const searchTerm = keyword.trim();
      if (searchTerm) {
        const { data } = await supabase
          .from("products")
          .select("id, name, price, image_url")
          .ilike("name", `${searchTerm}%`)
          .neq("id", currentProduct.id)
          .limit(8);
        if (data) related = data;
      }
    }

    const grid = document.getElementById("relatedProducts");
    if (related.length === 0) {
      grid.innerHTML = "<p style='grid-column:1/-1;text-align:center;opacity:0.6;'>No more items from this drop yet.</p>";
      return;
    }

    grid.innerHTML = related.map(p => {
      const imgUrl = getPublicImageUrl(p.image_url);
      const isLiked = wishlist.some(item => item.id === p.id);
      const heartClass = isLiked ? 'fas' : 'far';
      return `
        <a href="viewproduct.html?id=${p.id}" class="more-card">
          <div class="more-image">
            <img src="${imgUrl}" alt="${p.name}" loading="lazy">
            <div class="more-like-btn ${isLiked ? 'liked' : ''}" onclick="event.preventDefault();event.stopPropagation();toggleWishlist({id:${p.id},name:'${p.name.replace(/'/g,"\\'")}',price:${p.price},image_url:'${p.image_url}'}, event);">
              <i class="${heartClass} fa-heart"></i>
            </div>
          </div>
          <div class="more-overlay">
            <div class="more-name">${p.name.toUpperCase()}</div>
            <div class="more-price">$${Number(p.price).toFixed(2)}</div>
            <div class="more-actions">
              <div class="more-action-btn more-view-btn">QUICK VIEW</div>
              <div class="more-action-btn more-cart-btn" onclick="event.preventDefault();event.stopPropagation();addToCart({id:${p.id},name:'${p.name.replace(/'/g,"\\'")}',price:${p.price},image_url:'${p.image_url}'});">
                <i class="fas fa-shopping-bag"></i> ADD TO CART
              </div>
            </div>
          </div>
          <div class="more-info">
            <div class="more-title">${p.name.toUpperCase()}</div>
            <div class="more-price">$${Number(p.price).toFixed(2)}</div>
            <div class="more-actions">
              <div class="more-action-btn more-view-btn">QUICK VIEW</div>
              <div class="more-action-btn more-cart-btn" onclick="event.preventDefault();event.stopPropagation();addToCart({id:${p.id},name:'${p.name.replace(/'/g,"\\'")}',price:${p.price},image_url:'${p.image_url}'});">
                <i class="fas fa-shopping-bag"></i> ADD TO CART
              </div>
            </div>
          </div>
        </a>
      `;
    }).join("");
  }

  function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem("shophub_cart") || "[]");
    const existing = cart.find(i => i.id === product.id);
    if (existing) existing.quantity += 1;
    else cart.push({ ...product, quantity: 1 });
    localStorage.setItem("shophub_cart", JSON.stringify(cart));
    alert(`${product.name} added to bag!`);
  }

  document.getElementById("addToCartBtn").addEventListener("click", () => {
    if (!currentProduct) return;
    addToCart(currentProduct);
  });

  loadProduct();
