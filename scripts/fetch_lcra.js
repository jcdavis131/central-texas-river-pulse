// Demo fetching LCRA free JSON endpoints - no key
const BASE = 'https://hydromet.lcra.org'
async function main() {
  console.log('Fetching LCRA GetDataForAllSites (406 sites)...')
  const res = await fetch(`${BASE}/api/GetDataForAllSites`)
  const data = await res.json()
  console.log(` Got ${data.length} sites, ${data.filter(d=>d.agency==='LCRA').length} LCRA`)
  console.log('Sample:', JSON.stringify(data[0], null, 2).slice(0,1000))
  
  console.log('\nFetching GetStageFlowForAllSites...')
  const r2 = await fetch(`${BASE}/api/GetStageFlowForAllSites`)
  const d2 = await r2.json()
  console.log(` Got ${d2.length} stage/flow records sample`, d2[0])

  console.log('\nFetching GetRainfallForAllSites...')
  const r3 = await fetch(`${BASE}/api/GetRainfallForAllSites`)
  const d3 = await r3.json()
  console.log(` Got ${d3.length} rainfall records`)

  console.log('\nFetching historical for site 6399 Colorado near Garwood past 7 days flow...')
  const end = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 7*24*3600*1000).toISOString().split('T')[0]
  const r4 = await fetch(`${BASE}/api/HistoricData/GetDataBySite/6399/flow/${start}/${end}`)
  const d4 = await r4.json()
  console.log(` Got records: ${d4.records?.length} - bankFull ${d4.bankFullStage} flood ${d4.floodStage}`)
}
main().catch(console.error)
