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
  if (PAGE === "index.html" || PAGE === "") loadDashboard();
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
// PRODUCTS
// =====================================
async function loadProducts() {
  const [{ data: categories }, { data: brands }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("brands").select("*"),
    supabase.from("products").select("*, categories(name), brands(name)").order("id")
  ]);

  document.getElementById("category").innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  document.getElementById("brand").innerHTML = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");

  document.getElementById("productTableBody").innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.categories?.name || "-"}</td>
      <td>${p.brands?.name || "-"}</td>
      <td>$${p.price}</td>
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
  document.getElementById("modalTitle").textContent = "Add Product";
  document.getElementById("saveProductBtn").onclick = saveProduct;
  document.getElementById("modalBg").style.display = "flex";
}

async function saveProduct() {
  const body = {
    name: document.getElementById("name").value,
    category_id: document.getElementById("category").value,
    brand_id: document.getElementById("brand").value,
    price: Number(document.getElementById("price").value),
    stock: Number(document.getElementById("stock").value),
  };

  await supabase.from("products").insert(body);
  location.reload();
}

async function editProduct(id) {
  const { data: p } = await supabase.from("products").select("*").eq("id", id).single();
  document.getElementById("modalTitle").textContent = "Edit Product";
  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price;
  document.getElementById("stock").value = p.stock;
  document.getElementById("brand").value = p.brand_id;
  document.getElementById("category").value = p.category_id;
  document.getElementById("saveProductBtn").onclick = () => updateProduct(id);
  document.getElementById("modalBg").style.display = "flex";
}

async function updateProduct(id) {
  const data = {
    name: document.getElementById("name").value,
    price: Number(document.getElementById("price").value),
    stock: Number(document.getElementById("stock").value),
    brand_id: document.getElementById("brand").value,
    category_id: document.getElementById("category").value,
  };
  await supabase.from("products").update(data).eq("id", id);
  location.reload();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  await supabase.from("products").delete().eq("id", id);
  location.reload();
}
async function loadOrders() {
  // Fetch orders + customer + all order items + product names in one query
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      customers(name, email),
      order_items (
        quantity,
        price,
        products ( name )
      )
    `)
    .order("id", { ascending: false });

  // Update total count (only on orders.html)
  const totalEl = document.getElementById("totalOrders");
  if (totalEl) totalEl.textContent = orders.length;

  const tableBody = document.getElementById("ordersTableBody");
  if (!tableBody) return;

  const table = tableBody.closest("table");
  const theadRow = table.querySelector("thead tr");

  // DASHBOARD (index.html) → only 5 recent orders, no items or actions
  if (theadRow && theadRow.children.length === 5) {
    tableBody.innerHTML = orders.slice(0, 5).map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customers.name}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td><span class="status ${o.status}">${o.status}</span></td>
      </tr>
    `).join("");
    return;
  }

  // ORDERS PAGE (orders.html) → full table
  // Add missing columns: Items + Actions
  if (theadRow && theadRow.children.length === 6) {
    theadRow.insertAdjacentHTML("beforeend", "<th>Items</th><th>Actions</th>");
  }

  // Render full orders with Items and Actions
  tableBody.innerHTML = orders.map(o => {
    const items = o.order_items || [];
    const itemsList = items.length > 0
      ? items.map(item => `${item.products.name} ×${item.quantity}`).join("<br>")
      : "<em style='color:#999'>No items</em>";

    return `
      <tr>
        <td>#${o.id}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td>${o.customers.name}<br><small>${o.customers.email}</small></td>
        <td><strong>$${Number(o.total).toFixed(2)}</strong></td>
        <td>${o.payment_method}</td>
        <td><span class="status ${o.status}">${o.status}</span></td>
        <td style="font-size:13px; line-height:1.4;">${itemsList}</td>
        <td class="actions">
          <button class="btn view" onclick="openOrder(${o.id})" title="View"><i class="fa fa-eye"></i></button>
          <button class="btn edit" onclick="editOrder(${o.id})" title="Edit"><i class="fa fa-edit"></i></button>
          <button class="btn delete" onclick="deleteOrder(${o.id})" title=""><i class="fa fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");
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

