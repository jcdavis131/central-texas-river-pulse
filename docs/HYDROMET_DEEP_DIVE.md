# LCRA Hydromet - Deep Dive for Web App Design

Date analyzed: 2026-07-17 (live site https://hydromet.lcra.org/#)
Counts observed: 406 total sites via API, 274 LCRA, rest COA/USGS/Hays/GBRA

## 1. Hydromet Data Types (dropdowns)

On main map page (#) there are two selectors:

**Map View (8 preset extents):**
- Lower Colorado River basin (default)
- Upper northeast basin
- Upper southwest basin
- Highland Lakes area
- Expanded Highland Lakes area
- City of Austin (COA)
- Lower basin
- Matagorda Bay

**Hydromet Data dropdown - grouped:**

- *Streamflow (including stage)*
  - Streamflow (cfs, default) -> shows streamflow values + flood stage coloring
  - River stage (feet)

- *Lake levels*
  - Lake levels (feet above MSL, 2 types: official dam site vs lake site)

- *Rainfall* (27 variants):
  - Rainfall - most recent (inches, most recent tip)
  - Rainfall - past 30 minutes, past hour, past 2 hours, past 3 hours, past 6 hours, past 12 hours, since midnight, past 24 hours, past 48 hours, past 3 days, past 4 days, past 5 days, past week, past 2 weeks,
  - Monthly rollups: Rainfall - April/May/June/July 2026 (dynamic current month naming), Rainfall - this year (2026), previous year (2025), and also rainMonth, rainPrevMonth etc.

- *Temperature and humidity*
  - Temperature - current (°F)
  - Temperature - min - since midnight (°F)
  - Temperature - max - since midnight (°F)
  - Relative humidity (%)

- *Surface water temperature*
  - Surface water temperature (°F)

Legend mapping:
- Streamflow legend uses cfs thresholds plus Action stage, Flood stage coloring (bankfull = yellow, flood = red)
- Stage similar
- Lake: official dam site vs lake site icons
- Rain: 0 to 8+ inches scale buckets .01, .02-.1, .1-.25, .25-.5, .5-.75, .75-1, 1-1.5, 1.5-2, 2-2.5, 2.5-3, 3-4, 4-5, 5-6, 6-8, 8+ ; yearly buckets 0-4, 4-8 etc up to 56+
- Temp: -<0, 0-9,10s,20s...100s (°F)
- Soil Moisture volumetric water content m³/m³: 0-.1, .1-.2, .2-.3, .3-.4, .4-.5, .5+
- Humidity: 0-9% ... 100%
- Battery health: Low, Poor, Fair, Good, High, Extreme (volts thresholds)
- Water quality legends for DO, % saturation, conductivity etc (observed in DOM but not active unless water quality sites selected)

## 2. Map Layers

Left side Map Layers panel (leaflet with Esri basemap + hillshade + satellite toggle):

- Current radar (Iowa Environmental Mesonet / NWS NEXRAD) - image tiles from https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png?t=timestamp
- Radar loop (animated 10 frames: m05m, m10m...m50m loop every 200ms, 11 levels)
- County boundaries - tiles https://hydromet.lcra.org/tiles/CountyBoundaries/L0{z}/R{y}/C{x}.png
- Drought Monitor - Esri featureLayer https://services5.arcgis.com/0OTVzJS4K09zlixn/arcgis/rest/services/USDM_current/FeatureServer/0/ (NDMC/USDA/NOAA) opacity 0.6 categories: Abnormally dry, moderate, severe, extreme, exceptional
- Soil Moisture - Esri imageMapLayer https://securegis.lcra.org/image/rest/services/Imagery/Soil_Moisture/ImageServer opacity 0.6, daily NLDAS-NOAH 0-10cm
- Streams overlay - tiles https://hydromet.lcra.org/tiles/streams/_alllayers/L0{z}/R{y}/C{x}.png
- Watersheds + Watershed Lines - tiles watersheds/_alllayers and watershedsline

Basemap toggle:
- Map (ArcGIS Topographic VectorTileLayer id 7dc6cea0b1764a1f9af2e679f642f0f5) + Hillshade Elevation/World_Hillshade
- Satellite (Esri World_Imagery)

Additional controls:
- Zoom in/out
- Zoom to location (navigator.geolocation)
- Save map state (localStorage: lat, lon, zoom, ddl, radar, radarLoop, counties, drought, soilMoisture, streams, watersheds, watershedLinesOnly, siteNumber, agency)
- Clear map state, Share map state (clipboard URL with query params: ?lat=&lon=&zoom=&ddl=&radar=&...&siteNumber=&agency=)
- Sort gauge dropdown alphabetically vs upstream->downstream (LCRA default sorted by agency then siteNumber ~ upstream to downstream)

Agencies visibility: LCRA, USGS, COA, Hays, GBRA, ALL combinations (LCRA-COA, LCRA-USGS etc). Tooltip shows agency+site number+stale flag.

## 3. Gauge Station Data Cards (click marker)

Example 1: LCRA - Colorado River near Garwood (site 6399) Agency LCRA, siteNumber 6399, siteType river, lat 29.51516 lon -96.40883
Popup on click opens bottom iframe card with:

- Header: Agency - SiteName (linked)
- Controls: Pop Out (opens new window charts), Refresh (reload iframe), Zoom to Site (setView 12), Close
- Time range combo: Past Hour, Past 3 Hours, Past 6 Hours, Past 12 Hours, Past 24 Hours, Past 48 Hours, Past 3 Days, Past 4 Days, Past 5 Days, Past 6 Days, Past Week (selected default), Past 8 Days... Past 13 Days, Past 2 Weeks
- Chart: BillBoard.js / D3 area chart? Two charts: Stage (ft) area chart with Action/Flood Stage lines, and Flow (cfs) line chart if applicable. If stage only gauge, shows message: "This gauge measures river stage only; streamflow is not calculated"
- Table: Date - Time (format M/D/YY h:mm A), Stage (feet, e.g. 135.79), Flow (cfs or empty). Example row: "7/17/26 2:40 PM | 135.80 | ". Values update every 15 min typical (checked: 15 min intervals).
- Underlying data via api/GetDataBySite/{siteNumber}/{siteType} -> returns bankFullStage, floodStage, lakeOperatingRange, value1Type, value2Type, records array with dateTime ISO Z, value1, value2.

Marker tooltip on hover shows big table:
- b SiteName, Site number, Data Time: M/D/YYYY h:mm A (local)
- Stale flag if >1hr: "Last reading was more than one hour ago"
- Fields if present: Water temperature F, Streamflow cfs, Velocity ft/s, River stage feet, Lake level feet (formatted 0,0.00), Stage feet (COA), Action stage feet, Flood stage feet, Rainfall most recent/past hour/2h/3h/6h/12h/since midnight/past 24h/48h/3d/4d/5d/week/2weeks/30days/this month/this year inches, Temperature current F, Relative humidity %, Battery Voltage.

Example 2: COA gauge Teri Road near Nuckols Crossing (120) - rainfall site, stage 0.06 ft, rainfall fields all variants.

Example 3: Temperature gauge Mullin 5 NE (1397) - temp 74.8 F, minTemp 73.3, max 75, humidity 99.78%, battery 12.67V, rain fields.

Other agencies: USGS sites show stage+flow, e.g., Barton Ck at SH 71 nr Oak Hill (stage etc). Hays/GBRA uses same UI but Hays rain/flow simplified.

## 4. Links Section (top nav)

Dropdown Links contains:

- Flood Operations Report -> https://floodstatus.lcra.org/ or https://hydromet.lcra.org/floodstatus/ + https://hydromet.lcra.org/floodstatus/#rlevels
- River Operations Report -> https://hydromet.lcra.org/riverreport/
- ATXFloods -> https://www.atxfloods.com/
- Historical data by gauge -> /HistoricalData
- COA Historical data by gauge -> /HistoricalData/Coa
- Historical lake levels PDF -> https://www.lcra.org/download/Historical_Lake_levels.pdf/?wpdmdl=21289
- Hydromet FAQ -> /Faq
- River levels and forecasts -> https://floodstatus.lcra.org/#rlevels (same as flood)
- TWDB Texas Reservoirs -> https://waterdatafortexas.org/reservoirs/statewide
- TWDB TexMesonet -> https://www.texmesonet.org/viewer
- USGS Texas Water Dashboard -> https://txpub.usgs.gov/txwaterdashboard/
- Water glossary -> https://www.lcra.org/water/water-glossary/
- Water quality data -> http://waterquality.lcra.org
- Weather forecast -> https://www.lcra.org/news/bob-rose-on-the-weather/
- Contact us -> https://www.lcra.org/contact-us/

## 5. Reports pages (other endpoints)

Base /Reports landing with expandable tabs: River Operations, Lake Data, Rainfall Data, Stage/Flow, Meteorological, Water Quality.

Resolved report URLs found via href extraction:

- /Reports/Conductivity -> api/GetConductivityDataForAllSites
- /Reports/DailyRainfall -> rainfall daily?
- /Reports/HighlandLakesSummary -> api/GetHighlandLakesSummary (lake summary: siteNumber, lake name Austin etc, headElevation, tailElevation)
- /Reports/Humidity -> api/GetHumidityForAllSites
- /Reports/LakeLevel -> api/GetLakeLevelsForAllSites (siteNumber, location, dateTime, elevation)
- /Reports/Rainfall -> api/GetRainfallForAllSites (siteNumber, location, reservoir, dateTime, count, rain, rainToday, rain1Hr, rain3Hr, rain6Hr, rain24Hr)
- /Reports/RainfallCoa, /Reports/RainfallUsgs, /Reports/RainfallSummary (same rainfall underlying)
- /Reports/RiverStageFlow -> api/GetStageFlowForAllSites (siteNumber, location, dateTime, stage, flow, bankfull, floodStage)
- /Reports/Temperature -> api/GetTemperaturesForAllSites (siteNumber, siteName, dateTime, minTemp, maxTemp, avgTemp, currentTemp)
- /Reports/USGS -> api/GetCurrentUSGSData (siteNumber, dateTime, siteName, lat/lon, siteType, stage, flow, flag)
- /Reports/WaterTemperature -> api/GetWaterTemperaturesForAllSites

All reports pages have:
- Refresh Data link (calls getNewData)
- Export To Excel button (client-side CSV generation via Utils.exportToCsv -> Blob text/csv) Filename pattern: <siteName>_<type>.csv or report + timestamp
- Column headers sortable (click)
- Date textbox if applicable (daily report)

HistoricalData pages:

- /HistoricalData -> UI with left list of sites filtered by sensor type, right details
- Data types buttons: All Data, Hourly Data toggle + Rainfall, Daily Rain, Stage/Flow, Lake Level, Temperature, Min Max Avg Temp, Humidity, Wind, Conductivity, Water Temperature, Battery (if AquaRio mode)
- Date range pickers: StartingDate, EndingDate default last 180 days (30 days? 2e4? code shows t.setDate(t.getDate()-179) ~ 179 days; AquaRio 20k days)
- APIs:
  - api/GetSitesBySensorType/{sensorType} where sensorType in [Stage, Flow, rain, lakelevel, temp, tempstats, humidity, wind, conductivity, wtemp, batteryVoltage, BatteryVoltageBackup etc]
  - api/HistoricData/GetDataBySite/{siteNumber}/{sensorType}/{startDate}/{endDate}[/hourly] returns siteId, siteNumber, siteName, bankFullStage, floodStage, isHourly, isDaily, value1Type (e.g., Stage, PC, TEMP), value2Type (Flow, TDS, Rhumid), records:[{dateTime ISO Z, value1, value2, value3, justBeforeMidnight bool}
  - COA variant: api/Coa/GetSitesBySensorType/{type} and api/CoaHistoricalData/GetDataBySite/
- Export to CSV same mechanism.

Gauge Data List: /Home/GaugeDataList/?siteNumber=1199&siteType=flow - tabular view of all gauges for current type with sortable columns.

Charts direct: /Charts/?siteNumber=6399&siteType=flow&agency=LCRA - ChartTimeSelection cookie chartTime default 7 days, uses Billboard.js, data from GetDataBySite etc. Options: flow, stage, lakelevel, rain, temp, humidity, wtemp, batteryVoltage, AFM, AFMIQ, backup, Satellitestage, Iridiumstage.

Additional endpoints seen in JS:
- api/GetDataForAllSites (main map) -> includes all sensors combined
- api/Hays/GetDataForHaysSites, api/Gbra/GetDataForGbraSites (GBRA uses Mesowest API via synopticlabs with token mesowestToken), api/GetCurrentAFMData (AFM flow/velocity)
- api/GetDataBySite/{site}/ {type}
- api/GetUSGSDataBySite/{site}/{type}
- api/Coa/GetDataBySite/{site}/{type}
- api/Hays/GetDataBySite/{site}/{type}
- Esri tokens: apiKey AAPK05ff756b... etc for basemap

Tile endpoints: /tiles/watersheds, watershedsline, streams, CountyBoundaries

No /api swagger page - hitting /api returns 405 but GET subroutes work. No /data or /report lowercase - returns 404 chrome-error. Correct paths are /Reports/* and /HistoricalData.

## 6. Public API, CSV, JSON status

**No officially documented public API**, but frontend uses unauthenticated JSON APIs under /api/* returning JSON (Content-Type application/json). These are accessible cross-origin? CORS headers allow https://www.lcra.org private network.

Observed APIs returning JSON arrays, working via curl:

- https://hydromet.lcra.org/api/GetDataForAllSites (406 records)
- https://hydromet.lcra.org/api/GetRainfallForAllSites
- https://hydromet.lcra.org/api/GetStageFlowForAllSites
- https://hydromet.lcra.org/api/GetLakeLevelsForAllSites
- https://hydromet.lcra.org/api/GetTemperaturesForAllSites
- https://hydromet.lcra.org/api/GetHumidityForAllSites
- https://hydromet.lcra.org/api/GetConductivityDataForAllSites
- https://hydromet.lcra.org/api/GetWaterTemperaturesForAllSites
- https://hydromet.lcra.org/api/GetHighlandLakesSummary
- https://hydromet.lcra.org/api/GetCurrentUSGSData
- https://hydromet.lcra.org/api/GetSitesBySensorType/{type}
- https://hydromet.lcra.org/api/GetDataBySite/{site}/{type}
- https://hydromet.lcra.org/api/GetUSGSDataBySite/{site}/{type}
- https://hydromet.lcra.org/api/HistoricData/GetDataBySite/{site}/{type}/{start}/{end}[/hourly]
- etc.

No rate limiting observed, returns 200 quickly.

CSV export: not server-side CSV, client-side generation from current in-memory records via JS blob. But you can easily build CSV by calling JSON APIs and converting.

Community ecosystem:
- GitHub lancereinsmith/lcra Python library wraps Flood Operations Report (likely https://floodstatus.lcra.org) and lake levels etc. Uses scraper + Pydantic + FastAPI. Provides CLI `lcra get --report`, `lcra serve` for local REST API with /docs swagger. Good reference for building wrapper.
- Other: lcra App Streamlit for soil data (soilmoisture).

Texas river authorities pattern:
- LCRA Hydromet uses custom tiles + Esri + Mesonet radar
- GBRA (Guadalupe-Blanco) data pulled via Synoptic Labs API (Mesowest) token, not direct
- Hays County uses Hays API
- TWDB, USGS provide separate APIs (waterdatafortexas, USGS Water Services https://waterservices.usgs.gov)
- No unified Texas Hydromet API, each RA has own system but similar tile approach.

## 7. Fields, Units, Update Frequency

**Units:**
- Stage / River stage / Lake elevation: feet (sometimes stage feet above datum, lake feet above MSL)
- Flow / Streamflow: cubic feet per second (cfs)
- Rainfall: inches (count plus rainfall fields are cumulative inches)
- Temperature: °F (API temp fields converted from C via *1.8+32 in JS)
- Relative humidity: % (rounded)
- Velocity: ft/s
- BatteryVoltage: volts (e.g., 13.6)
- Conductivity: ? uS/cm? plus Total Dissolved Solids
- Water temperature: °F
- Soil moisture: Volumetric water content m³/m³
- Wind speed mph + direction degrees azimuth (historical)
- Action stage, Flood stage: feet (thresholds)
- Storage: acre-feet (a-f)

**Exact JSON field samples:**

GetDataForAllSites COA example:
```
{
 siteNumber: "120", dateTime: "2026-07-17T14:45:28Z", zoomLevel:"9", agency:"COA",
 siteName:"Teri Road near Nuckols Crossing", latitude:"30.194926", longitude:"-97.737387",
 siteType:"river", rainfallRecent:"0.00", rainfall30Minute..., rainfallYear etc,
 stage:"0.06", batteryVoltage:"13.60", nwsid:"TNCT2"
}
```

LCRA rain site:
```
siteNumber "1397", siteName "Mullin 5 NE", temperature "74.80", rainfall fields, minimumTemperature, maximumTemperature, relativeHumidity, batteryVoltage, nwsid
```

LCRA river site Garwood:
```
siteNumber "6399", siteName "Colorado River near Garwood", stage "135.79", relativeHumidity "80.72"
```

GetRainfallForAllSites:
```
siteNumber 1090, location "Millersview 7 WSW", reservoir "Buchanan", dateTime ISO, count 69.93, rain 0.04, rainToday 0.63, rain1Hr 0.11 etc
```

GetStageFlow:
```
siteNumber 1199, location "Colorado River at Winchell", dateTime, stage 3.31, flow 134, bankfull 24, floodStage 26
```

GetDataBySite historic:
```
siteId, siteNumber, siteName, bankFullStage, floodStage, isHourly bool, value1Type "Stage", value2Type "Flow", records[{dateTime, value1, value2, value3}]
```

**Update frequency:**
- Main Hydromet data: Every 15 minutes typical (observations timestamp every 15 min, some 5? Example shows 15). Frontend auto refresh every 600000 ms = 10 minutes (setInterval getNewData). Says "Last update: 2:52 p.m." and "Page also automatically retrieves new data every 10 minutes."
- Radar: Iowa Mesonet every 5 minutes, radarTime overlay, radar refresh interval 300000 ms = 5 min
- Soil Moisture: daily from NASA NLDAS-NOAH Land Surface model (shows SoilMoistureDate)
- Drought Monitor: weekly? Source NDMC, but fetched as Esri featureLayer
- HistoricalData: query range up to 179 days back (default), up to 20k for AquaRio internal?
- Charts time selection up to 2 weeks back (client filters by dateOffset)

## 8. Design Recommendations for Web App

- Use underlying /api/GetDataForAllSites as primary real-time feed (406 sites) polling every 10 min; cache in backend to avoid hammering.
- For historical charts, use /api/HistoricData/GetDataBySite with date params; offer hourly aggregation option.
- Build abstraction layer mapping Hydromet Data dropdown values to sensor types:
  - Streamflow -> flow with value2Type Flow, but show stage thresholds coloring
  - River stage -> stage
  - Lake levels -> lakelevel + dam handling
  - Rainfall variants -> map to rain fields: most recent = rainfallRecent / rain, past 30 min = rainfall30Minute etc. Better to use rainfall1Hour, rainfall2Hours etc from GetDataForAllSites for map, or GetRainfallForAllSites for table.
  - Temp -> temperature, mintemp/max etc from temperature API or field.
- Map: replicate using Leaflet + Esri basemap (ArcGIS Topographic token) + tile layers for streams/watersheds/county. Radar optional via Mesonet. Use same styling classes for markers: temp10, rain1x5 etc defined in CSS aquario.min.css (check that file for color codes).
- Marker clustering? Current uses individual markers with offset for USGS vs LCRA overlap (longitude - g).
- Provide export: server-side CSV from JSON for better UX than client blob.
- Consider Pydantic models like lancereinsmith lib does, with validation.
- Error handling: staleData flag ( >1 hr old ), disclaimer flag "*", NA handling, siteType AFM special case.
- Agencies: support filter for ALL, LCRA, COA, USGS, Hays, GBRA. Keep upstream->downstream sort default but allow alphabetical.
- Features for app:
  - Flood alert: if currentValue >= bankfull => Action, >= floodStage => Flood
  - Lake levels: head vs tail elevation for dam sites
  - Battery health overlay for maintenance view (internal AquaRio true adds battery)
  - Soil moisture + drought overlay toggles as separate map layers using Esri ImageMapLayer
  - Shareable URL state like original

- Legal: Data auto retrieved subject to revision, include disclaimer.

## 9. Screenshots captured

- Map view with markers: /home/hatch/workspace/.hatch-browser/snapshots/.../20260717T145216.../screenshot.png (initial)
- After closing modal: ...145250... screenshot
- Clicked gauge Garwood: ...145304... screenshot
- Rainfall Report table: ...145432... screenshot
- HistoricalData page: ...145510... screenshot
- Charts page Garwood flow: ...145552... screenshot
- GaugeDataList page: ...145626... screenshot
- Main map after return: ...145649... screenshot

