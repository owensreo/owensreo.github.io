(function () {
  function parseTimestamp(value) {
    if (!value) {
      return null;
    }

    const normalized = value
      .trim()
      .replace(/\s+(EDT|EST)$/, "");

    const direct = new Date(normalized);

    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const match = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(AM|PM)$/
    );

    if (!match) {
      return null;
    }

    let hour = Number(match[4]);

    if (match[7] === "PM" && hour !== 12) {
      hour += 12;
    }

    if (match[7] === "AM" && hour === 12) {
      hour = 0;
    }

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      hour,
      Number(match[5]),
      Number(match[6])
    );
  }

  function relativeText(date) {
    const seconds = Math.max(
      0,
      Math.round((Date.now() - date.getTime()) / 1000)
    );

    if (seconds < 10) {
      return "now";
    }

    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days}d ago`;
  }

  function updateRelativeTimes() {
    document
      .querySelectorAll(".relative-time")
      .forEach((element) => {
        const parsed = parseTimestamp(
          element.dataset.timestamp
        );

        if (!parsed) {
          return;
        }

        element.textContent = relativeText(parsed);
      });
  }

  document
    .querySelectorAll(".clickable-host-row")
    .forEach((row) => {
      row.tabIndex = 0;
      row.setAttribute("role", "link");

      row.addEventListener("click", (event) => {
        if (
          event.target.closest("a") ||
          event.target.closest("button")
        ) {
          return;
        }

        window.location.href = row.dataset.hostUrl;
      });

      row.addEventListener("keydown", (event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          window.location.href = row.dataset.hostUrl;
        }
      });
    });

  const inventoryStatus = document.getElementById(
    "fleet-inventory-status"
  );

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  function updateInventory(payload) {
    const hosts = Array.isArray(payload.hosts)
      ? payload.hosts
      : [];

    hosts.forEach((host) => {
      const row = document.querySelector(
        '.clickable-host-row[data-host-name="' +
          CSS.escape(host.name) +
          '"]'
      );

      if (!row) {
        return;
      }

      const containerError = host.container_error || "";
      const vmError = host.vm_error || "";
      const values = {
        containers: host.containers === null
          ? "N/A"
          : host.containers.length,
        pods: host.pods === null
          ? "N/A"
          : host.pods.length,
        vms: host.vms === null
          ? "N/A"
          : host.vms.length,
      };

      Object.entries(values).forEach(([field, value]) => {
        const cell = row.querySelector(
          '[data-inventory-field="' + field + '"]'
        );

        if (!cell) {
          return;
        }

        cell.textContent = String(value);
        cell.title = field === "vms"
          ? vmError
          : containerError;
      });
    });

    const totals = payload.totals || {};
    setText("fleet-container-summary", totals.containers || 0);
    setText("fleet-container-total", totals.containers || 0);
    setText("fleet-pod-total", totals.pods || 0);
    setText("fleet-vm-total", totals.vms || 0);

    if (inventoryStatus) {
      inventoryStatus.textContent =
        "Live container and virtual-machine inventory updated.";
    }
  }

  async function refreshInventory() {
    if (inventoryStatus) {
      inventoryStatus.textContent =
        "Refreshing live container and virtual-machine inventory...";
    }

    try {
      const response = await fetch(
        "/api/fleet/inventory",
        {
          cache: "no-store",
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "HTTP " + response.status
        );
      }

      updateInventory(payload);
    } catch (error) {
      if (inventoryStatus) {
        inventoryStatus.textContent =
          "Stored telemetry shown; live inventory refresh failed: " +
          error.message;
      }
    }
  }

  updateRelativeTimes();
  refreshInventory();

  setInterval(updateRelativeTimes, 10000);
  setInterval(refreshInventory, 60000);
})();
