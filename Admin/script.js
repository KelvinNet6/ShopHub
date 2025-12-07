document.addEventListener("DOMContentLoaded", async () => {
  if (typeof supabase === "undefined") {
    console.error("Supabase library not loaded. Check your script order!");
    return;
  }

  const supabaseUrl = "https://nhyucbgjocmwrkqbjjme.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

  // Correct way to create client
  const { createClient } = supabase;
  window.supabase = createClient(supabaseUrl, supabaseKey);

  // Detect current page
  const PAGE = location.pathname.split("/").pop();
  if (PAGE === "landing.html" || PAGE === "") loadDashboard();
  if (PAGE === "customers.html") loadCustomers();
  if (PAGE === "products.html") loadProducts();
  if (PAGE === "orders.html") loadOrders();
  if (PAGE === "analytics.html") loadAnalytics();
});


// =====================================
// UTILITY FUNCTIONS
// =====================================
function fmtDate(d) {
  return new Date(d).toLocaleDateString();
}

function closeAllModals() {
  document.querySelectorAll(".modal-bg").forEach(m => m.style.display = "none");
}

document.getElementById("closeModal")?.addEventListener("click", closeAllModals);
document.getElementById("closeCustomerModal")?.addEventListener("click", closeAllModals);

// =====================================
// DASHBOARD
// =====================================
async function loadDashboard() {
  const [{ data: orders }, { data: products }, { data: customers }] = await Promise.all([
    supabase.from("orders").select("total"),
    supabase.from("products").select("id"),
    supabase.from("customers").select("id")
  ]);

  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);

  document.getElementById("sales").textContent = `$${revenue.toFixed(2)}`;
  document.getElementById("orders").textContent = orders.length;
  document.getElementById("products").textContent = products.length;
  document.getElementById("customers").textContent = customers.length;

  loadRecentOrders();
}

async function loadRecentOrders() {
  const { data } = await supabase
    .from("orders")
    .select("*, customers(name)")
    .order("id", { ascending: false })
    .limit(5);

  document.getElementById("ordersTableBody").innerHTML = data.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td>${o.customers.name}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>$${o.total}</td>
      <td class="status ${o.status}">${o.status}</td>
    </tr>
  `).join("");
}

// =====================================
// CUSTOMERS
// =====================================
async function loadCustomers() {
  const { data } = await supabase.from("customers").select("*").order("id");
  document.getElementById("totalCustomers").textContent = data.length;

  document.getElementById("customersTableBody").innerHTML = data.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.email || "-"}</td>
      <td>${c.phone || "-"}</td>
      <td>
        <button class="btn view" onclick="openCustomer(${c.id})">
          <i class="fa fa-eye"></i> View
        </button>
      </td>
    </tr>
  `).join("");
}

async function openCustomer(id) {
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).single();
  const { data: orders } = await supabase.from("orders").select("*").eq("customer_id", id);

  document.getElementById("customerModalName").textContent = customer.name;
  document.getElementById("customerModalEmail").textContent = customer.email;
  document.getElementById("customerModalPhone").textContent = customer.phone;
  document.getElementById("customerModalAddress").textContent = customer.address;
  document.getElementById("customerModalJoined").textContent = fmtDate(customer.created_at);

  document.getElementById("customerModalOrders").textContent = orders.length;
  document.getElementById("customerModalSpent").textContent = "$" + orders.reduce((s,o)=>s+Number(o.total),0).toFixed(2);
  document.getElementById("customerOrdersList").innerHTML = orders.map(o => `<div>#${o.id} — $${o.total} (${o.status})</div>`).join("");

  document.getElementById("customerModalBg").style.display = "flex";
}

// =====================================
// PRODUCTS (with image upload)
// =====================================
let editingProductId = null; // track if we're editing

async function loadProducts() {
  const [{ data: categories }, { data: brands }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("brands").select("*"),
    supabase.from("products").select("*, categories(name), brands(name)").order("id")
  ]);

  document.getElementById("category").innerHTML = 
    '<option value="">Select Category</option>' + 
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  document.getElementById("brand").innerHTML = 
    '<option value="">Select Brand</option>' + 
    brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");

  document.getElementById("productTableBody").innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>
        ${p.image_url ? `<img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;">` : ''}
        ${p.name}
      </td>
      <td>${p.categories?.name || "-"}</td>
      <td>${p.brands?.name || "-"}</td>
      <td>$${Number(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn edit" onclick="editProduct(${p.id})">
          <i class="fa fa-edit"></i>
        </button>
        <button class="btn delete" onclick="deleteProduct(${p.id})">
          <i class="fa fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");

  document.getElementById("addProductBtn")?.addEventListener("click", openAddProduct);
}

function openAddProduct() {
  editingProductId = null;
  document.getElementById("modalTitle").textContent = "Add Product";
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("category").value = "";
  document.getElementById("brand").value = "";
  document.getElementById("productImage").value = "";
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("imagePreview").src = "";

  document.getElementById("saveProductBtn").onclick = saveProduct;
  document.getElementById("modalBg").style.display = "flex";
}

async function saveProduct() {
  const fileInput = document.getElementById("productImage");
  const file = fileInput.files[0];

  const body = {
    name: document.getElementById("name").value.trim(),
    category_id: document.getElementById("category").value,
    brand_id: document.getElementById("brand").value,
    price: Number(document.getElementById("price").value),
    stock: Number(document.getElementById("stock").value),
  };

  if (!body.name || !body.category_id || !body.price) {
    alert("Please fill all required fields");
    return;
  }

  let imageUrl = null;

  // Upload image if selected
  if (file) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      alert("Image upload failed: " + uploadError.message);
      return;
    }

    // Get public URL
    const { data } = supabase.storage.from("products").getPublicUrl(fileName);
    imageUrl = data.publicUrl;
  }

  // Add image_url to body
  if (imageUrl) body.image_url = imageUrl;

  try {
    if (editingProductId) {
      await supabase.from("products").update(body).eq("id", editingProductId);
    } else {
      await supabase.from("products").insert(body);
    }
    closeAllModals();
    loadProducts();
  } catch (err) {
    alert("Failed to save product: " + err.message);
  }
}

async function editProduct(id) {
  const { data: p } = await supabase.from("products").select("*").eq("id", id).single();

  editingProductId = id;
  document.getElementById("modalTitle").textContent = "Edit Product";
  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price;
  document.getElementById("stock").value = p.stock;
  document.getElementById("brand").value = p.brand_id || "";
  document.getElementById("category").value = p.category_id || "";

  // Show current image if exists
  const preview = document.getElementById("imagePreview");
  if (p.image_url) {
    preview.src = p.image_url;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  document.getElementById("saveProductBtn").onclick = saveProduct;
  document.getElementById("modalBg").style.display = "flex";
}

async function deleteProduct(id) {
  if (!confirm("Delete this product permanently?")) return;

  // Optional: delete image from storage too
  const { data: product } = await supabase.from("products").select("image_url").eq("id", id).single();
  if (product?.image_url) {
    const fileName = product.image_url.split("/").pop();
    await supabase.storage.from("products").remove([fileName]);
  }

  await supabase.from("products").delete().eq("id", id);
  loadProducts();
}
async function loadOrders() {
  const { data: orders, error } = await supabase
  .from("orders")
  .select(`
    id,
    total,
    status,
    payment_method,
    shipping_address,
    created_at,

    customers:customer_id (
      name,
      email
    ),

    order_items (
      quantity,
      price,
      products:product_id (
        name
      )
    )
  `)
  .order("id", { ascending: false });


  // ALWAYS check for errors first!
  if (error) {
    console.error("Failed to load orders:", error);
    alert("Failed to load orders: " + error.message);
    
    // Optionally show empty the table
    const tbody = document.getElementById("ordersTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444;">Error loading orders: ${error.message}</td></tr>`;
    return;
  }

  // Now safe to assume orders is an array (or empty array)
  if (!orders) orders = []; // extra safety

  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const table = tbody.closest("table");
  const headerCols = table.querySelectorAll("thead th").length;

  // Update total count
  const totalEl = document.getElementById("totalOrders");
  if (totalEl) totalEl.textContent = orders.length;

  // === DASHBOARD (5 columns) ===
  if (headerCols === 5) {
    tbody.innerHTML = orders.slice(0, 5).map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customers?.name || '—'}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td>$${Number(o.total || 0).toFixed(2)}</td>
        <td><span class="status ${o.status}">${o.status || 'unknown'}</span></td>
      </tr>
    `).join("");
    return;
  }

  // === FULL ORDERS PAGE ===
  const theadRow = table.querySelector("thead tr");

  // Ensure 8 columns in header
  while (theadRow.children.length < 8) {
    if (theadRow.children.length === 6) {
      theadRow.insertAdjacentHTML("beforeend", "<th>Items</th><th>Actions</th>");
    } else if (theadRow.children.length === 7) {
      theadRow.insertAdjacentHTML("beforeend", "<th>Actions</th>");
    }
  }

  tbody.innerHTML = orders.map(o => {
    const items = (o.order_items || [])
      .map(i => `${i.products?.name || 'Unknown'} ×${i.quantity}`)
      .join("<br>") || "<em style='color:#999'>—</em>";

 return `
  <tr>
    <td><strong>#${o.id}</strong></td>
    <td>${fmtDate(o.created_at)}</td>
    <td>
      <div><strong>${o.customers?.name || '—'}</strong></div>
      <small style="color:#64748b;">${o.customers?.email || ''}</small>
    </td>
    <td style="font-size:13.5px; line-height:1.6;">${items}</td>
    <td style="color:#10b981; font-weight:600;">$${Number(o.total || 0).toFixed(2)}</td>
    <td style="text-transform:capitalize;">${o.payment_method || '—'}</td>
    <td><span class="status ${o.status}">${o.status || 'pending'}</span></td>

    <!-- ⭐ SHIPPING ADDRESS COLUMN -->
    <td>${o.shipping_address || '—'}</td>

    <td class="actions">
      <button class="btn view"   onclick="openOrder(${o.id})"><i class="fa fa-eye"></i></button>
      <button class="btn edit"   onclick="editOrder(${o.id})"><i class="fa fa-edit"></i></button>
      <button class="btn delete" onclick="deleteOrder(${o.id})"><i class="fa fa-trash"></i></button>
    </td>
  </tr>
`;

  }).join("");

  // If no orders
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8;">No orders found</td></tr>`;
  }
}
async function openOrder(id) {
  const { data: order } = await supabase.from("orders").select("*, customers(name,email)").eq("id",id).single();
  const { data: items } = await supabase.from("order_items").select("*, products(name)").eq("order_id",id);

  document.getElementById("modalOrderId").textContent = "#" + order.id;
  document.getElementById("modalCustomer").textContent = order.customers.name;
  document.getElementById("modalEmail").textContent = order.customers.email;
  document.getElementById("modalDate").textContent = fmtDate(order.created_at);
  document.getElementById("modalAddress").textContent = order.shipping_address;
  document.getElementById("modalItems").innerHTML = items.map(i => `<div>${i.products.name} × ${i.quantity} — $${i.price}</div>`).join("");
  document.getElementById("modalTotal").textContent = "$" + order.total;

  const select = document.getElementById("statusSelect");
  select.innerHTML = ["pending","processing","shipped","delivered","cancelled"]
    .map(s => `<option value="${s}" ${order.status===s?"selected":""}>${s}</option>`).join("");
  select.onchange = () => updateOrderStatus(id, select.value);

  document.getElementById("modalBg").style.display = "flex";
}

async function updateOrderStatus(id,status) {
  await supabase.from("orders").update({status}).eq("id",id);
  loadOrders();
}

// Edit Order (opens modal with form)
async function editOrder(id) {
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();

  // Reuse the same modal as View, but make fields editable
  document.getElementById("modalOrderId").textContent = `#${order.id} (Editing)`;
  document.getElementById("modalCustomer").innerHTML = `<strong>Customer:</strong> ${order.customers.name}`;
  document.getElementById("modalEmail").innerHTML = `<strong>Email:</strong> ${order.customers.email}`;
  document.getElementById("modalDate").textContent = fmtDate(order.created_at);
  
  // Make status editable
  document.getElementById("modalAddress").innerHTML = `
    <strong>Shipping Address:</strong><br>
    <textarea id="editShippingAddress" style="width:100%;padding:8px;margin-top:5px;">${order.shipping_address || ''}</textarea>
  `;

  const select = document.getElementById("statusSelect");
  select.innerHTML = ["pending","processing","shipped","delivered","cancelled"]
    .map(s => `<option value="${s}" ${order.status===s?"selected":""}>${s}</option>`).join("");

  // Change "View" button to "Save Changes"
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save Changes";
  saveBtn.className = "btn primary";
  saveBtn.onclick = async () => {
    await supabase.from("orders").update({
      status: select.value,
      shipping_address: document.getElementById("editShippingAddress").value
    }).eq("id", id);
    closeAllModals();
    loadOrders();
  };

  // Replace modal footer
  const modalFooter = document.querySelector("#modalBg .modal-footer") || document.createElement("div");
  modalFooter.innerHTML = "";
  modalFooter.appendChild(saveBtn);
  document.querySelector("#modalBg .modal-content").appendChild(modalFooter);

  document.getElementById("modalBg").style.display = "flex";
}

// Delete Order
async function deleteOrder(id) {
  if (!confirm(`Delete Order #${id} permanently? This cannot be undone.`)) return;

  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadToast("Order deleted successfully", "success");
  loadOrders();
}
// =====================================
// ANALYTICS
// =====================================
async function loadAnalytics() {
  const days = Number(document.getElementById("dateRange").value);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: orders } = await supabase.from("orders").select("*, order_items(price, quantity)").gte("created_at", since);

  const revenue = orders.reduce((s,o)=>s+Number(o.total),0);
  document.getElementById("totalRevenue").textContent = `$${revenue.toFixed(2)}`;

  const aov = revenue / Math.max(orders.length, 1);
  document.getElementById("avgOrderValue").textContent = `$${aov.toFixed(2)}`;

  // Sales Chart
  new Chart(document.getElementById("salesChart"), {
    type: "line",
    data: {
      labels: orders.map(o => fmtDate(o.created_at)),
      datasets: [{
        label: "Sales",
        data: orders.map(o => o.total),
        borderColor: "#6366f1",
        tension: 0.4
      }]
    }
  });

  // Status Chart
  const counts = orders.reduce((acc,o)=>{ acc[o.status]=(acc[o.status]||0)+1; return acc; },{});
  new Chart(document.getElementById("ordersChart"), {
    type: "bar",
    data: {
      labels: Object.keys(counts),
      datasets: [{ data: Object.values(counts), backgroundColor: ["#EF4444","#3B82F6","#10B981","#F59E0B","#6B7280"] }]
    }
  });
}
// =====================================
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      // Optional: Show "Logging out..." feedback
      const span = logoutBtn.querySelector("span") || logoutBtn;
      const originalText = span.textContent;
      span.textContent = "Logging out...";
      logoutBtn.style.pointerEvents = "none"; // disable double-click

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        alert("Logout failed: " + error.message);
        span.textContent = originalText;
        logoutBtn.style.pointerEvents = "auto";
      } else {
        // Force redirect to login page
        window.location.href = "adLogin.html";
      }
    });
  }

  // Optional: Protect admin pages — redirect to login if not authenticated
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      window.location.href = "adLogin.html";
    }
  });
});
