// SARA upper-basin demo scraper - free, no key, runs with node
// Fetches Medina upper gauges + Leon + Salado + Cibolo via USGS IV
// SARA contracts USGS for 12+ real-time gauges

const SARA_CODES = [
'08178880', // Medina At Bandera 2,680 cfs sample 11.02 ft
'08180700', // Medina Nr Macdona 272 cfs
'08180720', // Medina Nr Von Ormy 52 cfs
'08181500', // Medina At San Antonio - 8 params temp precip discharge stage cond DO pH turbidity
'08178000', // San Antonio at San Antonio 1915 centennial
'08178500','08181800',
'08181480','08181495', // Leon
'08182300','08182500', // Salado
'08185000','08186000', // Cibolo
'08178800',
]

async function main() {
const sites = SARA_CODES.join(',')
const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${sites}&parameterCd=00060,00065,00045,00010,63680&siteStatus=active`
console.log(`Fetching SARA upper: ${url}`)
const res = await fetch(url)
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
const json = await res.json()
const map = {}
for (const ts of json.value?.timeSeries || []) {
const site = ts.sourceInfo?.siteCode?.[0]?.value
const name = ts.sourceInfo?.siteName
const varCode = ts.variable?.variableCode?.[0]?.value
const latest = ts.values?.[0]?.value?.slice(-1)[0]
if (!latest) continue
if (!map[site]) map[site] = { name, values: {}}
map[site].values[varCode] = { val: parseFloat(latest.value), dt: latest.dateTime}
}
console.log(JSON.stringify(map, null, 2))
console.log(`\nTotal SARA gauges returned: ${Object.keys(map).length}/${SARA_CODES.length}`)
}

main().catch(e=>{ console.error(e); process.exit(1)})
