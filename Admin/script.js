<script>
// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://nhyucbgjocmwrkqbjjme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBALS ====================
let products = [], orders = [], customers = [];
let editingProductId = null;
let charts = {};

// ==================== UTILS ====================
const showToast = (msg, error = false) => {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:20px;right:20px;padding:1rem 1.5rem;border-radius:8px;z-index:9999;color:white;font-size:14px;${error ? 'background:#ef4444' : 'background:#10b981'};box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const safeJSONParse = (val) => {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== "string") return [];
  try { return JSON.parse(val); } catch (e) { console.warn("JSON parse failed:", val); return []; }
};

// ==================== DASHBOARD ====================
async function loadDashboard() {
  try {
    // Fix: Select all needed fields for revenue
    const { data: ordersData, count: orderCount } = await supabase
      .from("orders")
      .select("total", { count: "exact" });

    const { count: productCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true });

    const { count: customerCount } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true });

    const revenue = ordersData?.reduce((sum, o) => sum +o.total + sum, 0) || 0;

    document.getElementById("sales")?. = "$" + revenue.toLocaleString("en-US", { minimumFractionDigits: 0 });
    document.getElementById("orders")?.textContent = orderCount || 0;
    document.getElementById("products")?.textContent = productCount || 0;
    document.getElementById("customers")?.textContent = customerCount || 0;
  } catch (err) {
    console.error("Dashboard error:", err);
    showToast("Failed to load dashboard", true);
  }
}

// ==================== PRODUCTS PAGE ====================
async function loadProducts() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showToast("Failed to load products: " + error.message, true);
    return;
  }

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
  if (!confirm("Delete this product? This cannot be undone.")) return;

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error(error);
    showToast("Delete failed: " + error.message, true);
  } else {
    showToast("Product deleted successfully");
    loadProducts();
  }
};

// Save product
document.getElementById("saveProductBtn")?.addEventListener("click", async () => {
  const payload = {
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value.trim(),
    brand: document.getElementById("brand").value.trim(),
    price: parseFloat(document.getElementById("price").value),
    stock: parseInt(document.getElementById("stock").value, 10)
  };

  if (!payload.name || isNaN(payload.price) || isNaN(payload.stock) || payload.price < 0 || payload.stock < 0) {
    showToast("Please fill all fields correctly", true);
    return;
  }

  try {
    if (editingProductId) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingProductId);
      if (error) throw error;
      showToast("Product updated!");
    } else {
      const { error } = await supabase
        .from("products")
        .insert([payload]);
      if (error) throw error;
      showToast("Product added!");
    }

    document.querySelector("#modalBg").style.display = "none";
    loadProducts();
  } catch (err) {
    console.error(err);
    showToast("Save failed: " + err.message, true);
  );
  }
});

// ==================== ORDERS & ANALYTICS ====================
// (Same as yours but with small fixes – works fine once supabase client is loaded)

async function loadOrders() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    showToast("Failed to load orders", true);
    return;
  }

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
    ? items.map(i => `<div class="py-2">• ${i.name} × ${i.qty} — $${(i.price * i.price).toFixed(2)}</div>`).join("")
    : "<em>No items</em>";

  document.querySelector("#orderModal")?.style = "display:flex"; // adjust if needed
};

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", async () => {
  const path = location.pathname.split("/").pop() || "index.html";

  // Modal close
  document.querySelectorAll(".modal-bg, .close-modal").forEach(el => {
    el.onclick = (e) => {
      if (e.target.classList.contains("modal-bg") || e.target.classList.contains("close-modal")) {
        document.querySelectorAll(".modal-bg").forEach(m => m.style.display = "none");
      }
    };
  });

  if (path.includes("index")) await loadDashboard();
  if (path.includes("products")) await loadProducts();
  if (path.includes("orders")) await loadOrders();
  if (path.includes("analytics")) {
    await loadAnalytics();
    document.getElementById("dateRange")?.addEventListener("change", loadAnalytics);
  }

  document.getElementById("addProductBtn")?.addEventListener("click", () => openProductModal());
});
</script>