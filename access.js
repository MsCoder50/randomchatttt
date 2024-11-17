document.addEventListener("DOMContentLoaded", function () {
  const chatButton = document.getElementById("text-chat");
  chatButton.addEventListener("click", function () {
    window.location.href = "chat.html";
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const menuIcon = document.getElementById("menu-icon");
  const closeSidebar = document.getElementById("close-sidebar");
  const sidebar = document.getElementById("sidebar");

  // Open sidebar on menu icon click
  menuIcon.addEventListener("click", () => {
    sidebar.classList.add("open");
  });

  // Close sidebar on close button click
  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("open");
  });
});
