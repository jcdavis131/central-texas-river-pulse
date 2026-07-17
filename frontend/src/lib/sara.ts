// SARA-specific scraper for Medina upper + San Antonio upper tributaries
// Free-tier: uses USGS Water Services IV directly (no key), SARA contracts USGS for 12+ real-time gauges
// Covers user request: "Medina The ver upper gauges, etc" = Medina upper basin

export const SARA_UPPER_GAUGES: { site_code: string; name: string; trib: string; lat: number; lon: number; subBasin: string}[] = [
// Medina River - headwaters to confluence (Bandera County upper most critical for flash flood)
{ site_code: '08178880', name: 'Medina Rv At Bandera TX', trib: 'Medina River', lat: 29.722, lon: -99.078, subBasin: 'medina-upper'}, // 8% of Snoflo tracked, elev 1194 ft
{ site_code: '08180700', name: 'Medina Rv Nr Macdona TX', trib: 'Medina River', lat: 29.35, lon: -98.68, subBasin: 'medina-mid'}, // mid near Macdona
{ site_code: '08180720', name: 'Medina Rv Nr Von Ormy TX', trib: 'Medina River', lat: 29.18, lon: -98.48, subBasin: 'medina-lower'},
{ site_code: '08181500', name: 'Medina Rv At San Antonio TX', trib: 'Medina River', lat: 29.259, lon: -98.48, subBasin: 'medina-confluence'}, // has precip, discharge, stage, temp, cond, DO, pH, turbidity

// San Antonio River main stem - upper (Blue Hole source + museum reach)
{ site_code: '08178000', name: 'San Antonio River at San Antonio, TX', trib: 'San Antonio River', lat: 29.413, lon: -98.488, subBasin: 'sanantonio-upper'}, // Centennial 1915
{ site_code: '08178500', name: 'San Antonio River near Elmendorf, TX', trib: 'San Antonio River', lat: 29.26, lon: -98.32, subBasin: 'sanantonio-mid'},
{ site_code: '08181800', name: 'San Antonio River at Mitchell St, San Antonio', trib: 'San Antonio River', lat: 29.40, lon: -98.50, subBasin: 'sanantonio-urban'},

// Leon Creek - major west-side flash flood tributary (SARA low-water crossings)
{ site_code: '08181480', name: 'Leon Ck at I-10 nr Leon Valley', trib: 'Leon Creek', lat: 29.50, lon: -98.60, subBasin: 'leon-upper'},
{ site_code: '08181495', name: 'Leon Ck at Bandera Rd, San Antonio', trib: 'Leon Creek', lat: 29.46, lon: -98.55, subBasin: 'leon-mid'},

// Salado Creek - east-side urban flash
{ site_code: '08182300', name: 'Salado Ck at Loop 13, San Antonio', trib: 'Salado Creek', lat: 29.38, lon: -98.44, subBasin: 'salado-upper'},
{ site_code: '08182500', name: 'Salado Ck at South Side San Antonio', trib: 'Salado Creek', lat: 29.35, lon: -98.42, subBasin: 'salado-lower'},

// Cibolo Creek - upper San Antonio basin north
{ site_code: '08185000', name: 'Cibolo Ck at Selma TX', trib: 'Cibolo Creek', lat: 29.59, lon: -98.30, subBasin: 'cibolo-upper'},
{ site_code: '08186000', name: 'Cibolo Ck near Falls City TX', trib: 'Cibolo Creek', lat: 29.00, lon: -97.92, subBasin: 'cibolo-lower'},

// Helotes / San Geronimo (Medina trib)
{ site_code: '08178800', name: 'Medina Rv near Pipe Creek TX', trib: 'Medina River', lat: 29.72, lon: -98.96, subBasin: 'medina-upper-trib'},
]

const SARA_SITE_CODES = SARA_UPPER_GAUGES.map(g => g.site_code).join(',')

export async function fetchSARA(): Promise<Map<string, { name: string, lat: number, lon: number, params: Record<string,{val:number,dt:string}>, meta: typeof SARA_UPPER_GAUGES[0]}>> {
const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${SARA_SITE_CODES}&parameterCd=00060,00065,00045,00010,63680&siteStatus=active`
const res = await fetch(url)
if (!res.ok) throw new Error(`SARA USGS ${res.status}`)
const json = await res.json()
const map = new Map<string, { name: string, lat: number, lon: number, params: Record<string,{val:number,dt:string}>, meta: typeof SARA_UPPER_GAUGES[0]}>()

for (const ts of json.value?.timeSeries || []) {
const site = ts.sourceInfo?.siteCode?.[0]?.value
const siteName = ts.sourceInfo?.siteName
const geo = ts.sourceInfo?.geoLocation?.geogLocation
const lat = parseFloat(geo?.latitude || '0')
const lon = parseFloat(geo?.longitude || '0')
const varCode = ts.variable?.variableCode?.[0]?.value
const values = ts.values?.[0]?.value
if (!values?.length) continue
const latest = values[values.length - 1]
const val = parseFloat(latest.value)
if (isNaN(val)) continue

const meta = SARA_UPPER_GAUGES.find(g => g.site_code === site)
if (!meta) continue

if (!map.has(site)) map.set(site, { name: siteName, lat: lat || meta.lat, lon: lon || meta.lon, params: {}, meta})
map.get(site)!.params[varCode] = { val, dt: latest.dateTime}
}
return map
}

export function saraSafetyFrom(flow: number | null, stage: number | null, rain6: number | null, trib: string) {
// tighter thresholds for upper Medina / Leon flash prone
if (trib.includes('Medina') && flow!= null) {
if (flow > 2500) return 'red' // 2,680 cfs at Bandera = 16543% normal
if (flow > 500) return 'yellow'
return 'green'
}
if (trib.includes('Leon') || trib.includes('Salado')) {
if (flow!= null && flow > 1000) return 'red'
if (flow!= null && flow > 250) return 'yellow'
}
if (rain6!= null && rain6 > 1) return 'yellow'
if (rain6!= null && rain6 > 2) return 'red'
if (flow == null) return 'unknown'
return flow > 1000? 'red': flow > 300? 'yellow': 'green'
}
