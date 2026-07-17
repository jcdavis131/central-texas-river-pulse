// USGS Water Services - free, no key
// IV bbox query central TX lat 28.5-31.5 lon -101 to -96

export const USGS_BASE = 'https://waterservices.usgs.gov/nwis/iv'

export interface USGSValue {
  dateTime: string
  value: number
}

export interface USGSObservation {
  site_code: string
  site_name: string
  lat: number
  lon: number
  param_cd: string // 00060 flow, 00065 stage, 00045 precip, 00010 wtemp C
  values: { dateTime: string, value: number, qualifiers?: string[] }[]
  latest: number | null
  latest_dt: string | null
}

export interface USGSApiResponse {
  gauges: {
    site_code: string
    name: string
    lat: number
    lon: number
    agency: string
    authority: string
    basin: string
    flow_cfs: number | null
    stage_ft: number | null
    rain_24h_in: number | null
    temp_f: number | null
    safety: 'green'|'yellow'|'red'|'unknown'
    last_updated: string
    stale: boolean
  }[]
  rawTimeSeries: any
}

const CENTRAL_BBOX = '-101,28.5,-96,31.5' // W,S,E,N
import { getBasinForPoint } from './basins'

function parseUSGS(json: any): Map<string, { name: string, lat: number, lon: number, params: Record<string, { val: number, dt: string }> }> {
  const map = new Map<string, { name: string, lat: number, lon: number, params: Record<string, { val: number, dt: string }> }>()
  if (!json.value?.timeSeries) return map
  for (const ts of json.value.timeSeries) {
    const site = ts.sourceInfo?.siteCode?.[0]?.value || ts.sourceInfo?.siteName || 'unknown'
    const siteName = ts.sourceInfo?.siteName || site
    const geo = ts.sourceInfo?.geoLocation?.geogLocation
    const lat = parseFloat(geo?.latitude || ts.sourceInfo?.geoLocation?.geogLocation?.latitude || '0')
    const lon = parseFloat(geo?.longitude || ts.sourceInfo?.geoLocation?.geogLocation?.longitude || '0')
    const varCode = ts.variable?.variableCode?.[0]?.value || ts.variable?.variableCode || '00060'
    const values = ts.values?.[0]?.value
    if (!values || values.length === 0) continue
    const latest = values[values.length - 1]
    const val = parseFloat(latest.value)
    if (isNaN(val)) continue

    if (!map.has(site)) map.set(site, { name: siteName, lat, lon, params: {} })
    const entry = map.get(site)!
    entry.params[varCode] = { val, dt: latest.dateTime }
    // keep lat/lon if first time
    if (!entry.lat) entry.lat = lat
    if (!entry.lon) entry.lon = lon
  }
  return map
}

export async function fetchUSGS(bbox = CENTRAL_BBOX): Promise<USGSApiResponse> {
  const url = `${USGS_BASE}/?format=json&bBox=${bbox}&parameterCd=00060,00065,00045,00010&siteStatus=active`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`USGS ${res.status}`)
  const json = await res.json()
  const parsed = parseUSGS(json)

  const gauges: any[] = []
  for (const [site_code, info] of parsed.entries()) {
    // bbox filter already via API, double check central tx
    if (info.lat < 28.5 || info.lat > 31.5 || info.lon < -101 || info.lon > -96) continue
    const flow = info.params['00060']?.val ?? null
    const stage = info.params['00065']?.val ?? null
    const precip = info.params['00045']?.val ?? null
    const wtempC = info.params['00010']?.val ?? null
    const wtempF = wtempC != null ? wtempC * 1.8 + 32 : null
    const latestDt = Object.values(info.params).map(p=>p.dt).sort().pop() || new Date().toISOString()
    const basin = getBasinForPoint(info.lat, info.lon)
    // safety simple
    let safety: 'green'|'yellow'|'red'|'unknown' = 'unknown'
    if (flow != null) {
      if (flow > 5000) safety = 'red'
      else if (flow > 1000) safety = 'yellow'
      else safety = 'green'
    }
    const stale = latestDt ? (Date.now() - new Date(latestDt).getTime() > 2*60*60*1000) : false

    gauges.push({
      site_code,
      name: info.name,
      lat: info.lat,
      lon: info.lon,
      agency: 'USGS',
      authority: basin === 'san-antonio' ? 'SARA+USGS' : basin === 'guadalupe' ? 'GBRA+USGS' : 'USGS',
      basin,
      flow_cfs: flow,
      stage_ft: stage,
      rain_24h_in: precip,
      temp_f: wtempF,
      safety,
      last_updated: latestDt,
      stale
    })
  }

  return { gauges, rawTimeSeries: json }
}

// Worker uses same logic server-side; this file is for frontend direct fetch fallback when worker unavailable.
