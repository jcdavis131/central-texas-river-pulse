// Demo USGS Water Services free JSON bbox central TX lat 28.5-31.5 lon -101 to -96
const BBOX = '-101,28.5,-96,31.5'
const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${BBOX}&parameterCd=00060,00065,00045,00010&siteStatus=active`

async function main() {
  console.log('Fetching USGS IV bbox', BBOX)
  console.log(url)
  const res = await fetch(url)
  const json = await res.json()
  const count = json.value?.timeSeries?.length || 0
  console.log(`Got ${count} timeSeries`)
  // Map sites
  const sites = new Map()
  for (const ts of json.value?.timeSeries || []) {
    const code = ts.sourceInfo?.siteCode?.[0]?.value
    const name = ts.sourceInfo?.siteName
    const varCode = ts.variable?.variableCode?.[0]?.value
    const vals = ts.values?.[0]?.value
    if (!vals?.length) continue
    const latest = vals[vals.length-1]
    if (!sites.has(code)) sites.set(code, { name, varCodes: {} })
    sites.get(code).varCodes[varCode] = latest.value
  }
  console.log(`Unique sites ${sites.size}`)
  for (const [code, info] of Array.from(sites.entries()).slice(0,10)) {
    console.log(code, info.name, info.varCodes)
  }
}
main().catch(console.error)
