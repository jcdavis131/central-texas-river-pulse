// SARA upper-basin scraper for Cloudflare Worker - free tier, no key
// Medina River + upper San Antonio tribs: Leon, Salado, Cibolo, San Geronimo
// Uses same USGS IV endpoint SARA contracted: 12 gauges + 4 monitoring stations managed by SARA in real time

export const SARA_SITES = [
{ code: '08178880', name: 'Medina Rv At Bandera TX', trib: 'Medina', lat: 29.722, lon: -99.078, sub: 'medina-upper', elev: 1194}, // 2,680 cfs sample 11.02 ft stage
{ code: '08178800', name: 'Medina Rv near Pipe Creek TX', trib: 'Medina', lat: 29.72, lon: -98.96, sub: 'medina-upper-trib'},
{ code: '08180700', name: 'Medina Rv Nr Macdona TX', trib: 'Medina', lat: 29.35, lon: -98.68, sub: 'medina-mid'}, // 272 cfs sample
{ code: '08180720', name: 'Medina Rv Nr Von Ormy TX', trib: 'Medina', lat: 29.18, lon: -98.48, sub: 'medina-lower'}, // 52 cfs
{ code: '08181500', name: 'Medina Rv At San Antonio TX', trib: 'Medina', lat: 29.259, lon: -98.48, sub: 'medina-confluence', params: ['00010','00045','00060','00065','00095','00300','00400','63680']}, // 8 params temp, precip, discharge, stage, cond, DO, pH, turbidity
{ code: '08178000', name: 'San Antonio River at San Antonio, TX', trib: 'San Antonio', lat: 29.413, lon: -98.488, sub: 'sa-upper'}, // Centennial 1915
{ code: '08178500', name: 'San Antonio River near Elmendorf TX', trib: 'San Antonio', lat: 29.26, lon: -98.32, sub: 'sa-mid'},
{ code: '08181800', name: 'San Antonio River at Mitchell St San Antonio', trib: 'San Antonio', lat: 29.40, lon: -98.50, sub: 'sa-urban'},
{ code: '08181480', name: 'Leon Ck at I-10 nr Leon Valley', trib: 'Leon', lat: 29.50, lon: -98.60, sub: 'leon-upper'},
{ code: '08181495', name: 'Leon Ck at Bandera Rd', trib: 'Leon', lat: 29.46, lon: -98.55, sub: 'leon-mid'},
{ code: '08182300', name: 'Salado Ck at Loop 13 San Antonio', trib: 'Salado', lat: 29.38, lon: -98.44, sub: 'salado-upper'},
{ code: '08182500', name: 'Salado Ck at South Side', trib: 'Salado', lat: 29.35, lon: -98.42, sub: 'salado-lower'},
{ code: '08185000', name: 'Cibolo Ck at Selma TX', trib: 'Cibolo', lat: 29.59, lon: -98.30, sub: 'cibolo-upper'},
{ code: '08186000', name: 'Cibolo Ck near Falls City TX', trib: 'Cibolo', lat: 29.00, lon: -97.92, sub: 'cibolo-lower'},
]

const SARA_CODES = SARA_SITES.map(s => s.code).join(',')

export async function fetchSARA() {
const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${SARA_CODES}&parameterCd=00060,00065,00045,00010,63680&siteStatus=active`
const res = await fetch(url, { cf: { cacheTtl: 300} as any} as any)
if (!res.ok) throw new Error(`SARA USGS ${res.status}`)
const json: any = await res.json()
const map = new Map<string, { name: string, lat: number, lon: number, params: Record<string,{val:number,dt:string}>, meta: typeof SARA_SITES[0]}>()
for (const ts of json.value?.timeSeries || []) {
const site = ts.sourceInfo?.siteCode?.[0]?.value
const siteName = ts.sourceInfo?.siteName
const geo = ts.sourceInfo?.geoLocation?.geogLocation
const lat = parseFloat(geo?.latitude || '0')
const lon = parseFloat(geo?.longitude || '0')
const varCode = ts.variable?.variableCode?.[0]?.value
const values = ts.values?.[0]?.value
if (!values?.length) continue
const latest = values[values.length -1]
const val = parseFloat(latest.value)
if (isNaN(val)) continue
const meta = SARA_SITES.find(s=>s.code===site)!
if (!meta) continue
if (!map.has(site)) map.set(site, { name: siteName, lat: lat || meta.lat, lon: lon || meta.lon, params: {}, meta})
map.get(site)!.params[varCode] = { val, dt: latest.dateTime}
}
return map
}

export function saraToGauge(site: string, entry: { name: string, lat: number, lon: number, params: Record<string,{val:number,dt:string}>, meta: typeof SARA_SITES[0]}) {
const flow = entry.params['00060']?.val?? null
const stage = entry.params['00065']?.val?? null
const precip = entry.params['00045']?.val?? null
const wtempC = entry.params['00010']?.val?? null
const wtempF = wtempC!= null? wtempC*1.8+32: null
const turb = entry.params['63680']?.val?? null
const latestDt = Object.values(entry.params).map(p=>p.dt).sort().pop() || new Date().toISOString()
// safety tighter for flashy Medina upper
let safety: 'green'|'yellow'|'red'|'unknown' = 'unknown'
if (entry.meta.trib === 'Medina') {
if (flow!= null) safety = flow > 2500? 'red': flow > 500? 'yellow': 'green'
} else if (['Leon','Salado'].includes(entry.meta.trib)) {
if (flow!= null) safety = flow > 1000? 'red': flow > 250? 'yellow': 'green'
} else {
if (flow!= null) safety = flow > 2000? 'red': flow > 500? 'yellow': 'green'
}
if (precip!= null && precip > 2 && safety!== 'red') safety = 'red'
return {
site_code: site,
name: entry.name,
lat: entry.lat,
lon: entry.lon,
agency: 'USGS',
authority: 'SARA+USGS',
basin: 'san-antonio',
sub_basin: entry.meta.sub,
tributary: entry.meta.trib,
site_type: 'river',
flow_cfs: flow,
stage_ft: stage,
rain_24h_in: precip,
temp_f: wtempF,
turbidity_fnu: turb,
elevation_ft: (entry.meta as any).elev || null,
safety,
sara_managed: true,
last_updated: latestDt,
stale: Date.now() - new Date(latestDt).getTime() > 2*60*60*1000
}
}
