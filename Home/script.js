  const supabaseUrl = "https://nhyucbgjocmwrkqbjjme.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXVjYmdqb2Ntd3JrcWJqam1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTQzNjAsImV4cCI6MjA3OTA3MDM2MH0.uu5ZzSf1CHnt_l4TKNIxWoVN_2YCCoxEZiilB1Xz0eE";
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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
