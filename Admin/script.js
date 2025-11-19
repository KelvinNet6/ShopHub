// Initialize Supabase
const supabaseClient = supabase.createClient(
  "YOUR_SUPABASE_URL",
  "YOUR_SUPABASE_ANON_KEY"
);

// -------------------------------
// Load Dashboard stats
// -------------------------------
async function loadStats() {

  // Total Sales
  const { data: salesData } = await supabaseClient
    .from("orders")
    .select("total");

  const totalSales = salesData?.reduce((sum, row) => sum + row.total, 0) || 0;
  document.getElementById("sales").innerText = "$" + totalSales.toLocaleString();


  // Orders Count
  const { count: ordersCount } = await supabaseClient
    .from("orders")
    .select("*", { count: "exact", head: true });

  document.getElementById("orders").innerText = ordersCount;


  // Product Count
  const { count: productCount } = await supabaseClient
    .from("products")
    .select("*", { count: "exact", head: true });

  document.getElementById("products").innerText = productCount;


  // Customer Count
  const { count: customerCount } = await supabaseClient
    .from("customers")
    .select("*", { count: "exact", head: true });

  document.getElementById("customers").innerText = customerCount;
}


// -------------------------------
// Load Recent Orders Table
// -------------------------------
async function loadRecentOrders() {

  const { data: orders } = await supabaseClient
    .from("orders")
    .select("id, customer_name, created_at, total, status")
    .order("created_at", { ascending: false })
    .limit(10);

  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = "";

  orders.forEach(order => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>#${order.id}</td>
      <td>${order.customer_name}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td>$${order.total.toFixed(2)}</td>
      <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
    `;

    tbody.appendChild(row);
  });
}


// -------------------------------
// Bootstrapping the dashboard
// -------------------------------
async function loadDashboard() {
  loadStats();
  loadRecentOrders();
}

loadDashboard();

// -------------------- SUPABASE INIT --------------------
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global product list
let products = [];
let editingProductId = null;

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

// -------------------- UTILS --------------------
function showToast(text) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function openModal(isEdit = false) {
  modalBg.style.display = "flex";
  document.getElementById("modalTitle").innerText = isEdit ? "Edit Product" : "Add Product";

  // Reset fields
  if (!isEdit) {
    editingProductId = null;
    document.getElementById("category").value = "";
    document.getElementById("brand").innerHTML = `<option value="">Select brand</option>`;
    ["name","price","stock"].forEach(id => document.getElementById(id).value = "");
  }
}

function closeModal() {
  modalBg.style.display = "none";
}

// -------------------- LOAD CATEGORIES --------------------
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

// -------------------- SUPABASE: FETCH PRODUCTS --------------------
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

// -------------------- SUPABASE: ADD PRODUCT --------------------
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

// -------------------- SUPABASE: UPDATE PRODUCT --------------------
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

// -------------------- SUPABASE: DELETE PRODUCT --------------------
async function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!confirm(`Delete "${p.name}" permanently?`)) return;

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) console.error(error);
  else showToast(`${p.name} deleted`);

  refreshProducts();
}

// -------------------- TABLE RENDER --------------------
function loadProducts(list) {
  const body = document.getElementById("productTableBody");
  body.innerHTML = "";

  if (list.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:4rem;color:#64748b;">
      No products found
    </td></tr>`;
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
      <td>
        <span class="${p.stock < 20 ? 'stock-low' : 'stock-ok'}">
          ${p.stock} ${p.stock < 20 ? 'Low Stock' : 'In Stock'}
        </span>
      </td>
      <td>
        <button class="action-btn edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
      </td>
    `;
    body.appendChild(row);
  });
}

// -------------------- EDIT PRODUCT --------------------
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

// -------------------- SAVE PRODUCT --------------------
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

  if (editingProductId) {
    await updateProduct(editingProductId, product);
  } else {
    await createProduct(product);
  }

  closeModal();
}

// -------------------- SEARCH --------------------
searchInput.addEventListener("keyup", () => {
  const q = searchInput.value.toLowerCase();

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    p.price.toString().includes(q)
  );

  loadProducts(filtered);
});

// -------------------- EVENT LISTENERS --------------------
addProductBtn.addEventListener("click", () => openModal(false));
closeModalBtn.addEventListener("click", closeModal);
saveProductBtn.addEventListener("click", saveProduct);

// -------------------- INIT --------------------
loadCategories();
refreshProducts();
