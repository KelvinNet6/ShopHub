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
  t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:1rem 1.5rem;border-radius:8px;z-index:9999;font-size:14px;";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function safeJSONParse(val) {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== "string") return [];
  try { return JSON.parse(val); } catch { return []; }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ==================== DOM SETUP ====================
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

// ==================== PRODUCTS MODULE ====================
function openProductModal(product = null) {
  editingProductId = product?.id || null;
  document.getElementById("productName").value = product?.name || "";
  document.getElementById("category").value = product?.category || "";
  loadBrandOptions();
  document.getElementById("brand").value = product?.brand || "";
  document.getElementById("price").value = product?.price || "";
  document.getElementById("stock").value = product?.stock || "";
  document.getElementById("description").value = product?.description || "";
  modalBg.style.display = "flex";
}

function closeModal() {
  modalBg.style.display = "none";
  editingProductId = null;
}

function loadBrandOptions() {
  const cat = document.getElementById("category").value;
  const brandSelect = document.getElementById("brand");
  brandSelect.innerHTML = "<option value=''>Select Brand</option>";
  if (brands[cat]) brands[cat].forEach(b => brandSelect.innerHTML += `<option value="${b}">${b}</option>`);
}

async function loadProducts() {
  const { data, error } = await supabaseClient.from("products").select("*").order("created_at", { ascending: false });
  if (error) return showToast("Failed to load products");
  products = data || [];
  renderProducts(products);
}

function renderProducts(list) {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = list.length
    ? ""
    : `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">No products found</td></tr>`;
  list.forEach(p => {
    tbody.innerHTML += `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.category}</td>
      <td>${p.brand}</td>
      <td>$${Number(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>
        <button class="edit-btn" onclick="editProduct('${p.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteProduct('${p.id}')">Delete</button>
      </td>
    </tr>`;
  });
}

window.editProduct = (id) => {
  const p = products.find(x => x.id === id);
  if (!p) return;
  openProductModal(p);
};

async function saveProduct() {
  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("category").value;
  const brand = document.getElementById("brand").value;
  const price = parseFloat(document.getElementById("price").value);
  const stock = parseInt(document.getElementById("stock").value);
  const description = document.getElementById("description").value.trim();

  if (!name || !category || !brand || isNaN(price) || isNaN(stock)) return showToast("Please fill all fields");

  if (editingProductId) {
    const { error } = await supabaseClient.from("products").update({ name, category, brand, price, stock, description }).eq("id", editingProductId);
    if (error) return showToast("Failed to update product");
    showToast("Product updated");
  } else {
    const { error } = await supabaseClient.from("products").insert({ name, category, brand, price, stock, description });
    if (error) return showToast("Failed to add product");
    showToast("Product added");
  }
  closeModal();
  loadProducts();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) return showToast("Failed to delete product");
  showToast("Product deleted");
  loadProducts();
}

function runCurrentPageSearch() {
  const q = searchInput.value.toLowerCase();
  const page = document.body.dataset.page;
  if (page === "products") renderProducts(products.filter(p => p.name.toLowerCase().includes(q)));
  if (page === "orders") renderOrders(orders.filter(o => o.order_id.toLowerCase().includes(q)));
  if (page === "customers") renderCustomers(customers.filter(c => c.name.toLowerCase().includes(q)));
}

// ==================== ORDERS MODULE ====================
async function loadOrders() {
  const { data, error } = await supabaseClient.from("orders").select("*").order("date", { ascending: false });
  if (error) return showToast("Failed to load orders");
  orders = data || [];
  renderOrders(orders);
}

function renderOrders(list) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = list.length
    ? ""
    : `<tr><td colspan="8" style="text-align:center;padding:4rem;color:#64748b;">No orders found</td></tr>`;
  list.forEach(o => {
    tbody.innerHTML += `<tr>
      <td>${o.order_id}</td>
      <td>${o.customer_name || '—'}</td>
      <td>$${Number(o.total).toFixed(2)}</td>
      <td>${o.status}</td>
      <td>${formatDate(o.date)}</td>
      <td>${o.items ? safeJSONParse(o.items).length : 0}</td>
      <td>${o.address || '—'}</td>
      <td>
        <button class="view-btn" onclick="viewOrder('${o.id}')">View</button>
        <button class="delete-btn" onclick="deleteOrder('${o.id}')">Delete</button>
      </td>
    </tr>`;
  });
}

window.viewOrder = async (id) => {
  const o = orders.find(x => x.id === id);
  if (!o) return showToast("Order not found");
  currentOrderId = id;
  document.getElementById("orderModalId").textContent = o.order_id;
  document.getElementById("orderModalCustomer").textContent = o.customer_name || '—';
  document.getElementById("orderModalTotal").textContent = "$" + Number(o.total).toFixed(2);
  document.getElementById("orderModalStatus").textContent = o.status;
  document.getElementById("orderModalItems").innerHTML = safeJSONParse(o.items).map(i => `<div>${i.name} x${i.qty} - $${i.price}</div>`).join('');
  document.getElementById("orderModalAddress").textContent = o.address || '—';
  document.getElementById("orderModalBg").style.display = "flex";
};

async function deleteOrder(id) {
  if (!confirm("Delete this order?")) return;
  const { error } = await supabaseClient.from("orders").delete().eq("id", id);
  if (error) return showToast("Failed to delete order");
  showToast("Order deleted");
  loadOrders();
}

function filterOrders() {
  const status = statusFilter.value;
  renderOrders(status === "all" ? orders : orders.filter(o => o.status === status));
}

// ==================== CUSTOMERS MODULE ====================
let customerModalBg;
async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*, orders(count), orders!orders_customer_id_fkey(total:sum(total))")
    .order("created_at", { ascending: false });
  if (error) return showToast("Failed to load customers");
  customers = (data || []).map(c => ({
    ...c,
    orders_count: c.orders?.[0]?.count || 0,
    total_spent: c.orders?.[0]?.total || 0
  }));
  renderCustomers(customers);
}

function renderCustomers(list) {
  const tbody = document.getElementById("customersTableBody");
  const totalEl = document.getElementById("totalCustomers");
  if (!tbody) return;
  if (totalEl) totalEl.textContent = list.length;
  tbody.innerHTML = list.length
    ? ""
    : `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">No customers found</td></tr>`;
  list.forEach(c => {
    tbody.innerHTML += `<tr>
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
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById("customerModalName").textContent = c.name;
  document.getElementById("customerModalEmail").textContent = c.email || '—';
  document.getElementById("customerModalPhone").textContent = c.phone || '—';
  document.getElementById("customerModalAddress").textContent = c.address || '—';
  document.getElementById("customerModalJoined").textContent = formatDate(c.created_at);
  document.getElementById("customerModalOrders").textContent = c.orders_count;
  document.getElementById("customerModalSpent").textContent = "$" + Number(c.total_spent).toFixed(2);

  const recentOrders = orders.filter(o => o.customer_id === id).slice(0, 5);
  document.getElementById("customerOrdersList").innerHTML = recentOrders.length
    ? recentOrders.map(o => `<div>#${o.order_id} - $${o.total} (${o.status})</div>`).join('')
    : '<em>No orders yet</em>';

  customerModalBg.style.display = "flex";
};

function setupCustomerDOM() {
  customerModalBg = document.getElementById("customerModalBg");
  const closeBtn = document.getElementById("closeCustomerModal");
  if (closeBtn) closeBtn.onclick = () => customerModalBg.style.display = "none";
  if (customerModalBg) customerModalBg.onclick = e => e.target === customerModalBg && (customerModalBg.style.display = "none");
}

// ==================== ANALYTICS MODULE ====================
let charts = {};
async function loadAnalytics() {
  const range = document.getElementById("dateRange")?.value || 30;
  const fromDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
  const { data: ordersData, error } = await supabaseClient
    .from("orders")
    .select("id, date, total, status, items")
    .gte("date", fromDate)
    .order("date", { ascending: true });

  if (error || !ordersData) return showToast("Failed to load analytics");

  const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total), 0);
  const totalOrders = ordersData.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  document.getElementById("totalRevenue").textContent = "$" + totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 0});
  document.getElementById("totalOrders").textContent = totalOrders;
  document.getElementById("avgOrderValue").textContent = "$" + avgOrderValue.toFixed(2);
  document.getElementById("conversionRate").textContent = customers.length ? ((totalOrders / customers.length) * 100).toFixed(1) + "%" : "0%";

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

  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  charts.sales = new Chart(document.getElementById("salesChart"), {
    type: "line",
    data: { labels: Object.keys(dailySales), datasets: [{ label: "Revenue", data: Object.values(dailySales), borderColor: "#6366f1", tension: 0.4, fill: true }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: { labels: ["Pending","Processing","Shipped","Delivered","Cancelled"], datasets: [{ data: Object.values(statusCounts), backgroundColor: ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444"] }] },
    options: { responsive: true }
  });

  charts.categories = new Chart(document.getElementById("categoryChart"), {
    type: "pie",
    data: { labels: Object.keys(categorySales), datasets: [{ data: Object.values(categorySales), backgroundColor: ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"] }] },
    options: { responsive: true }
  });

  const productQty = {};
  ordersData.forEach(o => safeJSONParse(o.items).forEach(i => {
    const name = (i.name || "Unknown").substring(0, 20);
    productQty[name] = (productQty[name] || 0) + (i.qty || 1);
  }));

  const top5 = Object.entries(productQty).sort((a,b) => b[1]-a[1]).slice(0,5);
  const top5El = document.getElementById("topProductsList");
  if (top5El) top5El.innerHTML = top5.map(t => `<div>${t[0]} x${t[1]}</div>`).join("");
}

// ==================== INIT ====================
async function init() {
  setupDOM();
  setupCustomerDOM();
  const page = document.body.dataset.page;
  if (page === "products") await loadProducts();
  if (page === "orders") await loadOrders();
  if (page === "customers") await loadCustomers();
  if (page === "analytics") await loadAnalytics();
}

init();
