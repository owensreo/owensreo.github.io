(function () {
  const clocks = document.querySelectorAll(
    "[data-eastern-clock]"
  );

  function updateClock() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }
    );

    const value = formatter.format(now);

    clocks.forEach((clock) => {
      clock.textContent = value;
    });
  }

  updateClock();
  setInterval(updateClock, 1000);
})();
