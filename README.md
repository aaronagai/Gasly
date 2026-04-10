# PetrolPrice.xyz

A live fuel price tracker for Southeast Asia — real-time data sourced from official open government portals.

[![MIT License](https://img.shields.io/badge/license-MIT-00d4ff?style=flat-square&labelColor=0a0a0a)](LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-00ff64?style=flat-square&labelColor=0a0a0a)](https://github.com/aaronagai/PetrolPrice.xyz)

**Live site →** https://petrolprice.xyz

---

## Features

- **Multi-country fuel prices** — live data from open government sources (Malaysia, Singapore, Brunei, Indonesia)
- **Week-on-week price change** — colour-coded ▲/▼ indicator with diff
- **3-month price history chart** per fuel type (Chart.js)
- **Interactive SEA map** — click countries to view live prices (D3 + TopoJSON)
- **PWA-ready** — installable on mobile (manifest + icons)
- **Auto dark/light mode** — follows system preference
- **Auto-refresh** with animated live indicator
- **Zero frameworks** — plain HTML, CSS, JavaScript

## Views

| Page | Description |
|------|-------------|
| `index.html` | Landing page with interactive Southeast Asia map |
| `app.html` | Full PWA app — global price comparison, charts, dark/light mode |
| `terminal.html` | Terminal-themed viewer — per-country prices via `?country=<id>` |

## Running Locally

No build step required — it's a static site.

```bash
git clone https://github.com/aaronagai/PetrolPrice.xyz.git
cd PetrolPrice.xyz

# Serve locally (any static file server works)
npx serve .
# or
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deployment

Deployed via **GitHub Pages** from the `main` branch root.

To deploy your own fork:
1. Fork this repo
2. Go to **Settings → Pages → Source**: `main` branch, `/ (root)`
3. Your live URL will be `https://<your-username>.github.io/PetrolPrice.xyz`

## Project Structure

```
PetrolPrice.xyz/
├── index.html              # Landing page with interactive SEA map
├── app.html                # PWA app — global comparison, dark/light mode
├── terminal.html           # Terminal-themed country viewer (?country= param)
├── style.css               # Shared dark terminal theme
├── app.js                  # Data fetching & rendering (Malaysia)
├── logo.svg                # Site logo
├── manifest.webmanifest    # PWA manifest
├── assets/
│   ├── countries-110m.json # World map TopoJSON (D3)
│   ├── singapore-geo.json  # Singapore district boundaries
│   └── icons/
│       └── applogo.png     # App icon (PWA + touch icon)
├── LICENSE
└── README.md
```

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

> Real-time fuel prices, free & open source forever.
