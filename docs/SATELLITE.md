# Satellite Data - How it Helps River Authorities (Central Texas focus)

## Point vs Area problem
- Point (Hydromet/USGS): perfect accuracy at a post, every 15 min, but only where a $20k gauge exists. Texas has 80k river miles, ~850 USGS stations statewide, gaps huge.
- Area (Satellite): covers everywhere, every 5 days to daily, but needs ground truth calibration.

Combine: your 406 LCRA sites calibrate satellite turbidity/flood models, making them trustworthy for entire basin.

## Sensors that matter for Central TX (all free)

### 1. Sentinel-1 SAR (Synthetic Aperture Radar) - Flood extent through clouds
- Spec: C-band SAR, IW mode 250 km swath, 10m resolution, VV+VH dual pol, revisit 6-12 days globally, via Copernicus Dataspace free Open Access Hub.
- Why TX: Hill Country flash floods happen under thunderstorm cloud. Optical fails. SAR sees water via specular reflection (dark) vs land bright.
- Texas proven: Studies show >94% accurate flood mapping in SE TX Tropical Storm Imelda (4 counties Orange, Jefferson, Chambers, Galveston) using pre-flood 7 Sep 2019 vs during 19 Sep 2019. Same for Hurricane Harvey Houston.
- Workflow: SNAP preprocessing: Radiometric Calibration -> Speckle Filter (Lee) -> Terrain Correction SRTM DEM -> Band VH/VV ratio -> change detection. Output GeoTIFF flood extent.
- Free API: https://dataspace.copernicus.eu/ OData search, S3 eodata Sentinel-1 GRD.
- Integration idea: Worker cron queries Sentinel-1 over bbox lat 28.5-31.5 lon -101 to -96 for last 24h, pushes flood polygon to frontend as GeoJSON overlay.

### 2. NASA SWOT (Surface Water and Ocean Topography) - River height from space
- Launched Dec 16 2022, Ka-band Radar Interferometer KaRIn.
- What: measures water surface elevation (WSE), width, slope, storage change for rivers >100m wide, lakes >250m.
- Revisit: 21-day cycle global, ~10 days over US.
- Central TX example: Paper Jan 25 2024: SWOT caught 30-ft tall, 166-mile long flood wave on Colorado River south of Austin, tracked 250 miles at 3.5 ft/s to Matagorda Bay. Largest flood of year on that reach. Showed wave shape, speed, risk to infrastructure. Reference Virginia Tech study. This is point+area combine in action.
- Products: L2_HR_RiverSP vector (reach/node), L2_HR_PIXC point cloud. Access via NASA Earthdata / PO.DAAC (https://podaac.jpl.nasa.gov/dataset/SWOT_L2_HR_RiverSP_reach_D). Free.
- For us: fill ungauged reaches between LCRA gauges (e.g., Colorado between Bastrop and Garwood). Provide baseflow trend.

### 3. Sentinel-2 MSI + Landsat 8/9 OLI - Water extent, turbidity, chlorophyll, temp
- Spec: Sentinel-2: 5-day revisit, 10m visible/20m red edge/NIR, free via Copernicus + Planetary Computer.
- Indices:
  - NDWI = (Green - NIR)/(Green+NIR) for water mask
  - MNDWI for turbid water
  - NDCI for chlorophyll-a (red edge)
  - Turbidity model using red band reflectance: many papers use S2 red band calibrated with in situ NTU, R² 0.88 in flooded forests.
- Matagorda Bay example: study used Landsat-8 + empirical ML models for chlorophyll-a, salinity, turbidity 2014-2023.
- For Central TX: 
  - Reservoir area -> volume: Lake Travis, Buchanan, Canyon Lake. JRC Global Surface Water dataset baseline + recent S2.
  - Water quality: LCRA Clean Rivers Program monitors but monthly; satellite daily flags algal blooms in Lake Austin, Guadalupe below Canyon.
  - NDVI/NDWI riparian health: drought stress in Pedernales watershed.

### 4. Precipitation & Soil - Why it flooded here
- GOES-16 ABI + GPM IMERG: half-hourly precip 10km, free via NASA GIBS WMTS.
- Iowa Mesonet NEXRAD tiles we already use (5-min) are radar ground-based, but satellite QPE fills radar gaps.
- Soil moisture: NASA NLDAS Noah 0-10cm daily (Esri ImageServer LCRA uses), SMAP 9km.
- ET: OpenET (Landsat-based evapotranspiration) for irrigation.

### 5. Thermal & other

- ECOSTRESS on ISS: 70m LST evapotranspiration, free, for farm water use.
- VIIRS Night lights impervious surface change -> runoff modeling.

## How to implement free tier

- Copernicus Dataspace: S1 GRD via OData, no key for search, need account for download (free). Use `sentinelsat` Python or node fetch to query.
- Planetary Computer: STAC API `https://planetarycomputer.microsoft.com/api/stac/v1/search` collections sentinel-2-l2a, landsat-c2-l2. Free, anonymous, returns COG URLs.
- NASA Earthdata: token via earthdata login (free) for SWOT.
- GIBS: WMTS tiles `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/GoogleMapsCompatible_Level{...}/{z}/{y}/{x}.png` no key.

Frontend toggles become TileLayers with opacity 0.6 like LCRA does.

## Safety upgrade examples

- FloodPulse: point gauge rising + upstream Sentinel-1 flood polygon + NEXRAD heavy rain past 3h = red badge "flash flood likely downstream"
- Reservoir Board: Lake Travis area from S2 NDWI vs full pool, compute % full, show to public daily.
- Conservation: Turbidity spike after 2" rain = "avoid contact recreation" yellow.

Future: train tiny ConvNeXt-T model on-device to classify gauge vs satellite water extent discrepancy (Ava AGI Factory style) — ExecuTorch friendly.

## Costs

- All listed are free tier, public domain. Copernicus 500GB quota, Planetary Computer free, GIBS free, USGS free.
- No Planet Labs required.

## References for docs

- SWOT Colorado River Jan 2024 Texas 166-mile wave paper: NASA JPL May 2025.
- Sentinel-1 flood detection Harvey Houston MDPI Remote Sensing.
- Sentinel-1 Imelda SE TX 94% ML method.
- Landsat-8 Matagorda Bay WQI empirical+ML 2023.
