document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menuBtn");
  const closeBtn = document.getElementById("closeBtn");
  const slideMenu = document.getElementById("slideMenu");
  const overlay = document.getElementById("overlay");

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

  menuBtn?.addEventListener("click", openMenu);
  closeBtn?.addEventListener("click", closeMenu);
  overlay?.addEventListener("click", closeMenu);

  document.addEventListener("keydown", e => e.key === "Escape" && closeMenu());

  // Auto-highlight current page
  const path = location.pathname.split("/").pop() || "userDashboard.html";
  document.querySelectorAll(".menu-list a").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });
});
