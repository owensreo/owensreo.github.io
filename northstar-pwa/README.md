# Northstar Guard PWA

This is a static, read-only dashboard for the Northstar API. It contains no
API URL, token, OAuth credential, or other secret. On first launch, open
**Settings** and enter the Tailscale Serve URL and Northstar bearer token; the
browser keeps those values in local storage on that device.

After the GitHub Pages workflow deploys it, open the Pages URL while connected
to Tailscale, configure the connection, and use **Share → Add to Home Screen**
on iPhone or iPad. The service worker caches the UI shell, while status and
reports are always fetched live from Northstar.
