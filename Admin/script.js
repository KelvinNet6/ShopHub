// ==================== SUPABASE CLIENT (FIXED ORDER) ====================
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

// This line MUST come after the constants above
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBALS ====================
let products = [];
let orders = [];
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
  t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:1rem 1.5rem;border-radius:8px;z-index:9999;font-size:14px;";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ==================== DOM SETUP (Runs on every page) ====================
let modalBg, addProductBtn, closeModalBtn, saveProductBtn, searchInput, statusFilter;

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

// ==================== PRODUCTS ====================
async function loadProducts() {
  const { data, error } = await supabaseClient.from("products").select("*");
  if (error) return showToast("Failed to load products");
  products = data || [];
  renderProducts(products);
}

function renderProducts(list) {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">No products found</td></tr>`;
    return;
  }
  list.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>#${p.id}</td>
        <td><strong>${p.name}</strong></td>
        <td><span class="tag">${p.category}</span></td>
        <td>${p.brand}</td>
        <td><strong style="color:var(--primary)">$${Number(p.price).toFixed(2)}</strong></td>
        <td><span class="${p.stock < 20 ? 'stock-low' : 'stock-ok'}">${p.stock} ${p.stock < 20 ? 'Low Stock' : 'In Stock'}</span></td>
        <td>
          <button class="action-btn edit" onclick="editProduct(${p.id})">Edit</button>
          <button class="action-btn delete" onclick="deleteProduct(${p.id})">Delete</button>
        </td>
      </tr>`;
  });
}

function loadCategories() {
  const select = document.getElementById("category");
  if (!select) return;
  select.innerHTML = `<option value="">Select category</option>`;
  Object.keys(brands).forEach(cat => {
    const opt = new Option(cat.charAt(0).toUpperCase() + cat.slice(1), cat);
    select.appendChild(opt);
  });
}

function loadBrandOptions() {
  const cat = document.getElementById("category")?.value;
  const brandSelect = document.getElementById("brand");
  if (!brandSelect) return;
  brandSelect.innerHTML = `<option value="">Select brand</option>`;
  brands[cat]?.forEach(b => brandSelect.add(new Option(b, b)));
}

function openProductModal(edit = false) {
  if (!modalBg) return;
  modalBg.style.display = "flex";
  document.getElementById("modalTitle").textContent = edit ? "Edit Product" : "Add Product";
  if (!edit) {
    editingProductId = null;
    document.getElementById("category").value = "";
    document.getElementById("brand").innerHTML = `<option value="">Select brand</option>`;
    ["name", "price", "stock"].forEach(id => document.getElementById(id).value = "");
  }
}

function closeModal() {
  if (modalBg) modalBg.style.display = "none";
  currentOrderId = null;
}

window.editProduct = (id) => {
  editingProductId = id;
  const p = products.find(x => x.id === id);
  openProductModal(true);
  document.getElementById("category").value = p.category;
  loadBrandOptions();
  setTimeout(() => document.getElementById("brand").value = p.brand, 0);
  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price;
  document.getElementById("stock").value = p.stock;
};

window.deleteProduct = async (id) => {
  if (!confirm("Delete this product permanently?")) return;
  await supabaseClient.from("products").delete().eq("id", id);
  loadProducts();
  updateStats();
};

async function saveProduct() {
  const product = {
    category: document.getElementById("category").value,
    brand: document.getElementById("brand").value,
    name: document.getElementById("name").value.trim(),
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value)
  };
  if (Object.values(product).some(v => !v || isNaN(v))) return showToast("Fill all fields correctly!");

  if (editingProductId)
    await supabaseClient.from("products").update(product).eq("id", editingProductId);
  else
    await supabaseClient.from("products").insert(product);

  closeModal();
  loadProducts();
  updateStats();
}

// ==================== ORDERS ====================
async function loadOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, customers(name, email)")
    .order("date", { ascending: false });

  if (error) return showToast("Failed to load orders");

  orders = data.map(o => ({
    ...o,
    customer: o.customers?.name || "Walk-in",
    email: o.customers?.email || ""
  }));

  renderOrders(orders);
}

function renderOrders(list) {
  const tbody = document.getElementById("ordersTableBody");
  const totalEl = document.getElementById("totalOrders");
  if (!tbody) return;
  if (totalEl) totalEl.textContent = list.length;

  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:4rem;color:#64748b;">No orders found</td></tr>`;
    return;
  }

  list.forEach(o => {
    let items = [];
    try {
      // This safely parses both real JSON and stringified JSON
      items = typeof o.items === "string" ? JSON.parse(o.items) : o.items || [];
    } catch (e) {
      console.warn("Bad items data:", o.items);
      items = [];
    }

    const itemsCount = items.length;

    tbody.innerHTML += `
      <tr>
        <td><strong>#${o.order_id}</strong></td>
        <td>${formatDate(o.date)}</td>
        <td><div><strong>${o.customer}</strong><br><small>${o.email || ''}</small></div></td>
        <td>${itemsCount} item${itemsCount > 1 ? "s" : ""}</td>
        <td><strong>$${Number(o.total).toFixed(2)}</strong></td>
        <td><span class="badge payment-${o.payment}">${(o.payment || 'card').toUpperCase()}</span></td>
        <td><span class="badge status-${o.status}">${(o.status || 'pending').toUpperCase()}</span></td>
        <td><button class="view-btn" onclick="viewOrder('${o.id}')">View</button></td>
      </tr>`;
  });
}

function runCurrentPageSearch() {
  const query = (searchInput?.value || "").toLowerCase();
  if (document.getElementById("productTableBody")) {
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.id.toString().includes(query)
    );
    renderProducts(filtered);
  } else if (document.getElementById("ordersTableBody")) {
    filterOrders();
  }
}

function filterOrders() {
  const query = (searchInput?.value || "").toLowerCase();
  const status = statusFilter?.value || "all";
  const filtered = orders.filter(o => {
    const matchesSearch = o.order_id.toString().includes(query) ||
                          o.customer.toLowerCase().includes(query) ||
                          o.email.toLowerCase().includes(query);
    const matchesStatus = status === "all" || o.status === status;
    return matchesSearch && matchesStatus;
  });
  renderOrders(filtered);
}

window.viewOrder = (id) => {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  currentOrderId = id;
  document.getElementById("modalOrderId").textContent = `#${order.order_id}`;
  document.getElementById("modalCustomer").textContent = order.customer;
  document.getElementById("modalEmail").textContent = order.email || "—";
  document.getElementById("modalDate").textContent = formatDate(order.date);
  document.getElementById("modalTotal").textContent = `$${Number(order.total).toFixed(2)}`;

  const itemsDiv = document.getElementById("modalItems");
  itemsDiv.innerHTML = "<em>Loading items...</em>";

  let items = [];
  try {
    items = typeof order.items === "string" ? JSON.parse(order.items) : order.items || [];
  } catch (e) {
    itemsDiv.innerHTML = "<em>Invalid items data</em>";
    console.error("Failed to parse items:", order.items);
    return;
  }

  itemsDiv.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-item";
    div.innerHTML = `<span>${item.qty || 1} × ${item.name || 'Unknown'}</span><span>$${( (item.qty || 1) * (item.price || 0) ).toFixed(2)}</span>`;
    itemsDiv.appendChild(div);
  });

  // Populate status dropdown
  const select = document.getElementById("statusSelect");
  select.innerHTML = "";
  ["pending","processing","shipped","delivered","cancelled"].forEach(s => {
    select.add(new Option(s.charAt(0).toUpperCase() + s.slice(1), s, false, s === order.status));
  });

  modalBg.style.display = "flex";
};

window.updateOrderStatus = async () => {
  if (!currentOrderId) return;
  const newStatus = document.getElementById("statusSelect").value;
  await supabaseClient.from("orders").update({ status: newStatus }).eq("id", currentOrderId);
  closeModal();
  loadOrders();
  updateStats();
};

// ==================== STATS (Dashboard only) ====================
async function updateStats() {
  const salesRes = await supabaseClient.from("orders").select("total");
  const totalSales = salesRes.data?.reduce((a, c) => a + Number(c.total), 0) || 0;
  const { count: ordersCount } = await supabaseClient.from("orders").select("*", { count: "exact", head: true });
  const { count: prodCount } = await supabaseClient.from("products").select("*", { count: "exact", head: true });
  const { count: custCount } = await supabaseClient.from("customers").select("*", { count: "exact", head: true });

  if (document.getElementById("sales")) document.getElementById("sales").textContent = "$" + totalSales.toLocaleString();
  if (document.getElementById("orders")) document.getElementById("orders").textContent = ordersCount || 0;
  if (document.getElementById("products")) document.getElementById("products").textContent = prodCount || 0;
  if (document.getElementById("customers")) document.getElementById("customers").textContent = custCount || 0;
}

// ==================== INIT ====================
function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

document.addEventListener("DOMContentLoaded", () => {
  setupDOM();
  loadCategories();

  // Run only what exists on current page
  if (document.getElementById("productTableBody")) loadProducts();
  if (document.getElementById("ordersTableBody")) loadOrders();
  if (document.querySelector(".stats-grid")) updateStats();
});

// ==================== CUSTOMERS ====================
let customers = [];

async function loadCustomers() {
  const { data } = await supabase
    .from("customers")
    .select("*, orders!inner(count, total:sum(total))")
    .order("created_at", { ascending: false });

  customers = (data || []).map(c => ({
    ...c,
    orders_count: c.orders?.count || 0,
    total_spent: c.orders?.total || 0
  }));

  renderCustomers(customers);
}

function renderCustomers(list) {
  const tbody = document.getElementById("customersTableBody");
  const totalEl = document.getElementById("totalCustomers");
  if (!tbody) return;
  if (totalEl) totalEl.textContent = list.length;

  tbody.innerHTML = list.length ? "" : `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">No customers found</td></tr>`;

  list.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.email || '—'}</td>
        <td>${c.phone || '—'}</td>
        <td><span class="badge">${c.orders_count}</span></td>
        <td><strong>$${Number(c.total_spent).toFixed(2)}</strong></td>
        <td>${formatDate(c.created_at)}</td>
        <td><button class="view-btn" onclick="viewCustomer('${c.id}')">View</button></td>
      </tr>`;
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
  document.getElementById("customerModalSpent").textContent = `$${Number(customer.total_spent).toFixed(2)}`;

  // Load recent orders
  const recentOrders = orders.filter(o => o.customer_id === id).slice(0, 5);
  const ordersList = document.getElementById("customerOrdersList");
  ordersList.innerHTML = recentOrders.length ? recentOrders.map(o => `<div>#${o.order_id} - $${o.total} (${o.status})</div>`).join('') : '<em>No orders yet</em>';

  document.getElementById("customerModalBg").style.display = "flex";
};

let customerModalBg, closeCustomerModal;
function setupCustomerDOM() {
  customerModalBg = document.getElementById("customerModalBg");
  closeCustomerModal = document.getElementById("closeCustomerModal");
  if (closeCustomerModal) closeCustomerModal.onclick = () => customerModalBg.style.display = "none";
  if (customerModalBg) customerModalBg.onclick = e => e.target === customerModalBg && (customerModalBg.style.display = "none");
}

// ==================== ANALYTICS ====================
let salesChart, ordersChart, categoriesChart;

async function loadAnalytics() {
  const range = document.getElementById("dateRange")?.value || 30;
  const { data: ordersData } = await supabase.from("orders").select("*").gte("date", new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString());

  // Metrics
  const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total), 0);
  const orderCount = ordersData.length;
  const avgOrderValue = orderCount ? totalRevenue / orderCount : 0;
  const conversionRate = orderCount / customers.length * 100 || 0; // Simulated
  const growthRate = 12.5; // Simulated - calculate from previous period

  document.getElementById("totalRevenue").textContent = `$${totalRevenue.toLocaleString()}`;
  document.getElementById("conversionRate").textContent = `${conversionRate.toFixed(1)}%`;
  document.getElementById("avgOrderValue").textContent = `$${avgOrderValue.toFixed(2)}`;
  document.getElementById("growthRate").textContent = `+${growthRate}%`;

  // Charts Data
  const dailySales = {};
  const statusCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
  const categoryTotals = {};

  ordersData.forEach(o => {
    const date = new Date(o.date).toLocaleDateString();
    dailySales[date] = (dailySales[date] || 0) + Number(o.total);
    statusCounts[o.status]++;
    const items = safeJSONParse(o.items);
    items.forEach(item => {
      const cat = item.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.qty * item.price);
    });
  });

  // Sales Chart (Line)
  const salesCtx = document.getElementById("salesChart")?.getContext("2d");
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(salesCtx, {
    type: "line",
    data: {
      labels: Object.keys(dailySales),
      datasets: [{ label: "Sales ($)", data: Object.values(dailySales), borderColor: "#6366f1", fill: false }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });

  // Orders Chart (Bar)
  const ordersCtx = document.getElementById("ordersChart")?.getContext("2d");
  if (ordersChart) ordersChart.destroy();
  ordersChart = new Chart(ordersCtx, {
    type: "bar",
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{ label: "Orders", data: Object.values(statusCounts), backgroundColor: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#6b7280"] }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });

  // Categories Chart (Pie)
  const catCtx = document.getElementById("categoriesChart")?.getContext("2d");
  if (categoriesChart) categoriesChart.destroy();
  categoriesChart = new Chart(catCtx, {
    type: "pie",
    data: {
      labels: Object.keys(categoryTotals),
      datasets: [{ data: Object.values(categoryTotals), backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"] }]
    },
    options: { responsive: true }
  });
}

// ==================== UPDATE INIT (Add these lines) ====================
document.addEventListener("DOMContentLoaded", () => {
  setupDOM();
  setupCustomerDOM();  // ← Add this
  loadCategories();

  if (document.getElementById("productTableBody")) loadProducts();
  if (document.getElementById("ordersTableBody")) loadOrders();
  if (document.getElementById("customersTableBody")) loadCustomers();  // ← Add this
  if (document.querySelector(".stats-grid") && !document.getElementById("productTableBody")) updateStats();  // Dashboard only
  if (document.getElementById("salesChart")) loadAnalytics();  // ← Add this

  const dateRange = document.getElementById("dateRange");
  if (dateRange) dateRange.onchange = loadAnalytics;
});
