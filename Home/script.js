// script.js — Authentication & Smart Navigation Handler

let currentUser = null;
let isAdmin = false;

// Listen for authentication state changes (login, logout, token refresh)
supabase.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user ?? null;

  if (currentUser) {
    await checkIfAdmin(currentUser.id);
  } else {
    isAdmin = false;
  }

  // Optional: Update UI elements based on login state (e.g., show/hide admin links)
  updateUIForAuthState();
});

// Check if the logged-in user has admin privileges
async function checkIfAdmin(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      isAdmin = false;
      return;
    }

    isAdmin = data?.role === 'admin';
  } catch (err) {
    console.error('Unexpected error checking admin status:', err);
    isAdmin = false;
  }
}

// Optional: Update UI elements when auth state changes
function updateUIForAuthState() {
  const vaultLink = document.getElementById('myVaultLink');
  if (!vaultLink) return;

  if (currentUser) {
    vaultLink.textContent = isAdmin ? 'Admin Dashboard' : 'My Vault';
    vaultLink.style.cursor = 'pointer';
  } else {
    vaultLink.textContent = 'My Vault';
  }
}

// Handle initial session on page load
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user ?? null;

  if (currentUser) {
    await checkIfAdmin(currentUser.id);
  }

  updateUIForAuthState();
})();

// Smart "My Vault" click handler
document.getElementById('myVaultLink')?.addEventListener('click', (e) => {
  e.preventDefault();

  if (currentUser) {
    if (isAdmin) {
      window.location.href = '/ShopHub/Admin/landing.html';
    } else {
      window.location.href = '/ShopHub/user/userDashboard.html';
    }
  } else {
    // User not logged in → redirect to admin login with return URL
    const redirectTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/ShopHub/Admin/adLogin.html?redirect=${redirectTo}`;
  }
});

