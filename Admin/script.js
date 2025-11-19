// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBALS ====================
let products = [];
let orders = [];
let customers = [];
let editingProductId = null;
let currentOrderId = null;

// Brands
const brands = {
  shoes: ["Nike", "Adidas", "Puma", "New Balance", "Vans", "Converse"],
  clothing: ["Zara", "H&M", "Uniqlo", "Levi's", "Gap"],
  accessories: ["Ray-Ban", "Casio", "Fossil", "Michael Kors"],
  electronics: ["Apple", "Samsung", "Sony", "Bose"]
};

// ==================== UTILS ====================
const showToast = (msg) => {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:1rem 1.5rem;border-radius:8px;z-index:9999;font-size:14px;opacity:0;transition:opacity 0.3s;";
  document.body.appendChild(t);
  setTimeout(() => t.style.opacity = 1, 10);
  setTimeout(() => {
    t.style.opacity = 0;
    setTimeout(() => t.remove(), 300);
  }, 3000);
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function safeJSONParse(val) {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== "string") return [];
  try { return JSON.parse(val); } catch { return []; }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==================== DOM SETUP ====================
let modalBg, addProductBtn, closeModalBtn, saveProductBtn, searchInput, statusFilter;
let customerModalBg;

function setupDOM() {
  modalBg = document.getElementById("modalBg");
  addProductBtn = document.getElementById("addProductBtn");
  closeModalBtn = document.getElementById("closeModal");
  saveProductBtn = document.getElementById("saveProductBtn");
  searchInput = document.getElementById("searchInput");
  statusFilter = document.getElementById("statusFilter");

  if (addProductBtn) addProductBtn.onclick = () => openProductModal();
  if (closeModalBtn) closeModalBtn.onclick = closeModal;
  if (saveProductBtn) saveProductBtn.onclick = saveProduct;
  if (searchInput) searchInput.onkeyup = debounce(runCurrentPageSearch, 300);
  if (statusFilter) statusFilter.onchange = filterOrders;
  if (modalBg) modalBg.onclick = (e) => e.target === modalBg && closeModal();

  const catSelect = document.getElementById("category");
  if (catSelect) catSelect.onchange = loadBrandOptions;
}
document.addEventListener("DOMContentLoaded", () => {
  setupDOM();
  setupCustomerDOM();

  // Load everything
  Promise.all([
    loadProducts(),
    loadOrders(),
    loadCustomers() // this now calls updateStats() inside
  ]).then(() => {
    if (document.querySelector(".stats-grid")) updateStats(); // extra safety
    if (document.getElementById("salesChart")) loadAnalytics();
  });

  document.getElementById("dateRange")?.addEventListener("change", loadAnalytics);
});
function setupCustomerDOM() {
  customerModalBg = document.getElementById("customerModalBg");
  const closeBtn = document.getElementById("closeCustomerModal");
  if (closeBtn) closeBtn.onclick = () => customerModalBg.style.display = "none";
  if (customerModalBg) customerModalBg.onclick = e => e.target === customerModalBg && (customerModalBg.style.display = "none");
}

// ADD THIS FUNCTION — This is what was missing!
async function updateStats() {
  // Total Customers
  document.getElementById("totalCustomers") && 
    (document.getElementById("totalCustomers").textContent = customers.length);

  // Total Revenue (all time)
  const { data, error } = await supabaseClient
    .from("orders")
    .select("total");

  if (!error && data) {
    const revenue = data.reduce((sum, o) => sum + Number(o.total), 0);
    document.getElementById("totalRevenueDash") && 
      (document.getElementById("totalRevenueDash").textContent = "$" + revenue.toLocaleString());
  }

  // Total Orders
  const { count } = await supabaseClient
    .from("orders")
    .select("*", { count: "exact", head: true });

  document.getElementById("totalOrdersDash") && 
    (document.getElementById("totalOrdersDash").textContent = count || 0);

  // Total Products
  document.getElementById("totalProductsDash") && 
    (document.getElementById("totalProductsDash").textContent = products.length);
}
// ==================== PRODUCTS (Example - keep your full working version) ====================
async function loadProducts() {
  const { data, error } = await supabaseClient.from("products").select("*").order("created_at", { ascending: false });
  if (error) { showToast("Failed to load products"); console.error(error); return; }
  products = data || [];
  renderProducts(products);
}

function renderProducts(list) {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = list.length ? "" : "<tr><td colspan='7'>No products found</td></tr>";
  list.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td><img src="${p.image || '/placeholder.jpg'}" class="w-12 h-12 object-cover rounded"></td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${p.brand || '—'}</td>
        <td>$${Number(p.price).toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>
          <button onclick="openProductModal(${p.id})" class="text-blue-600 hover:underline">Edit</button>
          <button onclick="deleteProduct(${p.id})" class="text-red-600 hover:underline ml-3">Delete</button>
        </td>
      </tr>`;
  });
}

function openProductModal(id = null) {
  editingProductId = id;
  const p = id ? products.find(x => x.id === id) : null;
  document.getElementById("productForm").reset();
  if (p) {
    document.getElementById("productName").value = p.name;
    document.getElementById("category").value = p.category;
    loadBrandOptions();
    document.getElementById("brand").value = p.brand || "";
    document.getElementById("price").value = p.price;
    document.getElementById("stock").value = p.stock;
    document.getElementById("productImage").value = p.image || "";
  }
  modalBg.style.display = "flex";
}

async function saveProduct() {
  const form = {
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("category").value,
    brand: document.getElementById("brand").value,
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value),
    image: document.getElementById("productImage").value.trim()
  };

  if (!form.name || !form.category || isNaN(form.price) || isNaN(form.stock)) {
    showToast("Please fill all required fields correctly");
    return;
  }

  let result;
  if (editingProductId) {
    result = await supabaseClient.from("products").update(form).eq("id", editingProductId);
  } else {
    result = await supabaseClient.from("products").insert([{ ...form, created_at: new Date().toISOString() }]);
  }

  const { error } = result;
  if (error) {
    showToast("Save failed");
    console.error(error);
  } else {
    showToast(editingProductId ? "Product updated" : "Product added");
    closeModal();
    loadProducts();
  }
}

function closeModal() {
  modalBg.style.display = "none";
  editingProductId = null;
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) showToast("Delete failed");
  else {
    showToast("Product deleted");
    loadProducts();
  }
}

function loadBrandOptions() {
  const cat = document.getElementById("category").value;
  const brandSelect = document.getElementById("brand");
  brandSelect.innerHTML = '<option value="">Select Brand</option>';
  if (brands[cat]) {
    brands[cat].forEach(b => {
      brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });
  }
}

// Search (generic)
function runCurrentPageSearch() {
  const term = searchInput.value.toLowerCase();
  if (document.getElementById("productTableBody")) {
    const filtered = products.filter(p => p.name.toLowerCase().includes(term) || (p.brand && p.brand.toLowerCase().includes(term)));
    renderProducts(filtered);
  }
  if (document.getElementById("ordersTableBody")) {
    const filtered = orders.filter(o => o.order_id.includes(term) || o.customer_name.toLowerCase().includes(term));
    renderOrders(filtered);
  }
}

// ==================== ORDERS (keep your full working version) ====================
async function loadOrders() {
  const { data, error } = await supabaseClient.from("orders").select("*, customers(name,email)").order("date", { ascending: false });
  if (error) { showToast("Failed to load orders"); return; }
  orders = data || [];
  renderOrders(orders);
  filterOrders(); // apply status filter if any
}

function renderOrders(list) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = list.length ? "" : "<tr><td colspan='6'>No orders found</td></tr>";
  list.forEach(o => {
    const customerName = o.customers?.name || "Walk-in";
    tbody.innerHTML += `
      <tr>
        <td>#${o.order_id}</td>
        <td>${customerName}</td>
        <td>${formatDate(o.date)}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td><span class="status-${o.status}">${o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span></td>
        <td><button onclick="viewOrder(${o.id})" class="text-blue-600 hover:underline">View</button></td>
      </tr>`;
  });
}

function filterOrders() {
  const status = statusFilter?.value || "all";
  const filtered = status === "all" ? orders : orders.filter(o => o.status === status);
  renderOrders(filtered);
}

window.viewOrder = (id) => {
  currentOrderId = id;
  const order = orders.find(o => o.id === id);
  if (!order) return;
  // implement order detail modal as needed
  alert(`Order #${order.order_id} - Total: $${order.total}`);
};

// ==================== CUSTOMERS — FULLY FIXED ====================
// REPLACE YOUR ENTIRE loadCustomers() and renderCustomers() with this:

async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select(`
      id, name, email, phone, address, created_at,
      orders(count),
      orders!orders_customer_id_fkey(total:sum(total))
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Customers load error:", error);
    showToast("Failed to load customers");
    return;
  }

  customers = (data || []).map(c => ({
    id: c.id,
    name: c.name || "Unknown",
    email: c.email || null,
    phone: c.phone || null,
    address: c.address || null,
    created_at: c.created_at,
    orders_count: c.orders[0]?.count || 0,
    total_spent: Number(c.orders[0]?.total || 0)
  }));

  renderCustomers(customers);
  updateStats(); // This fixes dashboard stats!
}

function renderCustomers(list) {
  const tbody = document.getElementById("customersTableBody");
  const totalEl = document.getElementById("totalCustomers");

  if (!tbody) return;
  if (totalEl) totalEl.textContent = list.length;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No customers found</td></tr>`;
    return;
  }

  tbody.innerHTML = ""; // clear first

  list.forEach(c => {
    const row = document.createElement("tr");
    row.className = "hover:bg-gray-50 cursor-pointer";
    row.onclick = () => viewCustomer(c.id);

    row.innerHTML = `
      <td class="font-medium py-3">${c.name}</td>
      <td class="text-gray-600">${c.email || '—'}</td>
      <td class="text-gray-600">${c.phone || '—'}</td>
      <td class="text-center font-medium">${c.orders_count}</td>
      <td class="font-medium text-green-600">$${c.total_spent.toFixed(2)}</td>
      <td class="text-sm text-gray-500">${formatDate(c.created_at)}</td>
    `;

    tbody.appendChild(row);
  });
}

window.viewCustomer = id => {
  const customer = customers.find(c => c.id === id);
  if (!customer) return;

  document.getElementById("customerModalName").textContent = customer.name;
  document.getElementById("customerModalEmail").textContent = customer.email || '—';
  document.getElementById("customerModalPhone").textContent = customer.phone || '—';
  document.getElementById("customerModalAddress").textContent = customer.address || '—';
  document.getElementById("customerModalJoined").textContent = formatDate(customer.created_at);
  document.getElementById("customerModalOrders").textContent = customer.orders_count;
  document.getElementById("customerModalSpent").textContent = `$${customer.total_spent.toFixed(2)}`;

  const recentOrders = orders.filter(o => o.customer_id === id).slice(0, 5);
  const listEl = document.getElementById("customerOrdersList");
  listEl.innerHTML = recentOrders.length
    ? recentOrders.map(o => `<li class="py-1">#${o.order_id} - $${o.total} <span class="text-sm text-gray-500">(${o.status})</span></li>`).join('')
    : '<li class="text-gray-500">No orders yet</li>';

  customerModalBg.style.display = "flex";
};

// ==================== ANALYTICS — FULLY FIXED ====================
let charts = {};

async function loadAnalytics() {
  const range = document.getElementById("dateRange")?.value || 30;
  const fromDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

  const { data: ordersData, error } = await supabaseClient
    .from("orders")
    .select("id, date, total, status, items")
    .gte("date", fromDate)
    .order("date", { ascending: true });

  if (error || !ordersData) {
    showToast("Failed to load analytics data");
    console.error(error);
    return;
  }

  const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total), 0);
  const totalOrders = ordersData.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  document.getElementById("totalRevenue").textContent = "$" + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 });
  document.getElementById("totalOrders").textContent = totalOrders;
  document.getElementById("avgOrderValue").textContent = "$" + avgOrderValue.toFixed(2);
  document.getElementById("conversionRate").textContent = customers.length ? ((totalOrders / customers.length) * 100).toFixed(1) + "%" : "0%";

  // Daily Sales
  const dailySales = {};
  const statusCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
  const categorySales = {};

  ordersData.forEach(o => {
    const dateKey = new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailySales[dateKey] = (dailySales[dateKey] || 0) + Number(o.total);
    statusCounts[o.status || "pending"]++;

    const items = safeJSONParse(o.items);
    items.forEach(item => {
      const cat = item.category || "Other";
      categorySales[cat] = (categorySales[cat] || 0) + (item.qty || 1) * (item.price || 0);
    });
  });

  // Destroy old charts
  Object.values(charts).forEach(c => c?.destroy?.());
  charts = {};

  // Sales Trend
  charts.sales = new Chart(document.getElementById("salesChart"), {
    type: "line",
    data: { labels: Object.keys(dailySales), datasets: [{ label: "Revenue", data: Object.values(dailySales), borderColor: "#6366f1", tension: 0.4, fill: true }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Status Doughnut
  charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444"] }]
    },
    options: { responsive: true }
  });

  // Categories Pie
  charts.categories = new Chart(document.getElementById("categoryChart"), {
    type: "pie",
    data: { labels: Object.keys(categorySales), datasets: [{ data: Object.values(categorySales), backgroundColor: ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"] }] },
    options: { responsive: true }
  });

  // Top Products Bar
  const productQty = {};
  ordersData.forEach(o => {
    safeJSONParse(o.items).forEach(i => {
      const name = (i.name || "Unknown").substring(0, 20);
      productQty[name] = (productQty[name] || 0) + (i.qty || 1);
    });
  });

  const top5 = Object.entries(productQty).sort((a,b) => b[1] - a[1]).slice(0,5);
  charts.topProducts = new Chart(document.getElementById("topProductsChart"), {
    type: "bar",
    data: { labels: top5.map(x => x[0]), datasets: [{ label: "Sold", data: top5.map(x => x[1]), backgroundColor: "#6366f1" }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// Dummy functions if not defined elsewhere
async function loadCategories() { /* your code */ }
async function updateStats() { /* your code */ }

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  setupDOM();
  setupCustomerDOM();
  loadCategories();
  if (document.getElementById("productTableBody")) loadProducts();
  if (document.getElementById("ordersTableBody")) loadOrders();
  if (document.getElementById("customersTableBody")) loadCustomers();
  if (document.querySelector(".stats-grid")) updateStats();
  if (document.getElementById("salesChart")) loadAnalytics();
  document.getElementById("dateRange")?.addEventListener("change", loadAnalytics);
});
