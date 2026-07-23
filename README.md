# Central Texas River Pulse

> Solo personal project, no connection to employer, built with public/free-tier only. Data is public, automatically retrieved and subject to revision.

Free-tier, real-time river conditions hub for Central Texas basins — Colorado (Highland Lakes to Matagorda), Llano, Pedernales, Guadalupe, Comal, San Marcos, San Antonio, and lower Brazos. Coverage box: lat 28.5–31.5, lon -101 to -96.

Merges point data (LCRA Hydromet sites + USGS Water Services) with area data (NEXRAD radar mosaic, drought and soil-moisture layers) into one normalized JSON and one map.

### Why this exists

LCRA Hydromet covers hundreds of gauges with 15-minute updates (streamflow, stage, rainfall, temperature), but it is Lower Colorado only. Texas river authorities each publish through their own separate sites, with no unified real-time layer for the region.

This repo is the aggregator: one normalized JSON, one map, zero paid APIs.

### Basins covered (see `docs/BASINS.md`)

| Basin | Authority | Key tributaries | Tubing / Safety note |
| --- | --- | --- | --- |
| Colorado | LCRA | Llano, Pedernales, Barton Ck | Highland Lakes chain |
| Guadalupe | GBRA + Upper Guadalupe | Comal, San Marcos | Comal >250cfs caution, >2500 red |
| San Antonio | SARA + GBRA | Medina, Cibolo, Salado | Missions reach + low-water crossings |
| Brazos (lower) | BRA | Navasota | floodplain farming |
| Nueces/Matagorda fringe | LNRA, others | - | coastal surge |

### Quickstart

```bash
git clone https://github.com/jcdavis131/central-texas-river-pulse
cd central-texas-river-pulse
bun install   # or npm install
# frontend
cd frontend
bun install
bun run dev    # vite :5173

# worker (Cloudflare)
cd ../worker
bun install
bun run dev    # wrangler :8787

# scripts demo (no keys needed)
node ../scripts/fetch_lcra.js
node ../scripts/fetch_usgs.js
```

Env: none required. Worker uses Cache API 10-min, CORS open.

### Architecture

```
frontend (Vite React + Leaflet/MapLibre)
   ├─> /api/gauges  ──> worker (Cloudflare)
   │                     ├─ fetch LCRA /api/GetDataForAllSites (406 sites, 274 LCRA)
   │                     └─ fetch USGS IV bbox TX: lat 28.5-31.5 lon -101 to -96 param 00060,00065,00045
   └─> tiles: OSM + Esri Topo + IEM NEXRAD tiles
```

Free-tier: Workers free plan (100k req/day), Pages free, R2 10GB free, client fetch. No secrets.

See `docs/ARCHITECTURE.md` for diagram + cron.

### Data sources (free, no key)

| Source | Endpoint | What | Update |
| --- | --- | --- | --- |
| LCRA Hydromet | `https://hydromet.lcra.org/api/GetDataForAllSites` | 406 sites merged LCRA/COA/USGS/Hays/GBRA stage, flow, rain, temp, battery | 15-min obs, 10-min frontend refresh |
| LCRA Rainfall | `/api/GetRainfallForAllSites` | rain recent/30m/1h/today etc | 15-min |
| LCRA StageFlow | `/api/GetStageFlowForAllSites` | stage, flow, bankfull, floodStage | 15-min |
| LCRA Lakes | `/api/GetLakeLevelsForAllSites`, `GetHighlandLakesSummary` | head/tail elev ft MSL | 15-min |
| USGS Water Services IV | `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=-101,28.5,-96,31.5&parameterCd=00060,00065,00045&siteStatus=active` | flow cfs 00060, stage ft 00065, precip 00045 | 15-min |
| NEXRAD Radar | `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png` | radar mosaic | 5-min |
| Drought Monitor | Esri FeatureServer USDM_current | drought polygons | weekly |
| Soil Moisture | Esri ImageServer NASA NLDAS | 0-10cm vol water content m³/m³ | daily |

See `docs/API.md` for full list and community lib `lancereinsmith/lcra`.

### Satellite - future layer (see `docs/SATELLITE.md`)

Planned, not yet implemented: Sentinel-1 SAR flood extent, NASA SWOT river height/width, Sentinel-2/Landsat water indices, and GOES-16/GPM IMERG precipitation for gauge gaps.

### Design notes

- AAA contrast, Okabe-Ito safe palette: #0072B2 blue flow, #D55E00 orange alert, #009E73 green safe, #E69F00 yellow caution
- 18px/1.65 readability, 56px bottom tabs
- Mobile-first bottom sheet for gauge, not modal

### Disclaimer

Solo project. Not affiliated with LCRA, GBRA, SARA, BRA, USGS, TWDB. Data is public, auto-retrieved, subject to revision. Follow official NWS flood warnings for life-safety.

MIT License.

### Deploy

```bash
# Cloudflare Pages (frontend)
bun run build
npx wrangler pages deploy frontend/dist

# Worker
cd worker && npx wrangler deploy
```

Deploys are run manually with the commands above. CI currently runs lint only (`.github/workflows/lint.yml`).
