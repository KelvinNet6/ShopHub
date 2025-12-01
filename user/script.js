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
