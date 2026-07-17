# Central Texas Basins

Central TX bbox: lat 28.5–31.5, lon -101 to -96. Includes all tributaries where Hill Country meets coastal plain.

## 1. Colorado River Basin - LCRA

Authority: Lower Colorado River Authority (LCRA) + Upper Colorado + Central. 600+ miles, 280+ LCRA gauges alone.

- Headwaters: Colorado River at Winchell (site 1199 example stage 2.5 ft flow 7 cfs) up to San Saba, Llano
- Major tribs: San Saba River, Llano River (North Llano near Roosevelt, South Llano at Telegraph, Llano near Junction/Mason/Llano), Pedernales River (near Fredericksburg, LBJ Ranch near Stonewall 12.5 ft example, Johnson City), Onion Creek, Barton Creek, Bull Creek (ATX flood prone)
- Highland Lakes chain: Buchanan, Inks, LBJ, Marble Falls, Travis, Austin, Lady Bird, Bastrop. Head/tail elevations from GetHighlandLakesSummary.
- Lower: Bastrop, La Grange, Columbus, Wharton, Garwood (site 6399 stage 135.79 ft example), Matagorda Bay outflow
- Management: flood ops via floodstatus.lcra.org, drought management

Safety thresholds (from LCRA + local knowledge):
- Tubing Barton Springs pool: N/A but creek >200 cfs danger
- Highland Lakes: LCRA defines Action stage (yellow) = bankfull, Flood stage (red) = overbank

## 2. Guadalupe River Basin - GBRA + Upper Guadalupe + Hays County

Authority: Guadalupe-Blanco River Authority (GBRA), Upper Guadalupe River Authority, Hays County co.

- Headwaters: North Fork + South Fork Guadalupe near Kerrville, Johnson Creek
- Mid: Guadalupe at Kerrville, Center Point, Spring Branch, Sattler/Canyon Lake inflow, above Comal confluence
- Key rec: Comal River New Braunfels (shortest river in Texas, tubed heavily) - 300-500 cfs safe green, 500-1500 yellow caution, >1500 red avoid (city closes)
- San Marcos River: from Aquarena Springs, tubed, similar thresholds ~500-1500
- Lower: Guadalupe at Gonzales, Cuero, Victoria, Tivoli to San Antonio Bay

## 3. San Antonio River Basin - SARA + GBRA (with upper-basin scraper)

Authority: San Antonio River Authority (SARA) - focus requested. **SARA contracts USGS: 12 gauges + 4 monitoring stations managed and maintained by SARA in real time**【7259468828907274590†L139-L143】.

### SARA upper-basin curated gauges – new in this repo (`worker/src/sara.ts` / `frontend/src/lib/sara.ts`)

**Medina River upper (Bandera County flash-flood headwaters):**
- `08178880 Medina Rv At Bandera TX` - elev 1194 ft, Snoflo sample 2,680 cfs 11.02 ft 16543% normal, max 44,500 cfs【7259468828907274590†L14-L16】
- `08178800 Medina Rv near Pipe Creek TX` - upper trib
- `08180700 Medina Rv Nr Macdona TX` - sample 272 cfs 3.14 ft 351% normal【7259468828907274590†L16-L18】
- `08180720 Medina Rv Nr Von Ormy TX` - 52 cfs 5.92 ft sample【7259468828907274590†L18-L20】
- `08181500 Medina Rv At San Antonio TX` - 8 params: Temp water 00010, Precip 00045, Discharge 00060, Gage height 00065, Spec cond 00095, DO 00300, pH 00400, Turbidity 63680【7259468828907274590†L43-L52】 - example recent 25.9, 0.00, 1080 cfs, 7.32 ft etc.

**San Antonio main + Leon/Salado/Cibolo (urban flash):**
- `08178000 San Antonio River at San Antonio, TX` - Centennial 1915【1615332398242546218†L53-L55】, `08178500 near Elmendorf`, `08181800 at Mitchell St`
- Leon Creek: `08181480 at I-10 nr Leon Valley`, `08181495 at Bandera Rd` - west-side low-water crossings
- Salado Creek: `08182300 at Loop 13`, `08182500 at South Side` - east-side urban flash
- Cibolo Creek: `08185000 at Selma`, `08186000 near Falls City` - spring-fed north
- San Geronimo / Seco tribs of Medina

Tightened safety for Medina upper:
- Medina: >2500 cfs = red, >500 yellow, else green (Bandera 2680 cfs flagged red correctly)
- Leon/Salado: >1000 red (low-water overtop), >250 yellow
- Rain: >1" 6h = yellow, >2" = red crossing closure

## 4. Lower Brazos Basin fringe - Brazos River Authority

Authority: Brazos River Authority (BRA) - only lower portion in our bbox near Bryan/College Station fringe down to Freeport.

- Navasota River tributary enters Brazos near Washington.
- Lower Brazos at Hempstead, Richmond, Rosharon.
- Use: irrigation rice fields, not tubing.

## 5. Lavaca-Navidad, Navidad, Matagorda fringe

- Lower fringe: Lavaca River, Navidad River (Lavaca-Navidad River Authority), Matagorda Bay drainage same as Colorado outflow. Include for flood context.

## Recreation thresholds table (for Safety.tsx)

| Site | Green safe | Yellow caution | Red danger/evac |
| --- | --- | --- | --- |
| Comal River at New Braunfels | 0-300 cfs | 300-1500 | >1500 or 1" rain 1h |
| Guadalupe at Sattler (Canyon outlet) | 0-500 | 500-2500 | >2500 or Canyon release >10k |
| San Marcos at San Marcos | 0-500 | 500-1500 | >1500 |
| Barton Creek at Loop 360 | 0-100 | 100-300 | >300 |
| Colorado near Bastrop | 0-5000 | 5000-20000 | >20000 or floodStage |
| San Antonio River at San Antonio | 0-500 | 500-2000 | >2000 or stage>=flood |
| Low-water crossings ATX/Hays/Bexar | dry | water over road <6" | >6" or closed per ATXFloods |

These drive safety badge calc in `frontend/src/lib/safety.ts` (to be created) - function `getSafety(flow, floodStage, stage, rain6h)`.

## Conservation notes

- Environmental flows: TCEQ/TPWD standards for Guadalupe estuary freshwater inflows to Matagorda Bay - satellite + gauges help report.
- Riparian: Pedernales Falls State Park, Guadalupe River State Park - track visitation vs flow.
