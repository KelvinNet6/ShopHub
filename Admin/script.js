// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBALS ====================
let products = [], orders = [], customers = [];
let editingProductId = null;
let charts = {};

// ==================== UTILS ====================
const showToast = (msg, error = false) => {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:20px;right:20px;padding:1rem 1.5rem;border-radius:8px;z-index:9999;color:white;font-size:14px;${error ? 'background:#ef4444' : 'background:#10b981'}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const safeJSONParse = (val) => {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== "string") return [];
  try { return JSON.parse(val); } catch { return []; }
};

// ==================== DASHBOARD ====================
async function loadDashboard() {
  try {
    const [ordersRes, productsRes, customersRes] = await Promise.all([
      supabase.from("orders").select("total", { count: "exact" }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("customers").select("id", { count: "exact", head: true })
    ]);

    const revenue = ordersRes.data?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
    const totalOrders = ordersRes.count || 0;
    const totalProducts = productsRes.count || 0;
    const totalCustomers = customersRes.count || 0;

    document.getElementById("sales") && (document.getElementById("sales").textContent = "$" + revenue.toLocaleString());
    document.getElementById("orders") && (document.getElementById("orders").textContent = totalOrders);
    document.getElementById("products") && (document.getElementById("products").textContent = totalProducts);
    document.getElementById("customers") && (document.getElementById("customers").textContent = totalCustomers);
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

// ==================== PRODUCTS PAGE ====================
async function loadProducts() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) { showToast("Failed to load products", true); return; }

  products = data || [];
  tbody.innerHTML = products.length ? "" : `<tr><td colspan="7" class="text-center py-12 text-gray-500">No products found</td></tr>`;

  products.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.id.slice(-8)}</td>
        <td class="font-medium">${p.name}</td>
        <td>${p.category || '—'}</td>
        <td>${p.brand || '—'}</td>
        <td>$${Number(p.price).toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>
          <button onclick="openProductModal('${p.id}')" class="text-blue-600 hover:underline mr-4">Edit</button>
          <button onclick="deleteProduct('${p.id}')" class="text-red-600 hover:underline">Delete</button>
        </td>
      </tr>`;
  });
}

window.openProductModal = (id = null) => {
  editingProductId = id;
  const p = id ? products.find(x => x.id === id) : null;

  document.getElementById("name").value = p?.name || "";
  document.getElementById("category").value = p?.category || "";
  document.getElementById("brand").value = p?.brand || "";
  document.getElementById("price").value = p?.price || "";
  document.getElementById("stock").value = p?.stock || "";

  document.querySelector("#modalBg")?.style = "display:flex";
};

window.deleteProduct = async (id) => {
  if (!confirm("Delete this product?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) showToast("Delete failed", true);
  else { showToast("Product deleted"); loadProducts(); }
};

document.getElementById("saveProductBtn")?.addEventListener("click", async () => {
  const payload = {
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    brand: document.getElementById("brand").value,
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value)
  };

  if (!payload.name || isNaN(payload.price) || isNaN(payload.stock)) {
    showToast("Fill all fields correctly", true);
    return;
  }

  const { error } = editingProductId
    ? await supabase.from("products").update(payload).eq("id", editingProductId)
    : await supabase.from("products").insert([payload]);

  if (error) showToast("Save failed", true);
  else {
    showToast(editingProductId ? "Updated!" : "Added!");
    document.querySelector("#modalBg").style.display = "none";
    loadProducts();
  }
});

// ==================== ORDERS PAGE ====================
async function loadOrders() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const { data, error } = await supabase.from("orders").select("*").order("date", { ascending: false });
  if (error) { showToast("Failed to load orders", true); return; }

  orders = data || [];
  renderOrders(orders);
}

function renderOrders(list) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  tbody.innerHTML = list.length ? "" : `<tr><td colspan="8" class="text-center py-12 text-gray-500">No orders found</td></tr>`;

  list.forEach(o => {
    const items = safeJSONParse(o.items);
    tbody.innerHTML += `
      <tr class="cursor-pointer hover:bg-gray-50" onclick="viewOrder('${o.id}')">
        <td>#${o.order_id || o.id.slice(-6)}</td>
        <td>${formatDate(o.date)}</td>
        <td>${o.customer_name || 'Guest'}</td>
        <td>${items.length}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td>${o.payment || '—'}</td>
        <td><span class="px-3 py-1 rounded text-xs ${o.status === 'delivered' ? 'bg-green-100 text-green-800' : o.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">${o.status || 'pending'}</span></td>
        <td><button onclick="event.stopPropagation(); viewOrder('${o.id}')">View</button></td>
      </tr>`;
  });
}

window.viewOrder = (id) => {
  const o = orders.find(x => x.id === id);
  if (!o) return;

  document.getElementById("modalOrderId").textContent = "#" + (o.order_id || o.id.slice(-6));
  document.getElementById("modalCustomer").textContent = o.customer_name || 'Guest';
  document.getElementById("modalEmail").textContent = o.customer_email || '—';
  document.getElementById("modalDate").textContent = formatDate(o.date);
  document.getElementById("modalAddress").textContent = o.address || '—';
  document.getElementById("modalTotal").textContent = "$" + Number(o.total).toFixed(2);

  const items = safeJSONParse(o.items);
  document.getElementById("modalItems").innerHTML = items.length
    ? items.map(i => `<div class="py-2">• ${i.name} × ${i.qty} — $${(i.price * i.qty).toFixed(2)}</div>`).join("")
    : "<em>No items</em>";

  document.querySelector("#modalBg").style.display = "flex";
};

// ==================== ANALYTICS PAGE ====================
async function loadAnalytics() {
  const days = document.getElementById("dateRange")?.value || 30;
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: ordersData, error } = await supabase
    .from("orders")
    .select("date, total, status, items")
    .gte("date", fromDate);

  if (error || !ordersData) {
    showToast("Analytics failed to load", true);
    return;
  }

  const revenue = ordersData.reduce((a, o) => a + Number(o.total), 0);
  const avgOrder = ordersData.length ? revenue / ordersData.length : 0;

  // Update stats
  if (document.getElementById("totalRevenue")) document.getElementById("totalRevenue").textContent = "$" + revenue.toLocaleString();
  if (document.getElementById("avgOrderValue")) document.getElementById("avgOrderValue").textContent = "$" + avgOrder.toFixed(2);
  if (document.getElementById("conversionRate")) {
    const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
    const rate = count ? (ordersData.length / count * 100).toFixed(1) : 0;
    document.getElementById("conversionRate").textContent = rate + "%";
  }

  // Destroy old charts
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  // Sales Trend
  const dailySales = {};
  ordersData.forEach(o => {
    const key = new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailySales[key] = (dailySales[key] || 0) + Number(o.total);
  });

  charts.sales = new Chart(document.getElementById("salesChart"), {
    type: "line",
    data: { labels: Object.keys(dailySales), datasets: [{ label: "Revenue", data: Object.values(dailySales), borderColor: "#10b981", tension: 0.4, fill: true }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Status Chart
  const statusCount = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
  ordersData.forEach(o => statusCount[o.status || "pending"]++);
  charts.status = new Chart(document.getElementById("ordersChart"), {
    type: "doughnut",
    data: { labels: Object.keys(statusCount), datasets: [{ data: Object.values(statusCount), backgroundColor: ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444"] }] },
    options: { responsive: true }
  });

  // Categories
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
  const path = location.pathname.split("/").pop() || "index.html";

  // Close modals
  document.querySelectorAll(".modal-bg, .close-modal").forEach(el => {
    el.onclick = (e) => {
      if (e.target.classList.contains("modal-bg") || e.target.classList.contains("close-modal")) {
        document.querySelectorAll(".modal-bg").forEach(m => m.style.display = "none");
      }
    };
  });

  // Load correct page
  if (path.includes("index") || path === "") await loadDashboard();
  if (path.includes("products")) await loadProducts();
  if (path.includes("orders")) await loadOrders();
  if (path.includes("analytics")) {
    await loadAnalytics();
    document.getElementById("dateRange")?.addEventListener("change", loadAnalytics);
  }

  // Add product button
  document.getElementById("addProductBtn")?.addEventListener("click", () => openProductModal());
});
