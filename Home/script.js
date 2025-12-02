  // ———— AUTH STATE LISTENER (IMPORTANT) ————
  let currentUser = null;
  let isAdmin = false;

  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user ?? null;
    // Optional: check role from your profiles table (recommended)
    if (currentUser) {
      checkIfAdmin(currentUser.id);
    } else {
      isAdmin = false;
    }
  });

  // Optional but recommended: fetch role from a "profiles" table
  async function checkIfAdmin(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    isAdmin = data?.role === 'admin';
  }

  // Get initial session on page load
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user ?? null;
    if (currentUser) checkIfAdmin(currentUser.id);
  });
// Smart "My Vault" navigation
document.getElementById('myVaultLink').addEventListener('click', (e) => {
  e.preventDefault();

  if (currentUser) {
    // User is logged in
    if (isAdmin) {
      window.location.href = '../Admin/landing.html';          
    } else {
      window.location.href = '../user/userDashboard.html';        
    }
  } else {
    // Not logged in → go to login (and remember where they wanted to go)
    const redirectTo = encodeURIComponent(window.location.pathname);
   window.location.href = `/ShopHub/Admin/adLogin.html?redirect=${redirectTo}`;
  }
});
