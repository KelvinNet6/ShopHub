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

