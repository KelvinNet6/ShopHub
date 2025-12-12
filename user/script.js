(() => {
  "use strict";

  // THIS IS NOW CORRECT – supabaseJs is the real global object from the CDN
  const { createClient } = supabaseJs;
  const supabase = createClient(
    "https://nhyucbgjocmwrkqbjjme.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE"
  );

  window.supabase = supabase;
  window.supabaseClient = supabase;

  const getInitials = name => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // MOBILE MENU – 100% working version
  function initMobileMenu() {
    const menuBtn   = document.getElementById("menuBtn");
    const closeBtn  = document.getElementById("closeBtn");
    const slideMenu = document.getElementById("slideMenu");
    const overlay   = document.getElementById("overlay");

    if (!menuBtn || !closeBtn || !slideMenu || !overlay) return false;

    const openMenu = () => {
      slideMenu.classList.add("active");
      overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
      slideMenu.classList.remove("active");
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    };

    // Remove old listeners safely
    menuBtn.replaceWith(menuBtn.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    overlay.replaceWith(overlay.cloneNode(true));

    // Re-query after cloning
    document.getElementById("menuBtn").addEventListener("click", openMenu);
    document.getElementById("closeBtn").addEventListener("click", closeMenu);
    document.getElementById("overlay").addEventListener("click", closeMenu);

    document.addEventListener("keydown", e => e.key === "Escape" && closeMenu());
    window.closeMenu = closeMenu;

    console.log("Mobile menu WORKING 100%");
    return true;
  }

  // Run now + fallback if nav loads later
  if (!initMobileMenu()) {
    new MutationObserver((_, obs) => {
      if (initMobileMenu()) obs.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.getElementById('avatar')) {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login.html';
        return;
      }

      currentUser = user;

      // Get or create profile
      let { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, date_of_birth, created_at')
        .eq('id', user.id)
        .single();

      if (!profile) {
        const { data } = await supabase
          .from('profiles')
          .insert({ id: user.id, full_name: user.email.split('@')[0], email: user.email })
          .select()
          .single();
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

      // Latest order address & phone
      const { data: order } = await supabase
        .from('orders')
        .select('shipping_address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (order?.shipping_address) {
        const a = order.shipping_address;
        document.getElementById('addrName').textContent = name;
        document.getElementById('addrLine').innerHTML = `
          ${a.street || ''}<br>
          ${a.city || ''}, ${a.state || ''} ${a.postal_code || ''}<br>
          ${a.country || 'United States'}
        `;
        if (!profile.phone && a.phone) {
          document.getElementById('infoPhone').textContent = a.phone;
        }
      }

      // Order stats
      const { count: total } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const { count: pending } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['pending', 'processing']);
      document.getElementById('totalOrders').textContent = total || 0;
      document.getElementById('pendingOrders').textContent = pending || 0;

      // Load payment methods
      const { data: cards } = await supabase
        .from('payment_methods')
        .select('brand, last4, is_default')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const list = document.getElementById('paymentMethodsList');
      if (!cards?.length) {
        list.innerHTML = `<div style="text-align:center;padding:2rem;color:#888;"><i class="fas fa-credit-card fa-2x" style="opacity:0.3;"></i><p>No payment methods yet</p></div>`;
      } else {
        list.innerHTML = cards.map(c => `
          <div class="payment-method">
            <i class="fab fa-cc-${c.brand.toLowerCase()}"></i> •••• •••• •••• ${c.last4}
            ${c.is_default ? '<span class="default-badge">Default</span>' : ''}
          </div>
        `).join('');
      }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadProfile);
    } else {
      loadProfile();
    }
  }

  // =========================
  // GLOBAL LOGOUT
  // =========================
  window.logoutUser = async function () {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("shophub_cart");
      alert("Logged out successfully!");
      if (window.closeMenu) window.closeMenu();
      window.location.href = "/index.html";
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Error: " + err.message);
    }
  };

  console.log("ShopHub is ready – everything loaded from one file");
})();

// =====================================================
// UPDATE USER INFO INSIDE NAVIGATION
// =====================================================
async function updateNavUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const avatar = document.getElementById("navAvatar");
    const nameEl = document.getElementById("navUserName");
    const emailEl = document.getElementById("navUserEmail");

    if (!avatar || !nameEl || !emailEl) return; // nav not loaded yet

    if (!user) {
      avatar.textContent = "?";
      nameEl.textContent = "Guest";
      emailEl.textContent = "Not signed in";
      return;
    }

    // Fetch profile if exists
    let { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const fullName = profile?.full_name || user.email.split("@")[0];
    const initials = fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    avatar.textContent = initials;
    nameEl.textContent = fullName;
    emailEl.textContent = user.email;

  } catch (err) {
    console.error("Nav user update failed:", err);
  }
}

// keep checking until nav loads
const navObserver = new MutationObserver(() => {
  if (document.getElementById("navAvatar")) {
    updateNavUser();
    navObserver.disconnect();
  }
});
navObserver.observe(document.body, { childList: true, subtree: true });
