// =========================
//  NAV INITIALIZER
// =========================
(function () {
  function initMobileMenu() {
    const menuBtn   = document.getElementById("menuBtn");
    const closeBtn  = document.getElementById("closeBtn");
    const slideMenu = document.getElementById("slideMenu");
    const overlay   = document.getElementById("overlay");

    if (!menuBtn || !closeBtn || !slideMenu || !overlay) return false;

    const menuBtnNew = menuBtn.cloneNode(true);
    const closeBtnNew = closeBtn.cloneNode(true);
    const overlayNew = overlay.cloneNode(true);

    menuBtn.replaceWith(menuBtnNew);
    closeBtn.replaceWith(closeBtnNew);
    overlay.replaceWith(overlayNew);

    function openMenu() {
      slideMenu.classList.add("active");
      overlayNew.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeMenu() {
      slideMenu.classList.remove("active");
      overlayNew.classList.remove("active");
      document.body.style.overflow = "";
    }

    menuBtnNew.addEventListener("click", openMenu);
    closeBtnNew.addEventListener("click", closeMenu);
    overlayNew.addEventListener("click", closeMenu);
    document.addEventListener("keydown", e => e.key === "Escape" && closeMenu());

    window.closeMenu = closeMenu;

    console.log("Navigation initialized");
    return true;
  }

  if (!initMobileMenu()) {
    const observer = new MutationObserver((mut, obs) => {
      if (initMobileMenu()) obs.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();

window.supabaseClient = supabase.createClient(
  "https://nhyucbgjocmwrkqbjjme.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE"
);

// profile.js — All profile page logic (no nav, no global stuff)
const { supabase } = window;

let currentUser = null;

// Helper: Get initials
const getInitials = name => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// Load full profile
async function loadProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = '/login.html';

  currentUser = user;

  // Get profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, date_of_birth, created_at')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const { data } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.email.split('@')[0],
      email: user.email
    }).select().single();
    profile = data;
  }

  const name = profile.full_name || user.email.split('@')[0];

  // Update header
  document.getElementById('avatar').textContent = getInitials(name);
  document.getElementById('fullName').textContent = name;
  document.getElementById('memberSince').textContent = `Member since ${new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  document.getElementById('userEmail').textContent = user.email;

  // Personal info
  document.getElementById('infoName').textContent = name;
  document.getElementById('infoPhone').textContent = profile.phone || '-';
  document.getElementById('infoDob').textContent = profile.date_of_birth
    ? new Date(profile.date_of_birth).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  // Shipping address from latest order
  const { data: latestOrder } = await supabase
    .from('orders')
    .select('shipping_address')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestOrder?.shipping_address) {
    const addr = latestOrder.shipping_address;
    document.getElementById('addrName').textContent = name;
    document.getElementById('addrLine').innerHTML = `
      ${addr.street || ''}<br>
      ${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || ''}<br>
      ${addr.country || 'United States'}
    `;

    // Use order phone if profile phone is empty
    if (!profile.phone && addr.phone) {
      document.getElementById('infoPhone').textContent = addr.phone;
    }
  }

  // Load stats
  const { count: total } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  const { count: pending } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['pending', 'processing']);
  document.getElementById('totalOrders').textContent = total || 0;
  document.getElementById('pendingOrders').textContent = pending || 0;

  // Load payment methods
  loadPaymentMethods();
}

// Load payment methods from DB
async function loadPaymentMethods() {
  const { data: methods } = await supabase
    .from('payment_methods')
    .select('brand, last4, is_default')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  const container = document.getElementById('paymentMethodsList');
  if (!methods || methods.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:#888;"><i class="fas fa-credit-card fa-2x" style="opacity:0.3;"></i><p>No payment methods yet</p></div>`;
    return;
  }

  container.innerHTML = methods.map(m => `
    <div class="payment-method">
      <i class="fab fa-cc-${m.brand.toLowerCase()}"></i> •••• •••• •••• ${m.last4}
      ${m.is_default ? '<span class="default-badge">Default</span>' : ''}
    </div>
  `).join('');
}

// Run when page loads
document.addEventListener('DOMContentLoaded', loadProfile);
// =========================
//  LOGOUT (GLOBAL)
// =========================
window.logoutUser = function () {
  window.supabaseClient.auth.signOut()
    .then(() => {
      localStorage.removeItem("shophub_cart");
      alert("Logged out! Cart emptied.");
      if (window.closeMenu) window.closeMenu();
      location.href = "../index.html";
    })
    .catch(err => {
      console.error("Logout error:", err);
      alert("Error: " + err.message);
    });
};
