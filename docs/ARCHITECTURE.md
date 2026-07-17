# Architecture - Free Tier Only

## Principle: 100% free, no keys, client-friendly

No Vercel/Bluehen refs except approved Dottie CP. This stack is Workers/Pages/Supabase free, public pip, ONNX-ready. Manual CSV/upload only if needed.

## Diagram

```
User (Hill Country) --> Cloudflare Pages (frontend static)
                         |
                         +--> Leaflet map (OSM + Esri Topo + Hillshade)
                         |      + NEXRAD tiles https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png (5-min)
                         |      + County, Streams, Watersheds tiles from LCRA /tiles/*
                         |      + Drought Monitor Esri FeatureServer USDM_current (weekly)
                         |      + Soil Moisture Esri ImageServer NASA NLDAS (daily)
                         |
                         +--> Worker API (central-texas-river-pulse-api)
                                  GET /api/gauges?bbox=-101,28.5,-96,31.5&basin=guadalupe
                                  GET /api/stats
                                  GET /api/historical?site=6399&type=flow&days=7
                                  Cache API 10-min, KV optional (R2 for historical)
                                  Merges:
                                    - LCRA /api/GetDataForAllSites (406 records, 274 LCRA, rest COA/USGS/Hays/GBRA)
                                    - USGS IV bBox paramCd 00060 flow cfs, 00065 stage ft, 00045 precip in
                                    - (future) SARA direct if available via TWDB Water Data for Texas
```

## Why Worker as proxy?

- CORS: LCRA allows * but browser fetch of USGS bbox is heavy (100+ sites). Worker normalizes to `Gauge` {site_code, name, lat,lon, basin, authority, flow_cfs, stage_ft, rain_24h, temp_f, flood_stage, bankfull, safety: green/yellow/red, trend: rising/falling/stable, last_updated}
- Caching: Cache.put 600s, staggered 15-min cron trigger via `scheduled` event (requires Workers free: 1 cron allowed). Frontend also refreshes every 10 min (LCRA spec).
- No secrets: no Synoptic Labs token needed unless we pull GBRA Mesowest; LCRA already proxies GBRA.

## Point + Area combine

- Point: gauge cfs/ft every 15-min (ground truth)
- Area: satellite layers as raster tiles overlay. Future: Sentinel-1 SAR via Copernicus OData search -> COG tiles into R2, served as TileJSON.

## Storage (free)

- Historical: R2 bucket `river-pulse-raw` (optional) stores last 7 days JSON gz. Worker serves via /api/historical fallback to live LCRA historic endpoint `api/HistoricData/GetDataBySite/{site}/{type}/{start}/{end}`.
- Supabase free 500 MB if we need persistence for safety thresholds and user favs. For v0, localStorage + URL params (?lat=&lon=&zoom=&basin=&site=) like LCRA does.

## Cron

- Worker scheduled event every 15 min (or 10 min if allowed) warms cache. Frontend auto-refresh 10 min matches hydromet_analysis.md.

## Basins logic

- Basins.json defines bbox + authority for filtering. Filtering is lat/lon in bbox + authority tag. Recreation thresholds in docs/BASINS.md drive safety badge.

## Future satellite

- GEE or Planetary Computer batch jobs outside loop: compute NDWI water mask for Highland Lakes daily, store area in R2. No runtime cost.
