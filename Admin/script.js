// -------------------- SUPABASE INIT --------------------
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------- GLOBALS --------------------
let products = [];
let orders = [];
let editingProductId = null;
let currentOrderId = null;
let realtimeSubscription = null;

// Categories + brands
const brands = {
  shoes: ["Nike", "Adidas", "Puma", "New Balance", "Vans", "Converse"],
  clothing: ["Zara", "H&M", "Uniqlo", "Levi's", "Gap"],
  accessories: ["Ray-Ban", "Casio", "Fossil", "Michael Kors"],
  electronics: ["Apple", "Samsung", "Sony", "Bose"]
};

// -------------------- DOM ELEMENTS --------------------
const modalBg = document.getElementById("modalBg");
const addProductBtn = document.getElementById("addProductBtn");
const closeModalBtn = document.getElementById("closeModal");
const saveProductBtn = document.getElementById("saveProductBtn");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

// -------------------- UTILS --------------------
function showToast(text) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// -------------------- DASHBOARD STATS --------------------
async function loadStats() {
  try {
    // Total Sales
    const { data: salesData } = await supabase.from("orders").select("total");
    const totalSales = salesData?.reduce((sum, row) => sum + row.total, 0) || 0;
    document.getElementById("sales").innerText = "$" + totalSales.toLocaleString();

    // Orders Count
    const { count: ordersCount } = await supabase.from("orders").select("*", { count: "exact", head: true });
    document.getElementById("orders").innerText = ordersCount;

    // Product Count
    const { count: productCount } = await supabase.from("products").select("*", { count: "exact", head: true });
    document.getElementById("products").innerText = productCount;

    // Customer Count
    const { count: customerCount } = await supabase.from("customers").select("*", { count: "exact", head: true });
    document.getElementById("customers").innerText = customerCount;
  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

// -------------------- PRODUCTS --------------------
function loadCategories() {
  const catSelect = document.getElementById("category");
  catSelect.innerHTML = `<option value="">Select category</option>`;
  Object.keys(brands).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = cat;
    catSelect.appendChild(opt);
  });
}

function loadBrandOptions() {
  const category = document.getElementById("category").value;
  const brandSelect = document.getElementById("brand");
  brandSelect.innerHTML = `<option value="">Select brand</option>`;
  if (brands[category]) {
    brands[category].forEach(b => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = b;
      brandSelect.appendChild(opt);
    });
  }
}

document.getElementById("category").addEventListener("change", loadBrandOptions);

async function refreshProducts() {
  const { data, error } = await supabase.from("products").select("*");
  if (error) {
    console.error(error);
    showToast("Error loading products");
    return;
  }
  products = data;
  loadProducts(products);
}

function loadProducts(list) {
  const body = document.getElementById("productTableBody");
  body.innerHTML = "";
  if (list.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">No products found</td></tr>`;
    return;
  }
  list.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>#${p.id}</td>
      <td><strong>${p.name}</strong></td>
      <td><span class="tag">${p.category}</span></td>
      <td>${p.brand}</td>
      <td><strong style="color:var(--primary)">$${Number(p.price).toFixed(2)}</strong></td>
      <td><span class="${p.stock < 20 ? 'stock-low' : 'stock-ok'}">${p.stock} ${p.stock < 20 ? 'Low Stock' : 'In Stock'}</span></td>
      <td>
        <button class="action-btn edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
      </td>
    `;
    body.appendChild(row);
  });
}

function openModal(isEdit = false) {
  modalBg.style.display = "flex";
  document.getElementById("modalTitle").innerText = isEdit ? "Edit Product" : "Add Product";
  if (!isEdit) {
    editingProductId = null;
    document.getElementById("category").value = "";
    document.getElementById("brand").innerHTML = `<option value="">Select brand</option>`;
    ["name", "price", "stock"].forEach(id => document.getElementById(id).value = "");
  }
}

function closeModal() {
  modalBg.style.display = "none";
  currentOrderId = null;
}

async function createProduct(product) {
  const { error } = await supabase.from("products").insert([product]);
  if (error) {
    console.error(error);
    showToast("Error adding product");
  } else {
    showToast(`${product.name} added successfully`);
    refreshProducts();
  }
}

async function updateProduct(id, product) {
  const { error } = await supabase.from("products").update(product).eq("id", id);
  if (error) {
    console.error(error);
    showToast("Error updating product");
  } else {
    showToast(`${product.name} updated`);
    refreshProducts();
  }
}

async function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!confirm(`Delete "${p.name}" permanently?`)) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) console.error(error);
  else showToast(`${p.name} deleted`);
  refreshProducts();
}

function editProduct(id) {
  editingProductId = id;
  const p = products.find(x => x.id === id);
  openModal(true);
  document.getElementById("category").value = p.category;
  loadBrandOptions();
  document.getElementById("brand").value = p.brand;
  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price;
  document.getElementById("stock").value = p.stock;
}

async function saveProduct() {
  const product = {
    category: document.getElementById("category").value,
    brand: document.getElementById("brand").value,
    name: document.getElementById("name").value.trim(),
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value)
  };
  if (!product.category || !product.brand || !product.name || isNaN(product.price) || isNaN(product.stock)) {
    showToast("Fill all fields correctly!");
    return;
  }
  if (editingProductId) await updateProduct(editingProductId, product);
  else await createProduct(product);
  closeModal();
}

// -------------------- ORDERS --------------------
async function loadOrdersFromSupabase() {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (error) throw error;
    orders = data || [];
    filterOrders(); // Initial load
    showToast('Orders loaded!');
  } catch (error) {
    console.error('Error loading orders:', error);
    showToast('Error loading orders. Check console.');
  }
}

function setupRealtime() {
  if (realtimeSubscription) supabase.removeSubscription(realtimeSubscription);
  realtimeSubscription = supabase
    .channel('orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
      console.log('Change received!', payload);
      loadOrdersFromSupabase(); // Reload on any change
      loadStats();
      refreshProducts();
    })
    .subscribe();
}

function loadOrders(filtered = orders) {
  const tbody = document.getElementById("ordersTableBody");
  document.getElementById("totalOrders").textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:4rem;color:#64748b;">
      <i class="fas fa-receipt fa-3x mb-3 opacity-30"></i><br>No orders found
    </td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach(order => {
    const itemsCount = JSON.parse(order.items || '[]').length;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>#${order.order_id}</strong></td>
      <td>${formatDate(order.date)}</td>
      <td>${order.customer}</td>
      <td>${itemsCount} item${itemsCount > 1 ? 's' : ''}</td>
      <td><strong>$${Number(order.total).toFixed(2)}</strong></td>
      <td><span class="badge payment-${order.payment}">${order.payment.toUpperCase()}</span></td>
      <td><span class="badge status-${order.status}">${order.status.toUpperCase()}</span></td>
      <td><button class="view-btn" onclick="viewOrder(${order.id})" title="View Details"><i class="fas fa-eye"></i></button></td>
    `;
    tbody.appendChild(row);
  });
}

function filterOrders() {
  const query = searchInput.value.toLowerCase();
  const status = statusFilter.value;

  const filtered = orders.filter(order => {
    const items = JSON.parse(order.items || '[]');
    const matchesSearch = order.order_id.toString().includes(query) ||
                          order.customer.toLowerCase().includes(query) ||
                          order.email.toLowerCase().includes(query);
    const matchesStatus = status === "all" || order.status === status;
    return matchesSearch && matchesStatus;
  });

  loadOrders(filtered);
}

// -------------------- MODAL HANDLING --------------------
window.viewOrder = function(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  currentOrderId = id;
  document.getElementById("modalOrderId").textContent = `#${order.order_id}`;
  document.getElementById("modalCustomer").textContent = order.customer;
  document.getElementById("modalEmail").textContent = order.email;
  document.getElementById("modalDate").textContent = formatDate(order.date);
  document.getElementById("modalAddress").textContent = order.address;
  document.getElementById("modalTotal").textContent = `$${Number(order.total).toFixed(2)}`;

  const itemsDiv = document.getElementById("modalItems");
  itemsDiv.innerHTML = "";
  const items = JSON.parse(order.items || '[]');
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-item";
    div.innerHTML = `<span>${item.qty} × ${item.name}</span><span>$${(item.qty * item.price).toFixed(2)}</span>`;
    itemsDiv.appendChild(div);
  });

  const statusSelect = document.getElementById("statusSelect");
  const statuses = ["pending","processing","shipped","delivered","cancelled"];
  statusSelect.innerHTML = statuses.map(s =>
    `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
  ).join("");

  modalBg.style.display = "flex";
};

window.updateOrderStatus = async function() {
  if (!currentOrderId) return;
  const newStatus = document.getElementById("statusSelect").value;

  const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', currentOrderId);
  if (error) {
    showToast(`Error updating status: ${error.message}`);
    return;
  }
  closeModal();
  showToast(`Order #${currentOrderId} status updated to ${newStatus.toUpperCase()}`);
};

window.closeModal = function() {
  modalBg.style.display = "none";
  currentOrderId = null;
};

// Click outside modal to close
modalBg.addEventListener("click", e => { if (e.target === modalBg) closeModal(); });

// -------------------- EVENT LISTENERS --------------------
addProductBtn.addEventListener("click", () => openModal(false));
closeModalBtn.addEventListener("click", closeModal);
saveProductBtn.addEventListener("click", saveProduct);
searchInput.addEventListener("keyup", debounce(filterOrders, 300));
statusFilter.addEventListener("change", filterOrders);

// -------------------- INIT DASHBOARD --------------------
async function initDashboard() {
  loadCategories();
  await loadStats();
  await refreshProducts();
  await loadOrdersFromSupabase();
  setupRealtime();
}

document.addEventListener('DOMContentLoaded', initDashboard);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (realtimeSubscription) supabase.removeSubscription(realtimeSubscription);
});
