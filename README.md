# ⛽ MY Fuel Price

A sleek, terminal-themed single-page web app that displays **live Malaysia fuel prices** using open government data.

[![MIT License](https://img.shields.io/badge/license-MIT-00d4ff?style=flat-square&labelColor=0a0a0a)](LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-00ff64?style=flat-square&labelColor=0a0a0a)](https://github.com/aaronagai/my-fuel-price)
[![Data: data.gov.my](https://img.shields.io/badge/data-data.gov.my-ffaa00?style=flat-square&labelColor=0a0a0a)](https://data.gov.my)

**Live site →** https://aaronagai.github.io/my-fuel-price

---

## Features

- **5 fuel types**: RON95, RON97, Diesel (Peninsular), Diesel (East Malaysia), BUDI95 Subsidised
- **Week-on-week price change** — colour-coded ▲/▼ indicator with RM diff
- **8-week sparkline chart** per fuel type (Chart.js)
- **EN / BM language toggle** — full bilingual UI
- **Auto-refresh** every 60 seconds with animated live indicator
- **Next update countdown** — prices update every Wednesday midnight MYT
- **Dark terminal aesthetic** — glassmorphism cards, neon accents, JetBrains Mono
- **Mobile-first responsive** layout
- **Zero frameworks** — plain HTML, CSS, JavaScript

## Data Source

Fuel prices are fetched live from the **Official Malaysia Open Data Portal**:

```
GET https://api.data.gov.my/data-catalogue?id=fuelprice&sort=-date&limit=52
```

Data provided by the **Ministry of Finance (MOF) Malaysia** via [data.gov.my](https://data.gov.my).

Prices are updated **every Wednesday at midnight** Malaysia Time (MYT / UTC+8).

### Fuel fields in the API

| Field           | Description                          |
|-----------------|--------------------------------------|
| `ron95`         | RON95 petrol, Peninsular Malaysia    |
| `ron97`         | RON97 petrol, all regions            |
| `diesel`        | Diesel, Peninsular Malaysia          |
| `diesel_eastmy` | Diesel, East Malaysia (Sabah/Sarawak/Labuan) |
| `budi95`        | BUDI95 subsidised petrol             |

## Running Locally

No build step required — it's a static site.

```bash
# Clone the repo
git clone https://github.com/aaronagai/my-fuel-price.git
cd my-fuel-price

# Serve locally (any static file server works)
npx serve .
# or
python3 -m http.server 8080
# then open http://localhost:8080
```

> **Note:** The app fetches from `api.data.gov.my` which is a public CORS-enabled API — no API key needed.

## Deployment

The site is deployed via **GitHub Pages** from the `main` branch root.

To deploy your own fork:
1. Fork this repo
2. Go to **Settings → Pages → Source**: `main` branch, `/ (root)`
3. Your live URL will be `https://<your-username>.github.io/my-fuel-price`

## Project Structure

```
my-fuel-price/
├── index.html   # Single HTML page
├── style.css    # Dark terminal theme styles
├── app.js       # Data fetching, rendering, charts, i18n
├── LICENSE      # MIT License
└── README.md    # This file
```

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

> Built with open government data. Free & open source forever.
> *Dibina dengan data kerajaan terbuka. Percuma & sumber terbuka selama-lamanya.*
