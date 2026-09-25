(function () {
  "use strict";
  document.querySelectorAll(".message-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.title = expanded ? "Expand full message" : "Collapse message";
    });
  });
}());
