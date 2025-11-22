// script.js – GUARANTEED to work with dynamically loaded nav.html
(function () {
  function initMobileMenu() {
    const menuBtn   = document.getElementById("menuBtn");
    const closeBtn  = document.getElementById("closeBtn");
    const slideMenu = document.getElementById("slideMenu");
    const overlay   = document.getElementById("overlay");

    // If any element is missing → nav not injected yet → try again later
    if (!menuBtn || !closeBtn || !slideMenu || !overlay) {
      return false;
    }

    // Remove old listeners (in case script ran before)
    const newMenuBtn = menuBtn.cloneNode(true);
    const newCloseBtn = closeBtn.cloneNode(true);
    const newOverlay = overlay.cloneNode(true);
    menuBtn.replaceWith(newMenuBtn);
    closeBtn.replaceWith(newCloseBtn);
    overlay.replaceWith(newOverlay);

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

    newMenuBtn.addEventListener("click", openMenu);
    newCloseBtn.addEventListener("click", closeMenu);
    newOverlay.addEventListener("click", closeMenu);
    document.addEventListener("keydown", e => e.key === "Escape" && closeMenu());

    // Active page highlighting
    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("#global-navigation a").forEach(a => {
      a.classList.toggle("active", a.getAttribute("href") === current);
    });

    console.log("Mobile menu activated");
    return true;
  }

  // Try immediately
  if (!initMobileMenu()) {
    // If nav not ready yet → watch for it
    const observer = new MutationObserver((mutations, obs) => {
      if (initMobileMenu()) {
        obs.disconnect();
      }
    });
    observer.observe(document.getElementById("global-navigation") || document.body, {
      childList: true,
      subtree: true
    });
  }
})();
