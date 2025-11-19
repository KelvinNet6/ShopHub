// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBALS ====================
let products = [], orders = [], customers = [];
let editingProductId = null;

// ==================== UTILS ====================
const showToast = (msg) => {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:1rem 1.5rem;border-radius:8px;z-index:9999;font-size:14px;";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function safeJSONParse(val) {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== "string") return [];
  try { return JSON.parse(val); } catch { return []; }
}

// ==================== DOM ELEMENTS ====================
let modalBg, customerModalBg;

// ==================== SETUP ====================
function setupDOM() {
  modalBg = document.getElementById("modalBg");
  customerModalBg = document.getElementById("customerModalBg");

  // Close modals
  document.querySelectorAll(".close-modal, #closeModal").forEach(el => {
    if (el) el.onclick = () => { modalBg && (modalBg.style.display = "none"); customerModalBg && (customerModalBg.style.display = "none"); };
  });
  if (modalBg) modalBg.onclick = (e) => e.target === modalBg && (modalBg.style.display = "none");
  if (customerModalBg) customerModalBg.onclick = (e) => e.target === customerModalBg && (customerModalBg.style.display = "none");
}

// ==================== DASHBOARD STATS ====================
async function updateDashboardStats() {
  const { data: orderData } = await supabase.from("orders").select("total");
  const revenue = orderData ? orderData.reduce((a, o) => a + Number(o.total), 0) : 0;

  const { count: orderCount } = await supabase.from("orders").select("*", { count: "exact", head: true });
  const { count: productCount } = await supabase.from("products").select("*", { count: "exact", head: true });

  if (document.getElementById("sales")) document.getElementById("sales").textContent = "$" + revenue.toLocaleString();
  if (document.getElementById("orders")) document.getElementById("orders").textContent = orderCount || 0;
  if (document.getElementById("products")) document.getElementById("products").textContent = productCount || 0;
  if (document.getElementById("customers")) document.getElementById("customers").textContent = customers.length;
}

// ==================== PRODUCTS PAGE ====================
async function loadProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) return showToast("Failed to load products");

  products = data || [];
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  tbody.innerHTML = products.length ? "" : "<tr><td colspan='7' class='text-center py-8 text-gray-500'>No products found</td></tr>";
  products.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.id.slice(0, 8)}</td>
        <td>${p.name}</td>
        <td>${p.category || '—'}</td>
        <td>${p.brand || '—'}</td>
        <td>$${Number(p.price).toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>
          <button onclick="editProduct('${p.id}')" class="text-blue-600 hover:underline mr-3">Edit</button>
          <button onclick="deleteProduct('${p.id}')" class="text-red-600 hover:underline">Delete</button>
        </td>
      </tr>`;
  });
}

window.editProduct = (id) => {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById("name").value = p.name;
  document.getElementById("category").value = p.category || "";
  document.getElementById("brand").value = p.brand || "";
  document.getElementById("price").value = p.price;
  document.getElementById("stock").value = p.stock;
  modalBg.style.display = "flex";
};

window.deleteProduct = async (id) => {
  if (!confirm("Delete this product?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) showToast("Delete failed");
  else { showToast("Product deleted"); loadProducts(); }
};

document.getElementById("addProductBtn")?.addEventListener("click", () => {
  editingProductId = null;
  document.getElementById("name").value = "";
  document.getElementById("category").value = "";
  document.getElementById("brand").value = "";
  document.getElementById("price").value = "";
  document.getElementById("stock").value = "";
  modalBg.style.display = "flex";
});

document.getElementById("saveProductBtn")?.addEventListener("click", async () => {
  const payload = {
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    brand: document.getElementById("brand").value,
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value)
  };

  if (!payload.name || isNaN(payload.price) || isNaN(payload.stock)) {
    showToast("Please fill all fields correctly");
    return;
  }

  const { error } = editingProductId
    ? await supabase.from("products").update(payload).eq("id", editingProductId)
    : await supabase.from("products").insert([payload]);

  if (error) showToast("Save failed");
  else {
    showToast(editingProductId ? "Product updated" : "Product added");
    modalBg.style.display = "none";
    loadProducts();
  }
});

// ==================== ORDERS PAGE ====================
async function loadOrders() {
  const { data, error } = await supabase.from("orders").select("*").order("date", { ascending: false });
  if (error) return showToast("Failed to load orders");

  orders = data || [];
  renderOrders(orders);
}

function renderOrders(list) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  tbody.innerHTML = list.length ? "" : "<tr><td colspan='8' class='text-center py-8 text-gray-500'>No orders found</td></tr>";

  list.forEach(o => {
    const items = safeJSONParse(o.items);
    tbody.innerHTML += `
      <tr onclick="viewOrder('${o.id}')">
        <td>#${o.order_id || o.id.slice(0,8)}</td>
        <td>${formatDate(o.date)}</td>
        <td>${o.customer_name || '—'}</td>
        <td>${items.length}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td>${o.payment || '—'}</td>
        <td><span class="status-${o.status}">${o.status}</span></td>
        <td><button onclick="event.stopPropagation(); viewOrder('${o.id}')">View</button></td>
      </tr>`;
  });
}

window.viewOrder = (id) => {
  const o = orders.find(x => x.id === id);
  if (!o) return;

  document.getElementById("modalOrderId").textContent = "#" + (o.order_id || o.id.slice(0,8));
  document.getElementById("modalCustomer").textContent = o.customer_name || '—';
  document.getElementById("modalEmail").textContent = o.customer_email || '—';
  document.getElementById("modalDate").textContent = formatDate(o.date);
  document.getElementById("modalAddress").textContent = o.address || '—';
  document.getElementById("modalTotal").textContent = "$" + Number(o.total).toFixed(2);

  const items = safeJSONParse(o.items);
  document.getElementById("modalItems").innerHTML = items.map(i => `<div>• ${i.name} × ${i.qty} — $${i.price}</div>`).join("");

  modalBg.style.display = "flex";
};

// ==================== CUSTOMERS (for dashboard) ====================
async function loadCustomersForStats() {
  const { data } = await supabase.from("customers").select("id");
  customers = data || [];
  updateDashboardStats();
}

// ==================== ANALYTICS PAGE ====================
let charts = {};

async function loadAnalytics() {
  const days = document.getElementById("dateRange")?.value || 30;
  const from = new Date(Date.now() - days * 86400000).toISOString();

  const { data: ordersData, error } = await supabase.from("orders").select("date, total, status, items").gte("date", from);
  if (error || !ordersData) return;

  const revenue = ordersData.reduce((a, o) => a + Number(o.total), 0);
  const avgOrder = ordersData.length ? revenue / ordersData.length : 0;
  const conversion = customers.length ? (ordersData.length / customers.length * 100).toFixed(1) : 0;

  // Update stats
  if (document.getElementById("totalRevenue")) document.getElementById("totalRevenue").textContent = "$" + revenue.toLocaleString();
  if (document.getElementById("avgOrderValue")) document.getElementById("avgOrderValue").textContent = "$" + avgOrder.toFixed(2);
  if (document.getElementById("conversionRate")) document.getElementById("conversionRate").textContent = conversion + "%";

  // Destroy old charts
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  // Sales Trend
  const daily = {};
  ordersData.forEach(o => {
    const date = new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    daily[date] = (daily[date] || 0) + Number(o.total);
  });

  charts.sales = new Chart(document.getElementById("salesChart"), {
    type: "line",
    data: { labels: Object.keys(daily), datasets: [{ label: "Revenue", data: Object.values(daily), borderColor: "#10b981", tension: 0.4, fill: true }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Orders by Status
  const statusCount = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
  ordersData.forEach(o => statusCount[o.status || "pending"]++);
  charts.orders = new Chart(document.getElementById("ordersChart"), {
    type: "doughnut",
    data: { labels: Object.keys(statusCount), datasets: [{ data: Object.values(statusCount), backgroundColor: ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444"] }] },
    options: { responsive: true }
  });

  // Top Categories
  const catSales = {};
  ordersData.forEach(o => {
    safeJSONParse(o.items).forEach(i => {
      const cat = i.category || "Other";
      catSales[cat] = (catSales[cat] || 0) + (i.qty * i.price);
    });
  });

  charts.categories = new Chart(document.getElementById("categoriesChart"), {
    type: "pie",
    data: { labels: Object.keys(catSales), datasets: [{ data: Object.values(catSales), backgroundColor: ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"] }] },
    options: { responsive: true }
  });
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", async () => {
  setupDOM();

  const path = location.pathname.split("/").pop() || "index.html";

  if (path.includes("dashboard") || path === "index.html") {
    await Promise.all([loadOrders(), loadCustomersForStats()]);
    updateDashboardStats();
  }

  if (path.includes("products")) await loadProducts();
  if (path.includes("orders")) await loadOrders();
  if (path.includes("analytics")) {
    await loadCustomersForStats();
    await loadAnalytics();
    document.getElementById("dateRange").addEventListener("change", loadAnalytics);
  }
});
