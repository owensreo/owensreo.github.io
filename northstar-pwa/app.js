const $ = (id) => document.getElementById(id);
const DEFAULT_API = 'https://northstar-runner.tail57c12c.ts.net';
const config = () => ({url: localStorage.getItem('northstar.apiUrl') || DEFAULT_API});

let reportIndex = [];
let reportCursor = 0;
let fleetPeers = [];
let latestReportState = 'Current';
const AUTO_REFRESH_MS = 30 * 60 * 1000;
let nextRefreshAt = Date.now() + AUTO_REFRESH_MS;
let refreshInFlight = false;

function updateAutoRefreshLabel() {
  if (document.hidden) {
    $('auto-refresh').textContent = 'Auto-refresh paused';
    return;
  }
  const remaining = Math.max(0, nextRefreshAt - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  $('auto-refresh').textContent = `Auto-refresh ${minutes}:${seconds}`;
}

function updateClock() {
  const now = new Date();
  $('header-clock').dateTime = now.toISOString();
  $('header-clock').textContent = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

async function get(path) {
  const base = config().url.replace(/\/$/, '');
  const response = await fetch(base + path, {cache: 'no-store'});
  if (!response.ok) throw Error(`Northstar API returned ${response.status}.`);
  return response.json();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const output = [];
  let inCode = false;
  let code = [];
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        output.push(`<pre class="code-block"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
        inCode = false;
      } else inCode = true;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) continue;
    if (/^#{1,6}\s/.test(line)) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      output.push(`<h${match[1].length}>${inlineMarkdown(match[2])}</h${match[1].length}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!output.length || !output[output.length - 1].startsWith('<ul>')) output.push('<ul>');
      output[output.length - 1] = output[output.length - 1].replace('</ul>', '') + `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li></ul>`;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (!output.length || !output[output.length - 1].startsWith('<ol>')) output.push('<ol>');
      output[output.length - 1] = output[output.length - 1].replace('</ol>', '') + `<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li></ol>`;
      continue;
    }
    if (/^---+$/.test(line.trim())) { output.push('<hr>'); continue; }
    output.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  if (inCode) output.push(`<pre class="code-block"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return output.join('');
}

function reportDate(report) {
  if (!report?.modified) return null;
  const value = Number(report.modified);
  const date = new Date(value > 1e12 ? value : value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageLabel(date) {
  if (!date) return 'unknown age';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function updateReportNavigation() {
  $('newer-report').disabled = reportCursor <= 0;
  $('older-report').disabled = reportCursor >= reportIndex.length - 1;
  $('report-position').textContent = reportIndex.length ? `Report ${reportCursor + 1} of ${reportIndex.length}` : 'No reports';
}

function populateReports(reports) {
  reportIndex = reports || [];
  reportCursor = 0;
  const select = $('report-select');
  select.replaceChildren();
  if (!reportIndex.length) {
    select.add(new Option('No reports available', ''));
    select.disabled = true;
    updateReportNavigation();
    return;
  }
  reportIndex.forEach((report, index) => {
    const date = reportDate(report);
    const label = `${index === 0 ? 'Latest — ' : ''}${date ? date.toLocaleString() : (report.filename || report.id)}`;
    select.add(new Option(label, report.id));
  });
  select.disabled = false;
  select.value = reportIndex[0].id;
  updateReportNavigation();
}

async function loadReport(id) {
  if (!id) return;
  const index = reportIndex.findIndex((report) => report.id === id);
  if (index >= 0) reportCursor = index;
  const detail = await get('/api/v1/reports/' + encodeURIComponent(id));
  $('report').textContent = detail.markdown || '';
  $('report-html').innerHTML = markdownToHtml(detail.markdown || '');
  $('report-html').hidden = false;
  $('report').hidden = true;
  $('raw-toggle').disabled = false;
  $('raw-toggle').textContent = 'View raw Markdown';
  $('message').textContent = reportCursor === 0 ? 'Latest executive report' : 'Archived executive report';
  $('report-badge').textContent = reportCursor === 0 ? latestReportState : 'Archived';
  $('report-badge').classList.toggle('stale', reportCursor === 0 && latestReportState === 'Stale');
  $('report-select').value = id;
  updateReportNavigation();
}

const DISPLAY_NAMES = {'Blue-Ridge-Server-2025': 'BR-WINDOWS-11', 'BLUE-RIDGE-SERV': 'BR-WINDOWS-11'};
const HOST_DEVICES = new Set(['Blue-Ridge-Server-2025', 'BLUE-RIDGE-SERV']);

function isServer(device) {
  const raw = device.hostname || device.dns_name || '';
  if (HOST_DEVICES.has(raw)) return false;
  return /(server|nexus|exit|warp|host|pi|staging)/.test(raw.toLowerCase());
}

function displayName(device) {
  const name = device.hostname || device.dns_name || 'Unnamed device';
  return DISPLAY_NAMES[name] || name;
}

function renderGroup(id, devices) {
  const list = $(id);
  list.replaceChildren();
  if (!devices.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'None matching filters';
    list.append(item);
    return;
  }
  devices.sort((a, b) => displayName(a).localeCompare(displayName(b))).forEach((device) => {
    const item = document.createElement('li');
    const network = device.network === 'cloudflare-warp' ? 'Cloudflare WARP mesh' : '';
    item.innerHTML = `<span class="device-dot ${device.online ? 'good' : 'bad'}"></span><span><strong>${escapeHtml(displayName(device))}</strong><small>${escapeHtml(network || device.os || 'Unknown OS')}${!network && device.tailscale_ips?.[0] ? ' • ' + escapeHtml(device.tailscale_ips[0]) : ''}</small></span>`;
    list.append(item);
  });
}

function normalizedPeers(status) {
  const rawPeers = status.peers || [];
  const names = new Set(rawPeers.map((device) => (device.hostname || device.dns_name || '').replace(/\.tail.*$/, '')));
  return rawPeers.filter((device) => {
    const name = (device.hostname || device.dns_name || '').replace(/\.tail.*$/, '');
    return !(name.endsWith('-podman') && names.has(name.slice(0, -7)));
  });
}

function renderFleet() {
  const query = $('fleet-search').value.trim().toLowerCase();
  const state = $('fleet-filter').value;
  const filtered = fleetPeers.filter((device) => {
    if (state === 'online' && !device.online) return false;
    if (state === 'offline' && device.online) return false;
    const searchable = [displayName(device), device.hostname, device.dns_name, device.os, device.network, ...(device.tailscale_ips || [])].join(' ').toLowerCase();
    return !query || searchable.includes(query);
  });
  const groups = {serversOnline: [], serversOffline: [], hostsOnline: [], hostsOffline: []};
  filtered.forEach((device) => {
    const key = isServer(device) ? (device.online ? 'serversOnline' : 'serversOffline') : (device.online ? 'hostsOnline' : 'hostsOffline');
    groups[key].push(device);
  });
  Object.entries(groups).forEach(([key, devices]) => {
    const id = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    renderGroup(id, devices);
    $(`${id}-count`).textContent = devices.length;
  });
  $('servers-total').textContent = groups.serversOnline.length + groups.serversOffline.length;
  $('hosts-total').textContent = groups.hostsOnline.length + groups.hostsOffline.length;
  $('fleet-match-count').textContent = `${filtered.length} of ${fleetPeers.length} devices`;
}

function showError(error) {
  $('runner').textContent = 'Unavailable';
  $('runner-detail').textContent = 'Private Northstar API could not be reached';
  $('workflow-health').textContent = 'Report workflow: unavailable';
  $('runner-dot').className = 'bad';
  $('report-badge').textContent = 'Offline';
  $('report-badge').classList.add('stale');
  $('message').textContent = error.message;
  $('connection-help').hidden = false;
  $('report').hidden = true;
  $('report-html').hidden = true;
  $('last-updated').textContent = `Last attempted: ${new Date().toLocaleTimeString()}`;
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  const button = $('refresh');
  button.disabled = true;
  button.textContent = 'Refreshing…';
  $('message').textContent = 'Refreshing fleet and reports…';
  $('report-badge').textContent = 'Loading';
  $('connection-help').hidden = true;
  try {
    const [status, reports] = await Promise.all([get('/api/v1/status'), get('/api/v1/reports')]);
    const latest = reports.reports?.[0] || null;
    const latestDate = reportDate(latest);
    const ageHours = latestDate ? (Date.now() - latestDate.getTime()) / 3600000 : Infinity;
    latestReportState = ageHours <= 8 ? 'Current' : ageHours <= 14 ? 'Delayed' : 'Stale';
    $('runner').textContent = status.backend_state || 'Unknown';
    $('runner-detail').textContent = `${status.control_plane?.online_count ?? '—'} devices online in the control plane`;
    $('workflow-health').textContent = latest ? `Report workflow: ${latestReportState.toLowerCase()} • ${ageLabel(latestDate)}` : 'Report workflow: no report available';
    $('runner-dot').className = status.backend_state === 'Running' ? 'good' : 'bad';
    $('last-updated').textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
    const controlPlane = status.control_plane || {};
    $('device-count').textContent = controlPlane.device_count ?? '—';
    $('online').textContent = controlPlane.online_count ?? '—';
    fleetPeers = normalizedPeers(status);
    renderFleet();
    populateReports(reports.reports || []);
    if (latest) {
      $('report-time').textContent = latestDate ? latestDate.toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : 'Available';
      $('report-file').textContent = latest.filename || latest.id;
      await loadReport(latest.id);
    } else {
      $('report-time').textContent = '—';
      $('report-file').textContent = 'no reports available';
      $('message').textContent = 'No report is available yet.';
      $('report-badge').textContent = 'Unavailable';
    }
  } catch (error) {
    showError(error);
  } finally {
    refreshInFlight = false;
    nextRefreshAt = Date.now() + AUTO_REFRESH_MS;
    updateAutoRefreshLabel();
    button.disabled = false;
    button.textContent = 'Refresh';
  }
}

function openSettings() {
  $('api-url').value = config().url;
  $('settings-dialog').showModal();
}

$('settings').onclick = openSettings;
$('refresh').onclick = refresh;
$('save').onclick = (event) => {
  event.preventDefault();
  localStorage.setItem('northstar.apiUrl', $('api-url').value.trim() || DEFAULT_API);
  $('settings-dialog').close();
  refresh();
};
$('fleet-search').oninput = renderFleet;
$('fleet-filter').onchange = renderFleet;
$('report-select').onchange = () => loadReport($('report-select').value).catch(showError);
$('newer-report').onclick = () => reportCursor > 0 && loadReport(reportIndex[reportCursor - 1].id).catch(showError);
$('older-report').onclick = () => reportCursor < reportIndex.length - 1 && loadReport(reportIndex[reportCursor + 1].id).catch(showError);
$('raw-toggle').onclick = () => {
  const showRaw = $('report').hidden;
  $('report').hidden = !showRaw;
  $('report-html').hidden = showRaw;
  $('raw-toggle').textContent = showRaw ? 'View formatted report' : 'View raw Markdown';
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
document.addEventListener('visibilitychange', () => {
  updateClock();
  if (!document.hidden && Date.now() >= nextRefreshAt) refresh();
  else updateAutoRefreshLabel();
});
setInterval(() => {
  updateClock();
  if (document.hidden || refreshInFlight) return;
  if (Date.now() >= nextRefreshAt) refresh();
  else updateAutoRefreshLabel();
}, 1000);
updateClock();
updateAutoRefreshLabel();
refresh();
