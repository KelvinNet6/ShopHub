// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBALS ====================
let products = [], orders = [], customers = [];
let editingProductId = null, currentOrderId = null;

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

const debounce = (fn, wait) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
};

// ==================== DOM SETUP ====================
let modalBg, customerModalBg;

function setupDOM() {
  modalBg = document.getElementById("modalBg");
  customerModalBg = document.getElementById("customerModalBg");

  document.getElementById("addProductBtn")?.addEventListener("click", () => openProductModal());
  document.getElementById("closeModal")?.addEventListener("click", closeModal);
  document.getElementById("saveProductBtn")?.addEventListener("click", saveProduct);
  document.getElementById("searchInput")?.addEventListener("keyup", debounce(runCurrentPageSearch, 300));
  document.getElementById("statusFilter")?.addEventListener("change", filterOrders);
  document.getElementById("category")?.addEventListener("change", loadBrandOptions);

  modalBg?.addEventListener("click", e => e.target === modalBg && closeModal());
  customerModalBg?.addEventListener("click", e => e.target === customerModalBg && (customerModalBg.style.display = "none"));
  document.getElementById("closeCustomerModal")?.addEventListener("click", () => customerModalBg.style.display = "none");
}

// ==================== PRODUCTS ====================
async function loadProducts() {
  const { data } = await supabaseClient.from("products").select("*");
  products = data || [];
  renderProducts(products);
}

function renderProducts(list) {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = list.length ? "" : `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">No products found</td></tr>`;
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
  const s = document.getElementById("category");
  if (!s) return;
  s.innerHTML = `<option value="">Select category</option>`;
  Object.keys(brands).forEach(c => s.add(new Option(c.charAt(0).toUpperCase() + c.slice(1), c)));
}

function loadBrandOptions() {
  const cat = document.getElementById("category")?.value;
  const b = document.getElementById("brand");
  if (!b) return;
  b.innerHTML = `<option value="">Select brand</option>`;
  brands[cat]?.forEach(br => b.add(new Option(br, br)));
}

function openProductModal(edit = false) {
  modalBg.style.display = "flex";
  document.getElementById("modalTitle").textContent = edit ? "Edit Product" : "Add Product";
  if (!edit) {
    editingProductId = null;
    document.getElementById("category").value = "";
    document.getElementById("brand").innerHTML = `<option value="">Select brand</option>`;
    ["name", "price", "stock"].forEach(id => document.getElementById(id).value = "");
  }
}

window.editProduct = id => {
  editingProductId = id;
  const p = products.find(x => x.id === id);
  openProductModal(true);
  document.getElementById("category").value = p.category;
  loadBrandOptions();
  setTimeout(() => document.getElementById("brand").value = p.brand, 0);
  ["name", "price", "stock"].forEach(f => document.getElementById(f).value = p[f]);
};

window.deleteProduct = async id => {
  if (confirm("Delete permanently?")) {
    await supabaseClient.from("products").delete().eq("id", id);
    loadProducts();
  }
};

async function saveProduct() {
  const product = {
    category: document.getElementById("category").value,
    brand: document.getElementById("brand").value,
    name: document.getElementById("name").value.trim(),
    price: +document.getElementById("price").value,
    stock: +document.getElementById("stock").value
  };
  if (!product.category || !product.brand || !product.name || isNaN(product.price) || isNaN(product.stock)) {
    return showToast("Fill all fields correctly");
  }
  if (editingProductId)
    await supabaseClient.from("products").update(product).eq("id", editingProductId);
  else
    await supabaseClient.from("products").insert(product);
  modalBg.style.display = "none";
  loadProducts();
}

// ==================== ORDERS ====================
async function loadOrders() {
  const { data } = await supabaseClient.from("orders").select("*, customers(name, email)").order("date", { ascending: false });
  orders = (data || []).map(o => ({
    ...o,
    customer: o.customers?.name || "Walk-in",
    email: o.customers?.email || "",
    items: safeJSONParse(o.items)
  }));
  renderOrders(orders);
}

function renderOrders(list) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  document.getElementById("totalOrders") && (document.getElementById("totalOrders").textContent = list.length);
  tbody.innerHTML = list.length ? "" : `<tr><td colspan="8" style="text-align:center;padding:4rem;color:#64748b;">No orders</td></tr>`;
  list.forEach(o => {
    tbody.innerHTML += `
      <tr>
        <td><strong>#${o.order_id}</strong></td>
        <td>${formatDate(o.date)}</td>
        <td><div><strong>${o.customer}</strong><br><small>${o.email}</small></div></td>
        <td>${o.items.length} item${o.items.length > 1 ? "s" : ""}</td>
        <td><strong>$${Number(o.total).toFixed(2)}</strong></td>
        <td><span class="badge payment-${o.payment || "card"}">${(o.payment || "card").toUpperCase()}</span></td>
        <td><span class="badge status-${o.status || "pending"}">${(o.status || "pending").toUpperCase()}</span></td>
        <td><button class="view-btn" onclick="viewOrder('${o.id}')">View</button></td>
      </tr>`;
  });
}

function runCurrentPageSearch() {
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase();
  if (document.getElementById("productTableBody")) {
    const filtered = products.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    renderProducts(filtered);
  } else if (document.getElementById("ordersTableBody")) {
    filterOrders();
  } else if (document.getElementById("customersTableBody")) {
    const filtered = customers.filter(c => c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
    renderCustomers(filtered);
  }
}

function filterOrders() {
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const s = document.getElementById("statusFilter")?.value || "all";
  const filtered = orders.filter(o => {
    const matchSearch = o.order_id.toString().includes(q) || o.customer.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
    const matchStatus = s === "all" || o.status === s;
    return matchSearch && matchStatus;
  });
  renderOrders(filtered);
}

window.viewOrder = id => {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  currentOrderId = id;
  document.getElementById("modalOrderId").textContent = `#${o.order_id}`;
  document.getElementById("modalCustomer").textContent = o.customer;
  document.getElementById("modalEmail").textContent = o.email || "—";
  document.getElementById("modalDate").textContent = formatDate(o.date);
  document.getElementById("modalTotal").textContent = `$${Number(o.total).toFixed(2)}`;
  const div = document.getElementById("modalItems"); div.innerHTML = "";
  o.items.forEach(i => {
    div.innerHTML += `<div class="order-item"><span>${i.qty || 1} × ${i.name}</span><span>$${(i.qty * i.price).toFixed(2)}</span></div>`;
  });
  const sel = document.getElementById("statusSelect");
  sel.innerHTML = ""; ["pending","processing","shipped","delivered","cancelled"].forEach(st => sel.add(new Option(st.charAt(0).toUpperCase() + st.slice(1), st, false, st === o.status)));
  modalBg.style.display = "flex";
};

window.updateOrderStatus = async () => {
  const status = document.getElementById("statusSelect").value;
  await supabaseClient.from("orders").update({ status }).eq("id", currentOrderId);
  modalBg.style.display = "none";
  loadOrders();
};

// ==================== CUSTOMERS ====================
async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*, orders(count), orders!orders_customer_id_fkey(total:sum(total))")
    .order("created_at", { ascending: false });

  if (error) { showToast("Failed to load customers"); return; }

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
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById("customerModalName").textContent = c.name;
  document.getElementById("customerModalEmail").textContent = c.email || '—';
  document.getElementById("customerModalPhone").textContent = c.phone || '—';
  document.getElementById("customerModalAddress").textContent = c.address || '—';
  document.getElementById("customerModalJoined").textContent = formatDate(c.created_at);
  document.getElementById("customerModalOrders").textContent = c.orders_count;
  document.getElementById("customerModalSpent").textContent = `$${Number(c.total_spent).toFixed(2)}`;
  const recent = orders.filter(o => o.customer_id === id).slice(0, 5);
  document.getElementById("customerOrdersList").innerHTML = recent.length 
    ? recent.map(o => `<div>#${o.order_id} — $${o.total} (${o.status})</div>`).join("")
    : "<em>No orders yet</em>";
  customerModalBg.style.display = "flex";
};

// ==================== ANALYTICS ====================
let charts = {};

async function loadAnalytics() {
  const range = document.getElementById("dateRange")?.value || 30;
  const from = new Date(Date.now() - range * 86400000).toISOString();

  const { data: ordersData } = await supabaseClient
    .from("orders")
    .select("date, total, status, items")
    .gte("date", from);

  if (!ordersData?.length) return;

  const totalRevenue = ordersData.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = ordersData.length;
  const avgOrderValue = totalRevenue / totalOrders;

  document.getElementById("totalRevenue").textContent = "$" + totalRevenue.toLocaleString();
  document.getElementById("totalOrders").textContent = totalOrders;
  document.getElementById("avgOrderValue").textContent = "$" + avgOrderValue.toFixed(2);
  document.getElementById("conversionRate").textContent = customers.length ? ((totalOrders / customers.length) * 100).toFixed(1) + "%" : "0%";

  const daily = {}, status = { pending:0, processing:0, shipped:0, delivered:0, cancelled:0 }, cats = {};
  ordersData.forEach(o => {
    const d = new Date(o.date).toLocaleDateString("en-US", {month:"short", day:"numeric"});
    daily[d] = (daily[d] || 0) + Number(o.total);
    status[o.status || "pending"]++;
    safeJSONParse(o.items).forEach(i => {
      const cat = i.category || "Other";
      cats[cat] = (cats[cat] || 0) + (i.qty || 1) * i.price;
    });
  });

  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  charts.sales = new Chart(document.getElementById("salesChart"), { type: "line", data: { labels: Object.keys(daily), datasets: [{ label: "Revenue", data: Object.values(daily), borderColor: "#6366f1", tension: 0.4, fill: true }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
  charts.status = new Chart(document.getElementById("statusChart"), { type: "doughnut", data: { labels: Object.keys(status), datasets: [{ data: Object.values(status), backgroundColor: ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444"] }] }, options: { responsive: true } });
  charts.category = new Chart(document.getElementById("categoryChart"), { type: "pie", data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"] }] }, options: { responsive: true } });
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  setupDOM();
  loadCategories();

  if (document.getElementById("productTableBody")) loadProducts();
  if (document.getElementById("ordersTableBody")) loadOrders();
  if (document.getElementById("customersTableBody")) loadCustomers();
  if (document.querySelector(".stats-grid")) updateStats?.();
  if (document.getElementById("salesChart")) loadAnalytics();

  document.getElementById("dateRange")?.addEventListener("change", loadAnalytics);
});
