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
  if (PAGE === "landing.html" || PAGE === "") loadDashboard();
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
async function loadCustomers() {
  // ----- 1. Pull orders (adjust column name if needed) -----
  const { data: orders, error } = await supabase
    .from("orders")
    .select("customer_id, shipping_address, total, created_at")   // <-- change if column ≠ shipping_address
    .not("shipping_address", "is", null);

  if (error) { console.error(error); return; }
  if (!orders?.length) {
    document.getElementById("totalCustomers").textContent = "0";
    document.getElementById("customersTableBody").innerHTML =
      "<tr><td colspan='7' class='text-center'>No customers found</td></tr>";
    return;
  }

  // ----- 2. Aggregate per customer -----
  const map = {};
  orders.forEach(o => {
    const id = o.customer_id;
    if (!map[id]) {
      const sa = o.shipping_address || {};               // <-- JSON object
      map[id] = {
        id,
        name:   sa.name   || "",
        email:  sa.email  || "",
        phone:  sa.phone  || "",   // <-- THIS LINE IS KEY
        address: [sa.address, sa.apt, sa.city, sa.country]
                  .filter(Boolean).join(", "),
        joined: o.created_at,
        orders: 0,
        spent:  0,
      };
    }
    map[id].orders += 1;
    map[id].spent  += Number(o.total) || 0;
  });

  const derived = Object.values(map);

  // ----- 3. Enrich with profiles (optional) -----
  const ids = derived.map(c => c.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .in("id", ids);

  const pMap = {};
  profiles?.forEach(p => pMap[p.id] = p);

  // ----- 4. Final list -----
  const list = derived.map(c => {
    const p = pMap[c.id];
    return {
      id: c.id,
      name:   p?.full_name || c.name  || "–",
      email:  p?.email     || c.email || "–",
      phone:  c.phone      || "–",                 // <-- now always from shipping_address
      address:c.address    || "–",
      orders: c.orders,
      spent:  c.spent.toFixed(2),
      joined: fmtDate(p?.created_at || c.joined),
    };
  });

  // ----- 5. Render -----
  document.getElementById("totalCustomers").textContent = list.length;
  document.getElementById("customersTableBody").innerHTML = list
    .map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.email}</td>
        <td>${c.phone}</td>        <!-- PHONE IS HERE -->
        <td>${c.orders}</td>
        <td>$${c.spent}</td>
        <td>${c.joined}</td>
        <td>
          <button class="btn view" onclick="openCustomer(${c.id})">
            <i class="fa fa-eye"></i> View
          </button>
        </td>
      </tr>
    `).join("");
}

async function openCustomer(id) {
  // Profile (optional)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, created_at")
    .eq("id", id)
    .single()
    .catch(() => ({ data: null }));

  // All orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, status, shipping_address, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  if (!orders?.length) { alert("No orders"); return; }

  const sa = orders[0].shipping_address || {};

  document.getElementById("customerModalName").textContent   = profile?.full_name || sa.name || "–";
  document.getElementById("customerModalEmail").textContent  = profile?.email     || sa.email || "–";
  document.getElementById("customerModalPhone").textContent  = sa.phone || "–";   // PHONE
  document.getElementById("customerModalAddress").textContent = [
    sa.address, sa.apt, sa.city, sa.country
  ].filter(Boolean).join(", ") || "–";

  document.getElementById("customerModalJoined").textContent = fmtDate(
    profile?.created_at || orders[0].created_at
  );

  const spent = orders.reduce((s, o) => s + Number(o.total), 0).toFixed(2);
  document.getElementById("customerModalOrders").textContent = orders.length;
  document.getElementById("customerModalSpent").textContent  = "$" + spent;

  document.getElementById("customerOrdersList").innerHTML = orders
    .map(o => `<div>#${o.id} — $${o.total} (${o.status}) – ${fmtDate(o.created_at)}</div>`)
    .join("") || "<div>No orders</div>";

  document.getElementById("customerModalBg").style.display = "flex";
}
// =====================================
// PRODUCTS (with image upload)
// =====================================
let editingProductId = null; // track if we're editing

async function loadProducts() {
  const [{ data: categories }, { data: brands }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("brands").select("*"),
    supabase.from("products").select("*, categories(name), brands(name)").order("id")
  ]);

  document.getElementById("category").innerHTML = 
    '<option value="">Select Category</option>' + 
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  document.getElementById("brand").innerHTML = 
    '<option value="">Select Brand</option>' + 
    brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");

  document.getElementById("productTableBody").innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>
        ${p.image_url ? `<img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;">` : ''}
        ${p.name}
      </td>
      <td>${p.categories?.name || "-"}</td>
      <td>${p.brands?.name || "-"}</td>
      <td>$${Number(p.price).toFixed(2)}</td>
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
  editingProductId = null;
  document.getElementById("modalTitle").textContent = "Add Product";
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("category").value = "";
  document.getElementById("brand").value = "";
  document.getElementById("productImage").value = "";
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("imagePreview").src = "";

  document.getElementById("saveProductBtn").onclick = saveProduct;
  document.getElementById("modalBg").style.display = "flex";
}

async function saveProduct() {
  const fileInput = document.getElementById("productImage");
  const file = fileInput.files[0];

  const body = {
    name: document.getElementById("name").value.trim(),
    category_id: document.getElementById("category").value,
    brand_id: document.getElementById("brand").value,
    price: Number(document.getElementById("price").value),
    stock: Number(document.getElementById("stock").value),
  };

  if (!body.name || !body.category_id || !body.price) {
    alert("Please fill all required fields");
    return;
  }

  let imageUrl = null;

  // Upload image if selected
  if (file) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      alert("Image upload failed: " + uploadError.message);
      return;
    }

    // Get public URL
    const { data } = supabase.storage.from("products").getPublicUrl(fileName);
    imageUrl = data.publicUrl;
  }

  // Add image_url to body
  if (imageUrl) body.image_url = imageUrl;

  try {
    if (editingProductId) {
      await supabase.from("products").update(body).eq("id", editingProductId);
    } else {
      await supabase.from("products").insert(body);
    }
    closeAllModals();
    loadProducts();
  } catch (err) {
    alert("Failed to save product: " + err.message);
  }
}

async function editProduct(id) {
  const { data: p } = await supabase.from("products").select("*").eq("id", id).single();

  editingProductId = id;
  document.getElementById("modalTitle").textContent = "Edit Product";
  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price;
  document.getElementById("stock").value = p.stock;
  document.getElementById("brand").value = p.brand_id || "";
  document.getElementById("category").value = p.category_id || "";

  // Show current image if exists
  const preview = document.getElementById("imagePreview");
  if (p.image_url) {
    preview.src = p.image_url;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  document.getElementById("saveProductBtn").onclick = saveProduct;
  document.getElementById("modalBg").style.display = "flex";
}

async function deleteProduct(id) {
  if (!confirm("Delete this product permanently?")) return;

  // Optional: delete image from storage too
  const { data: product } = await supabase.from("products").select("image_url").eq("id", id).single();
  if (product?.image_url) {
    const fileName = product.image_url.split("/").pop();
    await supabase.storage.from("products").remove([fileName]);
  }

  await supabase.from("products").delete().eq("id", id);
  loadProducts();
}
async function loadOrders() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      status,
      payment_method,
      shipping_address,
      created_at,

      customers:customer_id (
        full_name,
        email
      ),

      order_items (
        quantity,
        price,
        products:product_id (
          name
        )
      )
    `)
    .order("id", { ascending: false });

  if (error) {
    console.error("Failed to load orders:", error);
    return { orders: [], error };
  }

  return { orders, error: null };
}

async function renderOrders() {
  const { orders, error } = await loadOrders();

  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const table = tbody.closest("table");
  const headerCols = table.querySelectorAll("thead th").length;

  // Handle error
  if (error) {
    tbody.innerHTML = `<tr><td colspan="${headerCols}" style="text-align:center; color:#ef4444;">Error loading orders: ${error.message}</td></tr>`;
    return;
  }

  const safeOrders = orders || [];

  // Update total count
  const totalEl = document.getElementById("totalOrders");
  if (totalEl) totalEl.textContent = safeOrders.length;

  // DASHBOARD view (5 columns)
  if (headerCols === 5) {
    tbody.innerHTML = safeOrders.slice(0, 5).map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customers?.full_name || '—'}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td>$${Number(o.total || 0).toFixed(2)}</td>
        <td><span class="status ${o.status}">${o.status || 'unknown'}</span></td>
      </tr>
    `).join("");
    return;
  }

  // FULL ORDERS PAGE (8 columns)
  const theadRow = table.querySelector("thead tr");
  while (theadRow.children.length < 8) {
    if (theadRow.children.length === 6) theadRow.insertAdjacentHTML("beforeend", "<th>Items</th><th>Actions</th>");
    else if (theadRow.children.length === 7) theadRow.insertAdjacentHTML("beforeend", "<th>Actions</th>");
  }

  tbody.innerHTML = safeOrders.map(o => {
    const items = (o.order_items || [])
      .map(i => `${i.products?.name || 'Unknown'} ×${i.quantity}`)
      .join("<br>") || "<em style='color:#999'>—</em>";

    return `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td>${fmtDate(o.created_at)}</td>
        <td>
          <div><strong>${o.customers?.full_name || '—'}</strong></div>
          <small style="color:#64748b;">${o.customers?.email || ''}</small>
        </td>
        <td style="font-size:13.5px; line-height:1.6;">${items}</td>
        <td style="color:#10b981; font-weight:600;">$${Number(o.total || 0).toFixed(2)}</td>
        <td style="text-transform:capitalize;">${o.payment_method || '—'}</td>
        <td><span class="status ${o.status}">${o.status || 'pending'}</span></td>
<td>
  <button class="btn view" onclick="showAddressModal(${o.id})">
    View Invoice
  </button>
</td>
        <td class="actions">
          <button class="btn view" onclick="openOrder(${o.id})"><i class="fa fa-eye"></i></button>
          <button class="btn edit" onclick="editOrder(${o.id})"><i class="fa fa-edit"></i></button>
          <button class="btn delete" onclick="deleteOrder(${o.id})"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");

  // No orders
  if (safeOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8;">No orders found</td></tr>`;
  }
}

// Call this on page load
document.addEventListener("DOMContentLoaded", renderOrders);

// Safe: returns null if no valid ID, never touches document.body
function getOrderIdFromUrl() {
  const params = new URLSearchParams(location.search);
  const id = params.get('orderId');
  if (id && /^\d+$/.test(id)) return parseInt(id, 10);

  const match = location.pathname.match(/\/(\d+)\/?$/);
  if (match) return parseInt(match[1], 10);

  return null;
}

// FINAL – WORKS 100% – NO FK NAMES, NO RLS ISSUES, NO [object Object]
async function fetchOrderDetails(orderId) {
  // 1. Get the order
  const { data: order, error: e1 } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (e1 || !order) return null;

  // 2. Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone, avatar_url')
    .eq('id', order.customer_id)
    .maybeSingle();

  // 3. Get items + products
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, price, products(name, image_url)')
    .eq('order_id', orderId);

  // Return exactly what your modal expects
  return {
    ...order,
    profiles: profile || { full_name: 'Customer', email: '' },
    order_items: items || []
  };
}
// Render full order page (only on order view page)
function renderSingleOrderPage(order) {
  let address = {};
  try {
    address = typeof order.shipping_address === 'string'
      ? JSON.parse(order.shipping_address)
      : order.shipping_address || {};
  } catch (e) { /* ignore */ }

  const itemsHtml = (order.order_items || []).map(item => `
    <tr>
      <td style="padding:10px;">
        ${item.products?.image_url ? `<img src="${item.products.image_url}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:10px;">` : ''}
        ${item.products?.name || 'Unknown Product'}
      </td>
      <td style="padding:10px;">${item.quantity}</td>
      <td style="padding:10px;">$${Number(item.price).toFixed(2)}</td>
      <td style="padding:10px;">$${(item.quantity * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  document.body.innerHTML = `
    <div style="max-width:900px;margin:40px auto;padding:20px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.1);font-family:system-ui,sans-serif;">
      <h1 style="text-align:center;color:#1f2937;">Order #${order.id}</h1>
      <p style="text-align:center;color:#6b7280;">${new Date(order.created_at).toLocaleString()}</p>

      <div style="display:flex;justify-content:space-between;margin:30px 0;">
        <div>
          <strong>Status:</strong> 
          <span style="padding:6px 12px;background:#10b981;color:white;border-radius:20px;text-transform:capitalize;">
            ${order.status}
          </span>
        </div>
        <div style="text-align:right;">
          <strong>Total: <span style="font-size:1.8em;color:#6366f1;">$${Number(order.total).toFixed(2)}</span></strong>
        </div>
      </div>

      <h2>Shipping Address</h2>
      <div style="background:#f9fafb;padding:15px;border-radius:8px;">
        <strong>${address.name || '—'}</strong><br>
        ${address.address || ''}${address.apt ? ', ' + address.apt : ''}<br>
        ${address.city || ''}, ${address.postal || ''}, ${address.country || ''}
      </div>

      <h2 style="margin-top:30px;">Items</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:12px;text-align:left;">Product</th>
            <th style="padding:12px;">Qty</th>
            <th style="padding:12px;">Price</th>
            <th style="padding:12px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="text-align:center;margin-top:40px;">
        <button onclick="window.print()" style="padding:12px 30px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1.1em;">
          Print Invoice
        </button>
      </div>
    </div>
  `;
}

async function showAddressModal(orderId) {
  const modal = document.getElementById("addressModalBg");
  const box = document.getElementById("invoiceAddressBox");

  const order = await fetchOrderDetails(orderId);
  if (!order) {
    box.innerHTML = "<p style='color:#ef4444;'>Order not found or access denied.</p>";
    modal.style.display = "flex";
    return;
  }

  // Parse shipping address (it's stored as JSON string)
  let address = {};
  try {
    address = typeof order.shipping_address === "string" 
      ? JSON.parse(order.shipping_address) 
      : order.shipping_address || {};
  } catch (e) {
    address = {};
  }

  const items = order.order_items || [];

  const itemsHtml = items.map(item => `
    <tr>
      <td><img src="${item.products?.image_url || ''}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;margin-right:8px;"> 
        ${item.products?.name || 'Unknown Product'}
      </td>
      <td>${item.quantity}</td>
      <td>$${Number(item.price).toFixed(2)}</td>
      <td>$${(item.quantity * item.price).toFixed(2)}</td>
    </tr>
  `).join("");

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const tax = (subtotal * 0.08).toFixed(2); // adjust tax rate if needed
  const total = (subtotal + parseFloat(tax)).toFixed(2);

  box.innerHTML = `
    <div style="font-family:system-ui,sans-serif;line-height:1.6;">
      <h3 style="margin:0 0 15px;">Invoice #${order.id}</h3>
      <div style="margin-bottom:20px;color:#374151;">
        <strong>${address.name || order.profiles?.full_name || 'Customer'}</strong><br>
        ${address.email || order.profiles?.email || ''}<br>
        ${address.phone || ''}<br><br>
        <strong>Shipping Address:</strong><br>
        ${address.address || ''}${address.apt ? ', ' + address.apt : ''}<br>
        ${address.city || ''}, ${address.postal || ''}<br>
        ${address.country || ''}
      </div>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Product</th>
            <th style="padding:10px;">Qty</th>
            <th style="padding:10px;">Price</th>
            <th style="padding:10px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="text-align:right;font-size:15px;">
        <div>Subtotal: $${subtotal.toFixed(2)}</div>
        <div>Tax (8%): $${tax}</div>
        <div style="font-weight:bold;margin-top:8px;font-size:18px;">
          Total: $${total}
        </div>
      </div>
    </div>
  `;

  modal.style.display = "flex";
}

window.downloadInvoicePDF = function() {
  const element = document.getElementById("invoiceArea");
  const images = element.querySelectorAll("img");

  // Wait for all images to load
  const promises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = img.onerror = resolve;
    });
  });

  Promise.all(promises).then(() => {
    html2pdf()
      .set({ margin: 10, filename: 'invoice.pdf', html2canvas: { scale: 2, useCORS: true } })
      .from(element)
      .save();
  });
};

function closeAddressModal() {
  document.getElementById("addressModalBg").style.display = "none";
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
// =====================================
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      // Optional: Show "Logging out..." feedback
      const span = logoutBtn.querySelector("span") || logoutBtn;
      const originalText = span.textContent;
      span.textContent = "Logging out...";
      logoutBtn.style.pointerEvents = "none"; // disable double-click

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        alert("Logout failed: " + error.message);
        span.textContent = originalText;
        logoutBtn.style.pointerEvents = "auto";
      } else {
        // Force redirect to login page
        window.location.href = "adLogin.html";
      }
    });
  }

  // Optional: Protect admin pages — redirect to login if not authenticated
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      window.location.href = "adLogin.html";
    }
  });
});
