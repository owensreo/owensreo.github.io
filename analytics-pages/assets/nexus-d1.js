(function () {
  "use strict";

  const endpoint = "https://nexus-pi.tail57c12c.ts.net:8443/api/analytics/";
  const dashboard = document.body.dataset.dashboard;
  if (!["website", "firewall"].includes(dashboard)) return;

  const number = new Intl.NumberFormat("en-US");
  const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const byClass = (selector) => document.querySelector(selector);
  const cards = () => [...document.querySelectorAll(".kpi-grid .kpi-card")];
  const setValue = (card, value) => {
    const target = card && card.querySelector(".kpi-value");
    if (target) target.textContent = String(value);
  };
  const formatTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : eastern.format(date);
  };
  const setStatus = (updatedAt, label = "Nexus Pi · D1 current", delayed = false) => {
    const time = byClass(".refresh-meta time");
    if (time) {
      time.dateTime = updatedAt || "";
      time.textContent = updatedAt ? new Date(updatedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York" }) : "—";
    }
    const status = byClass(".header-status .status-pill");
    if (status) {
      status.textContent = label;
      status.classList.toggle("status-warning", delayed);
      status.classList.toggle("status-healthy", !delayed);
    }
  };
  const ageLabel = (value) => {
    const timestamp = new Date(value).valueOf();
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60000) return "Unknown";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 2) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Remove the build-time preview numbers before the first request so an
  // offline page can never be mistaken for current D1 telemetry.
  cards().forEach((card) => setValue(card, "Loading…"));
  const initialTable = document.querySelector(".panel table tbody");
  if (initialTable) initialTable.replaceChildren(Object.assign(document.createElement("tr"), { innerHTML: '<td colspan="7">Loading current D1 data…</td>' }));
  const initialChart = byClass(".trend-chart");
  if (initialChart) initialChart.replaceChildren();
  const initialCategories = byClass(".category-list");
  if (initialCategories) initialCategories.replaceChildren();

  function updateWebsite(details, sourceUpdatedAt, publishedAt) {
    const kpis = cards();
    const mb = (bytes) => `${(Number(bytes || 0) / 1048576).toFixed(2)} MB`;
    setValue(kpis[0], number.format(details.requests || 0));
    setValue(kpis[1], number.format(details.visitors || 0));
    setValue(kpis[2], mb(details.bytes));
    setValue(kpis[3], mb(details.cached_bytes));
    setValue(kpis[4], `${Number(details.cache_percentage || 0).toFixed(1)}%`);
    setValue(kpis[5], number.format(details.threats || 0));

    const points = [...(details.hourly || [])].reverse();
    const maxima = ["requests", "visitors", "cache_percentage"].map((key) => Math.max(1, ...points.map((item) => key === "cache_percentage" ? Number(item.bytes ? item.cached_bytes * 100 / item.bytes : 0) : Number(item[key] || 0))));
    const chart = byClass(".trend-chart");
    if (chart && points.length) {
      chart.replaceChildren(...points.slice(-12).map((item) => {
        const row = document.createElement("div");
        row.className = "trend-sample";
        const time = document.createElement("span");
        time.className = "trend-time";
        time.textContent = new Date(item.hour).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: true });
        row.append(time);
        ["requests", "visitors", "cache_percentage"].forEach((key, index) => {
          const value = key === "cache_percentage" ? Number(item.bytes ? item.cached_bytes * 100 / item.bytes : 0) : Number(item[key] || 0);
          const track = document.createElement("span");
          track.className = "trend-track";
          const bar = document.createElement("i");
          bar.className = ["trend-down", "trend-up", "trend-ping"][index];
          bar.style.width = `${Math.max(0.5, value * 100 / maxima[index])}%`;
          track.append(bar);
          row.append(track);
        });
        return row;
      }));
    } else if (chart) {
      chart.textContent = "No hourly data is available yet.";
    }

    const body = document.querySelector(".panel table tbody");
    if (body && points.length) {
      body.replaceChildren(...[...points].reverse().slice(0, 24).map((item) => {
        const row = document.createElement("tr");
        const values = [formatTime(item.hour), number.format(item.requests || 0), number.format(item.visitors || 0), mb(item.bytes), mb(item.cached_bytes), `${Number(item.bytes ? item.cached_bytes * 100 / item.bytes : 0).toFixed(1)}%`, number.format(item.threats || 0)];
        values.forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          if (index === 0) cell.className = "time-cell";
          row.append(cell);
        });
        return row;
      }));
    } else if (body) {
      body.replaceChildren(Object.assign(document.createElement("tr"), { innerHTML: '<td colspan="7">No hourly data is available yet.</td>' }));
    }

    const latest = details.latest || sourceUpdatedAt;
    const latestText = latest ? formatTime(latest) : "—";
    const syncTimestamp = new Date(publishedAt).valueOf();
    const syncIsCurrent = Number.isFinite(syncTimestamp) && Date.now() - syncTimestamp <= 30 * 60000 && syncTimestamp <= Date.now() + 60000;
    const healthStatus = byClass("[data-health-status]");
    if (healthStatus) {
      healthStatus.textContent = syncIsCurrent ? "D1 sync current" : "D1 sync delayed";
      healthStatus.classList.toggle("status-warning", !syncIsCurrent);
      healthStatus.classList.toggle("status-healthy", syncIsCurrent);
    }
    const healthAge = byClass("[data-health-age]");
    if (healthAge) healthAge.textContent = latest ? ageLabel(latest) : "No data";
    const healthLatest = byClass("[data-health-latest]");
    if (healthLatest) healthLatest.textContent = latestText;
    const healthRecords = byClass("[data-health-records]");
    if (healthRecords) healthRecords.textContent = `${Math.min(points.length, 24)} of 24 hours`;
    setStatus(publishedAt || sourceUpdatedAt, syncIsCurrent ? "Nexus Pi · D1 current" : "Nexus Pi · D1 delayed", !syncIsCurrent);
  }

  function updateFirewall(details, updatedAt) {
    const kpis = cards();
    const events = Number(details.events || 0);
    const warnings = Number(details.warnings || 0);
    const critical = Number(details.critical || 0);
    const info = Math.max(0, events - warnings - critical);
    const latestAge = details.latest ? Math.max(0, Math.floor((Date.now() - new Date(details.latest).valueOf()) / 3600000)) : null;
    setValue(kpis[0], number.format(events));
    setValue(kpis[1], number.format(critical));
    setValue(kpis[2], number.format(warnings));
    setValue(kpis[3], details.categories?.[0]?.name?.replaceAll("_", " ") || "None");
    setValue(kpis[4], latestAge === null ? "No events" : latestAge < 1 ? "<1h ago" : `${latestAge}h ago`);

    const segments = [...document.querySelectorAll(".severity-bar .severity-segment")];
    [critical, warnings, info].forEach((value, index) => {
      if (segments[index]) segments[index].style.width = `${events ? value * 100 / events : 0}%`;
    });
    const severityBar = byClass(".severity-bar");
    if (severityBar) severityBar.setAttribute("aria-label", `Critical ${critical}, warning ${warnings}, info ${info}`);
    const legend = [...document.querySelectorAll(".severity-legend .legend-item strong")];
    [critical, warnings, info].forEach((value, index) => { if (legend[index]) legend[index].textContent = number.format(value); });

    const categoryList = byClass(".category-list");
    if (categoryList && details.categories) {
      categoryList.replaceChildren(...details.categories.slice(0, 8).map((item) => {
        const row = document.createElement("li");
        row.className = "category-row";
        const label = document.createElement("span"); label.className = "category-name"; label.textContent = item.name.replaceAll("_", " ");
        const severity = document.createElement("span"); severity.className = "status-pill status-info"; severity.textContent = "summary";
        const count = document.createElement("strong"); count.className = "category-count"; count.textContent = number.format(item.count);
        row.append(label, severity, count);
        return row;
      }));
    }

    const body = document.querySelector(".panel table tbody");
    if (body && details.recent) {
      body.replaceChildren(...details.recent.map((item) => {
        const row = document.createElement("tr");
        const time = document.createElement("td"); time.className = "time-cell"; time.textContent = formatTime(item.timestamp);
        const category = document.createElement("td"); category.textContent = item.category.replaceAll("_", " ");
        const severityCell = document.createElement("td");
        const severity = document.createElement("span"); severity.className = `status-pill status-${["critical", "high", "warning"].includes(item.severity.toLowerCase()) ? "warning" : "info"}`; severity.textContent = item.severity;
        severityCell.append(severity);
        const messageCell = document.createElement("td"); messageCell.className = "message-cell"; messageCell.textContent = "Event summary · raw message and address remain on nexus-pi";
        row.append(time, category, severityCell, messageCell);
        return row;
      }));
    }
    setStatus(updatedAt);
  }

  fetch(`${endpoint}${dashboard}`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`Cloudflare API returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const snapshot = payload.dashboard;
      if (!snapshot || snapshot.source !== "nexus-pi") throw new Error("Nexus Pi data is not available yet");
      if (dashboard === "website") updateWebsite(snapshot.details || {}, snapshot.source_updated_at, snapshot.updated_at);
      if (dashboard === "firewall") updateFirewall(snapshot.details || {}, snapshot.source_updated_at);
    })
    .catch((error) => {
      const status = byClass(".header-status .status-pill");
      if (status) { status.textContent = "D1 data unavailable"; status.classList.add("status-warning"); }
      console.error("Analytics API refresh failed:", error);
    });
}());
