// -------------------- SUPABASE INIT --------------------
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlYmciOiJuZHl1Y2Jnam9jbXdya3Fiam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------- GLOBALS --------------------
let products = [];
let orders = [];
let editingProductId = null;
let currentOrderId = null;
let realtimeSubscription = null;

// Categories + brands (unchanged)
const brands = { shoes: ["Nike", "Adidas", "Puma", "New Balance", "Vans", "Converse"], clothing: ["Zara", "H&M", "Uniqlo", "Levi's", "Gap"], accessories: ["Ray-Ban", "Casio", "Fossil", "Michael Kors"], electronics: ["Apple", "Samsung", "Sony", "Bose"] };

// -------------------- DOM ELEMENTS (FIXED: NOW INSIDE init) --------------------
let modalBg, addProductBtn, closeModalBtn, saveProductBtn, searchInput, statusFilter;

function setupDOM() {
  modalBg = document.getElementById("modalBg");
  addProductBtn = document.getElementById("addProductBtn");
  closeModalBtn = document.getElementById("closeModal");
  saveProductBtn = document.getElementById("saveProductBtn");
  searchInput = document.getElementById("searchInput");
  statusFilter = document.getElementById("statusFilter");

  // Attach events only after DOM is ready
  addProductBtn.addEventListener("click", () => openModal(false));
  closeModalBtn.addEventListener("click", closeModal);
  saveProductBtn.addEventListener("click", saveProduct);
  searchInput.addEventListener("keyup", debounce(filterOrders, 300));
  statusFilter.addEventListener("change", filterOrders);
  modalBg.addEventListener("click", e => { if (e.target === modalBg) closeModal(); });
  document.getElementById("category").addEventListener("change", loadBrandOptions);
}

// -------------------- REST OF YOUR CODE (ONLY 2 FUNCTIONS CHANGED) --------------------

async function refreshProducts() {
  const { data, error } = await supabase.from("products").select("*");
  if (error) {
    console.error("Products error:", error);
    showToast("Error loading products");
    return;
  }
  products = data || [];
  loadProducts(products);
}

async function loadOrdersFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, email)
      `)
      .order('date', { ascending: false });

    if (error) throw error;

    // Map to flat structure your current code expects
    orders = data.map(order => ({
      ...order,
      customer: order.customers?.name || 'Walk-in Customer',
      email: order.customers?.email || ''
    }));

    filterOrders();
    showToast('Orders loaded successfully!');
  } catch (error) {
    console.error('Error loading orders:', error);
    showToast('Failed to load orders');
  }
}

// Fix loadOrders() — now uses the mapped customer name
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
      <td><div><strong>${order.customer}</strong><br><small>${order.email}</small></div></td>
      <td>${itemsCount} item${itemsCount > 1 ? 's' : ''}</td>
      <td><strong>$${Number(order.total).toFixed(2)}</strong></td>
      <td><span class="badge payment-${order.payment}">${order.payment.toUpperCase()}</span></td>
      <td><span class="badge status-${order.status}">${order.status.toUpperCase()}</span></td>
      <td><button class="view-btn" onclick="viewOrder('${order.id}')"><i class="fas fa-eye"></i></button></td>
    `;
    tbody.appendChild(row);
  });
}

// Fix viewOrder modal too
window.viewOrder = function(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  currentOrderId = id;
  document.getElementById("modalOrderId").textContent = `#${order.order_id}`;
  document.getElementById("modalCustomer").textContent = order.customer;
  document.getElementById("modalEmail").textContent = order.email || '—';
  document.getElementById("modalDate").textContent = formatDate(order.date);
  document.getElementById("modalTotal").textContent = `$${Number(order.total).toFixed(2)}`;

  const itemsDiv = document.getElementById("modalItems");
  itemsDiv.innerHTML = "";
  JSON.parse(order.items || '[]').forEach(item => {
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

// -------------------- INIT (NOW CALLS setupDOM) --------------------
async function initDashboard() {
  setupDOM();                  // This fixes modal + buttons!
  loadCategories();
  await loadStats();
  await refreshProducts();
  await loadOrdersFromSupabase();
  setupRealtime();
}

document.addEventListener('DOMContentLoaded', initDashboard);
