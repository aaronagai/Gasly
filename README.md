# PetrolPrice.xyz

A sleek, terminal-themed web app that displays **live fuel prices from around the world** using open government data.

[![MIT License](https://img.shields.io/badge/license-MIT-00d4ff?style=flat-square&labelColor=0a0a0a)](LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-00ff64?style=flat-square&labelColor=0a0a0a)](https://github.com/aaronagai/PetrolPrice.xyz)

**Live site →** https://petrolprice.xyz

---

## Features

- **Multi-country fuel prices** — live data from open government sources worldwide
- **Week-on-week price change** — colour-coded ▲/▼ indicator with diff
- **3-month price history chart** per fuel type (Chart.js)
- **Auto-refresh** with animated live indicator
- **Dark terminal aesthetic** — glassmorphism cards, neon accents, DM Mono
- **Mobile-first responsive** layout
- **Zero frameworks** — plain HTML, CSS, JavaScript

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
├── index.html      # Landing page with interactive SEA map
├── malaysia.html   # Malaysia fuel prices
├── singapore.html  # Singapore fuel prices
├── brunei.html     # Brunei fuel prices
├── style.css       # Dark terminal theme styles
├── app.js          # Data fetching, rendering, charts
├── LICENSE         # MIT License
└── README.md       # This file
```

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

> Real-time fuel prices, free & open source forever.
