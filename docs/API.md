# API - Public/free endpoints we use (no key)

Based on deep dive `hydromet_analysis.md` (406 total sites via /api/GetDataForAllSites as of 2026-07-17, 274 LCRA).

## SARA-specific scraper - Medina upper + Leon + Salado + Cibolo (user requested)

SARA contracts USGS: **12 gauges and 4 monitoring stations throughout the San Antonio River managed and maintained by SARA in real time**【7259468828907274590†L139-L143】. No separate SARA API key needed — we use USGS IV by site list.

Curated list in `worker/src/sara.ts` + `frontend/src/lib/sara.ts`:
- Medina Rv At Bandera TX 08178880 - elev 1194 ft, all-time max 44,500 cfs, current sample 2,680 cfs 11.02 ft 16543% normal【7259468828907274590†L14-L16】
- Medina Rv Nr Macdona TX 08180700 - 272 cfs sample【7259468828907274590†L16-L18】
- Medina Rv Nr Von Ormy TX 08180720 - 52 cfs【7259468828907274590†L18-L20】
- Medina Rv At San Antonio TX 08181500 - 8 params: Water temp, Precip, Discharge, Gage height, Specific cond, DO, pH, Turbidity【7259468828907274590†L43-L52】
- San Antonio River at San Antonio TX 08178000 - Centennial 1915【1615332398242546218†L53-L55】
- + Leon (08181480/95), Salado (08182300/2500), Cibolo (08185000/6000), Pipe Creek 08178800

Our API adds:
```
GET /api/sara -> { count, curated: 14, gauges: [ {... tributary: Medina, sub_basin: medina-upper, sara_managed: true, turbidity_fnu }] }
GET /api/gauges?trib=Medina -> filters by tributary
GET /api/gauges?basin=san-antonio -> all SARA basin incl Medina upper
```

Implementation free: `fetchSARA()` hits `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=08178880,08180700,...&parameterCd=00060,00065,00045,00010,63680`

## LCRA Hydromet (unauthenticated JSON, works via curl)

Base: https://hydromet.lcra.org

All return JSON `Content-Type: application/json`. No rate limit observed. CORS allows browser but better via Worker proxy.

| Endpoint | Returns | Notes |
| --- | --- | --- |
| `/api/GetDataForAllSites` | array of sites with rainfallRecent, rainfall30Minute, rainfall1Hour, rainfall2Hour, rainfall3Hour, rainfall6Hour, rainfall12Hour, rainfallSinceMidnight, rainfall24Hour, rainfall48Hour, rainfall3Day, rainfall7Day etc (inches), stage ft, flow cfs, temperature °F, relativeHumidity %, batteryVoltage V, floodStage ft, bankfullStage ft, head/tail elevation ft MSL, siteType river|rain|lake|dam, agency LCRA/COA/USGS/Hays/GBRA, lat/lon, nwsid | **Primary for map** |
| `/api/GetRainfallForAllSites` | siteNumber, location, reservoir, dateTime, count, rain, rainToday, rain1Hr/3/6/24 | rain table |
| `/api/GetStageFlowForAllSites` | siteNumber, location, dateTime, stage 3.31, flow 134, bankfull 24, floodStage 26 | stage/flow |
| `/api/GetLakeLevelsForAllSites` | siteNumber, location, dateTime, elevation ft MSL | lakes |
| `/api/GetHighlandLakesSummary` | lake name Austin etc headElevation tailElevation | ops |
| `/api/GetTemperaturesForAllSites` | siteNumber, siteName, dateTime, minTemp, maxTemp, currentTemp °F conversion C*1.8+32 in JS | temp |
| `/api/GetHumidityForAllSites` | humidity | |
| `/api/GetConductivityDataForAllSites` | cond | |
| `/api/GetWaterTemperaturesForAllSites` | wtemp | |
| `/api/GetCurrentUSGSData` | LCRA's copy of USGS sites stage/flow | |
| `/api/GetSitesBySensorType/{type}` | types: `Stage`, `Flow`, `rain`, `lakelevel`, `temp`, `tempstats`, `humidity`, `wind`, `conductivity`, `wtemp`, `batteryVoltage` | for filtering |
| `/api/GetDataBySite/{siteNumber}/{type}` | siteId, bankFull, floodStage, value1Type Stage value2Type Flow, records[] {dateTime ISO Z, value1, value2} | chart |
| `/api/HistoricData/GetDataBySite/{site}/{type}/{startDate yyyy-MM-dd}/{endDate}/{?hourly}` | historical, default last 179 days UI default 2 weeks max chart | history |
| COA variants | `/api/Coa/GetSitesBySensorType`, `/api/CoaHistoricalData/GetDataBySite` | City of Austin |
| Hays/GBRA | `/api/Hays/GetDataForHaysSites`, `/api/Gbra/GetDataForGbraSites` (GBRA uses Synoptic Labs Mesowest token inside LCRA proxy) | county/GBRA |

Tiles (free):
- `/tiles/CountyBoundaries/L0{z}/R{y}/C{x}.png`
- `/tiles/streams/_alllayers/L0{z}/R{y}/C{x}.png`
- `/tiles/watersheds/_alllayers/...`
- `/tiles/watershedsline/_alllayers/...`
- Radar: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png?t=epoch` (IEM, 5-min)
- Radar loop frames: m05m...m50m animated
- Drought Monitor: `https://services5.arcgis.com/0OTVzJS4K09zlixn/arcgis/rest/services/USDM_current/FeatureServer/0/`
- Soil Moisture: `https://securegis.lcra.org/image/rest/services/Imagery/Soil_Moisture/ImageServer`
- Basemap Topo: ArcGIS Topographic VectorTileLayer `7dc6cea0b1764a1f9af2e679f642f0f5` + World Hillshade

## USGS Water Services (free, no key, canonical)

Docs: `https://waterservices.usgs.gov/`

We use Instantaneous Values (IV) for real-time:

```
https://waterservices.usgs.gov/nwis/iv/?format=json
&bBox=-101,28.5,-96,31.5
&parameterCd=00060,00065,00045,00010
&siteStatus=active
```

- `00060` Discharge cfs
- `00065` Gage height ft
- `00045` Precip inches
- `00010` Water temp C (convert)
- `bBox` LonLat: -101 West, 28.5 South, -96 East, 31.5 North central TX

Returns TimeSeries with values array. We parse to same Gauge shape.

Optional: `https://waterservices.usgs.gov/nwis/dv/?format=json&bBox=...&parameterCd=00060&statCd=00003` for daily mean.

## TWDB / SARA / GBRA

- Water Data for Texas reservoirs statewide: `https://waterdatafortexas.org/reservoirs/statewide` (has API behind, but not official)
- TexMesonet: `https://www.texmesonet.org/viewer`
- SARA now covered via curated list in `sara.ts` + `/api/sara`.
- GBRA: via Synoptic Labs `api.synopticlabs.org` with token, but LCRA already proxies GBRA in GetDataForAllSites as agency GBRA.

## Community wrappers

- `lancereinsmith/lcra` Python: `pip install lcra`, CLI `lcra get --report flood` etc, FastAPI /docs
- Example Python: `from lcra import HydrometClient; client.get_rainfall()`

## Our Worker normalization

GET /api/gauges -> merges both sources dedup by lat/lon ~0.001 deg, prefers USGS for stage/flow if both exist, keeps LCRA extras (bankfull, floodStage, battery, rainfall variants). Returns:

```json
{
  "gauges": [
    {
      "site_code": "6399",
      "name": "Colorado River near Garwood",
      "lat": 29.515,
      "lon": -96.409,
      "agency": "LCRA",
      "authority": "LCRA",
      "basin": "colorado",
      "site_type": "river",
      "flow_cfs": 134,
      "stage_ft": 3.31,
      "flood_stage_ft": 26,
      "bankfull_ft": 24,
      "rain_24h_in": 0.63,
      "temp_f": null,
      "humidity_pct": 80.72,
      "safety": "green",
      "trend": "stable",
      "last_updated": "2026-07-17T19:40:00Z",
      "stale": false
    }
  ],
  "count": 406,
  "sources": ["LCRA GetDataForAllSites", "USGS IV bbox"],
  "cached_at": "..."
}
```

GET /api/stats -> counts by safety/basin/agency
GET /api/historical?site=6399&type=flow&days=7 -> proxies LCRA HistoricData
GET /api/sara -> SARA upper-basin curated gauges
