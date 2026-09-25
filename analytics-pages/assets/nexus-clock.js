(function () {
  "use strict";

  const clocks = document.querySelectorAll("[data-eastern-clock]");
  const refreshButton = document.querySelector("[data-refresh-button]");

  const easternTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  function updateClock() {
    const now = new Date();
    const displayTime = easternTime.format(now);
    clocks.forEach((clock) => {
      const clockTime = clock.querySelector("[data-eastern-time]");
      if (!clockTime) return;
      clockTime.textContent = displayTime;
      clockTime.dateTime = now.toISOString();
      clock.setAttribute("aria-label", `Current Eastern Time ${displayTime}`);
    });
  }

  updateClock();
  window.setInterval(updateClock, 1000);
  if (refreshButton) refreshButton.addEventListener("click", () => window.location.reload());
}());
