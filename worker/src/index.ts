import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { fetchSARA, saraToGauge, SARA_SITES } from './sara'

type Bindings = {
  LCRA_BASE: string
  USGS_BBOX: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({ origin: '*', allowHeaders: ['*'], allowMethods: ['GET,OPTIONS'] }))

function parseFloatSafe(v: any): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? Number(v) : parseFloat(v)
  return isNaN(n) ? null : n
}

function getBasinForPoint(lat: number, lon: number): string {
  // simplified central TX basin inference - matches frontend basins.ts
  if (lat >= 29.68 && lat <= 29.72 && lon >= -98.15 && lon <= -98.10) return 'comal'
  if (lat >= 29.7 && lat <= 30.0 && lon >= -98.0 && lon <= -97.7) return 'san-marcos'
  if (lat >= 28.7 && lat <= 30.0 && lon >= -99.2 && lon <= -96.8) {
    // distinguish san-antonio vs guadalupe by longitude west-ish San Antonio
    if (lon <= -97.8) return 'san-antonio'
    return 'guadalupe'
  }
  if (lat >= 30.0 && lat <= 31.2 && lon >= -100.8 && lon <= -98.5) return 'llano'
  if (lat >= 30.0 && lat <= 30.6 && lon >= -99.5 && lon <= -98.0) return 'pedernales'
  if (lat >= 28.5 && lat <= 31.0 && lon >= -97.5 && lon <= -95.5) return 'brazos'
  if (lat >= 28.5 && lat <= 29.5 && lon >= -96.9 && lon <= -96.0) return 'lavaca'
  return 'colorado'
}

function safetyFrom(flow: number | null, stage: number | null, flood: number | null, bankfull: number | null, basin: string, rain6: number | null) {
  if (flood != null && stage != null && stage >= flood) return 'red'
  if (bankfull != null && stage != null && stage >= bankfull) return 'yellow'
  const thresholds: Record<string,{greenMax:number,yellowMax:number}> = {
    comal: { greenMax: 300, yellowMax: 1500 },
    guadalupe: { greenMax: 500, yellowMax: 2500 },
    'san-marcos': { greenMax: 500, yellowMax: 1500 },
    'san-antonio': { greenMax: 500, yellowMax: 2000 },
    colorado: { greenMax: 5000, yellowMax: 20000 },
    default: { greenMax: 1000, yellowMax: 5000 }
  }
  const t = thresholds[basin] || thresholds['default']!
  if (flow != null) {
    if (flow <= t.greenMax) {
      if (rain6 != null && rain6 > 1) return 'yellow'
      return 'green'
    }
    if (flow <= t.yellowMax) return 'yellow'
    return 'red'
  }
  if (rain6 != null && rain6 > 2) return 'red'
  if (rain6 != null && rain6 > 0.5) return 'yellow'
  return 'unknown'
}

async function fetchLCRA(base: string) {
  const res = await fetch(`${base}/api/GetDataForAllSites`, { cf: { cacheTtl: 300 } as any })
  if (!res.ok) throw new Error(`LCRA ${res.status}`)
  return (await res.json()) as any[]
}

async function fetchUSGS(bbox: string) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00060,00065,00045,00010&siteStatus=active`
  const res = await fetch(url, { cf: { cacheTtl: 300 } as any })
  if (!res.ok) throw new Error(`USGS ${res.status}`)
  const json: any = await res.json()
  const map = new Map<string, { name: string, lat: number, lon: number, params: Record<string,{val:number,dt:string}> }>()
  for (const ts of json.value?.timeSeries || []) {
    const site = ts.sourceInfo?.siteCode?.[0]?.value
    const siteName = ts.sourceInfo?.siteName
    const geo = ts.sourceInfo?.geoLocation?.geogLocation
    const lat = parseFloat(geo?.latitude)
    const lon = parseFloat(geo?.longitude)
    const varCode = ts.variable?.variableCode?.[0]?.value
    const values = ts.values?.[0]?.value
    if (!values?.length) continue
    const latest = values[values.length-1]
    const val = parseFloat(latest.value)
    if (isNaN(val)) continue
    if (!map.has(site)) map.set(site, { name: siteName, lat, lon, params: {} })
    map.get(site)!.params[varCode] = { val, dt: latest.dateTime }
  }
  return map
}

function mergeGauges(lcraRaw: any[], usgsMap: Map<string,any>, saraMap?: Map<string,any>) {
  const gauges: any[] = []
  for (const r of lcraRaw) {
    const lat = parseFloatSafe(r.latitude)
    const lon = parseFloatSafe(r.longitude)
    if (lat == null || lon == null) continue
    if (lat < 28.5 || lat > 31.5 || lon < -101 || lon > -96) continue
    const basin = getBasinForPoint(lat, lon)
    const flow = parseFloatSafe(r.flow)
    const stage = parseFloatSafe(r.stage)
    const flood = parseFloatSafe(r.floodStage)
    const bank = parseFloatSafe(r.bankfullStage)
    const rain24 = parseFloatSafe(r.rainfall24Hour)
    const rain6 = parseFloatSafe(r.rainfall6Hour)
    gauges.push({
      site_code: String(r.siteNumber),
      name: r.siteName,
      lat, lon,
      agency: r.agency || 'LCRA',
      authority: r.agency?.includes('GBRA') ? 'GBRA' : r.agency || 'LCRA',
      basin,
      site_type: r.siteType || 'river',
      flow_cfs: flow,
      stage_ft: stage,
      flood_stage_ft: flood,
      bankfull_ft: bank,
      rain_24h_in: rain24,
      rain_6h_in: rain6,
      temp_f: parseFloatSafe(r.temperature),
      humidity_pct: parseFloatSafe(r.relativeHumidity),
      battery_v: parseFloatSafe(r.batteryVoltage),
      safety: safetyFrom(flow, stage, flood, bank, basin, rain6),
      last_updated: r.dateTime,
      stale: Date.now() - new Date(r.dateTime).getTime() > 60*60*1000
    })
  }
  // SARA upper-basin explicit gauges - prioritize SARA managed (Medina upper most critical)
  if (saraMap) {
    for (const [site_code, info] of saraMap.entries()) {
      const gauge = saraToGauge(site_code, info as any)
      gauges.push(gauge)
    }
  }
  for (const [site_code, info] of usgsMap.entries()) {
    if (info.lat < 28.5 || info.lat > 31.5 || info.lon < -101 || info.lon > -96) continue
    // skip if already added via SARA map (Medina upper etc de-duped)
    if (saraMap && saraMap.has(site_code)) continue
    const flow = info.params['00060']?.val ?? null
    const stage = info.params['00065']?.val ?? null
    const precip = info.params['00045']?.val ?? null
    const wtempC = info.params['00010']?.val ?? null
    const wtempF = wtempC != null ? wtempC * 1.8 + 32 : null
    const latestDt = Object.values(info.params).map((p:any)=>p.dt).sort().pop() || new Date().toISOString()
    const basin = getBasinForPoint(info.lat, info.lon)
    gauges.push({
      site_code,
      name: info.name,
      lat: info.lat,
      lon: info.lon,
      agency: 'USGS',
      authority: basin === 'san-antonio' ? 'SARA+USGS' : basin.includes('guadalupe') || basin.includes('comal') || basin.includes('san-marcos') ? 'GBRA+USGS' : 'USGS',
      basin,
      site_type: 'river',
      flow_cfs: flow,
      stage_ft: stage,
      flood_stage_ft: null,
      bankfull_ft: null,
      rain_24h_in: precip,
      rain_6h_in: null,
      temp_f: wtempF,
      humidity_pct: null,
      battery_v: null,
      safety: safetyFrom(flow, stage, null, null, basin, null),
      last_updated: latestDt,
      stale: Date.now() - new Date(latestDt).getTime() > 2*60*60*1000
    })
  }
  return gauges
}

app.get('/api/gauges', async (c) => {
  const cache = caches.default
  const cacheKey = new Request(c.req.url, { method: 'GET' })
  let res = await cache.match(cacheKey)
  if (res) {
    const cloned = new Response(res.body, res)
    cloned.headers.set('X-Cache', 'HIT')
    return cloned
  }
  try {
    const lcraBase = c.env.LCRA_BASE || 'https://hydromet.lcra.org'
    const bbox = c.env.USGS_BBOX || '-101,28.5,-96,31.5'
    const [lcraRaw, usgsMap, saraMap] = await Promise.all([fetchLCRA(lcraBase), fetchUSGS(bbox), fetchSARA().catch(()=>new Map())])
    const gauges = mergeGauges(lcraRaw, usgsMap, saraMap as any)
    const url = new URL(c.req.url)
    let filtered = gauges
    const qBasin = url.searchParams.get('basin')
    if (qBasin && qBasin !== 'all') filtered = filtered.filter(g=>g.basin===qBasin || (g as any).sub_basin===qBasin || (g as any).tributary?.toLowerCase()===qBasin.toLowerCase())
    const qSafety = url.searchParams.get('safety')
    if (qSafety && qSafety !== 'all') filtered = filtered.filter(g=>g.safety===qSafety)
    const qTrib = url.searchParams.get('trib')
    if (qTrib) filtered = filtered.filter(g=> (g.tributary && g.tributary.toLowerCase().includes(qTrib.toLowerCase())) || (g.sub_basin && g.sub_basin.includes(qTrib.toLowerCase())))

    const body = JSON.stringify({ gauges: filtered, count: filtered.length, total: gauges.length, sources: ['LCRA GetDataForAllSites','SARA curated USGS sites (12 gauges + Medina upper)','USGS IV bbox'], bbox, cached_at: new Date().toISOString(), sara_sites: SARA_SITES.length })
    const response = new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'MISS' } })
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  } catch (e:any) {
    return c.json({ error: e?.message || String(e), gauges: [], count: 0 }, 500)
  }
})

app.get('/api/stats', async (c) => {
  const cache = caches.default
  const cacheKey = new Request(c.req.url)
  const cached = await cache.match(cacheKey)
  if (cached) return cached
  const gaugesRes = await fetch(`${new URL(c.req.url).origin}/api/gauges`, { cf: { cacheTtl: 300 } as any } as any)
  let gauges: any[] = []
  try {
    if (gaugesRes.ok) {
      const j: any = await gaugesRes.json()
      gauges = j.gauges || []
    } else {
      const lcraBase = c.env.LCRA_BASE || 'https://hydromet.lcra.org'
      const bbox = c.env.USGS_BBOX || '-101,28.5,-96,31.5'
      const [lcraRaw, usgsMap, saraMap] = await Promise.all([fetchLCRA(lcraBase), fetchUSGS(bbox), fetchSARA().catch(()=>new Map())])
      gauges = mergeGauges(lcraRaw, usgsMap, saraMap as any)
    }
  } catch {
    gauges = []
  }

  const bySafety = {
    red: gauges.filter(g=>g.safety==='red').length,
    yellow: gauges.filter(g=>g.safety==='yellow').length,
    green: gauges.filter(g=>g.safety==='green').length,
    unknown: gauges.filter(g=>g.safety==='unknown').length,
  }
  const byBasin: Record<string,number> = {}
  const byAgency: Record<string,number> = {}
  const byTrib: Record<string,number> = {}
  for (const g of gauges) {
    byBasin[g.basin] = (byBasin[g.basin]||0)+1
    byAgency[g.authority || g.agency] = (byAgency[g.authority || g.agency]||0)+1
    if (g.tributary) byTrib[g.tributary] = (byTrib[g.tributary]||0)+1
  }

  const body = JSON.stringify({ total: gauges.length, bySafety, byBasin, byAgency, byTrib, sara_managed: gauges.filter(g=>g.sara_managed).length, sara_curated: SARA_SITES.length, cached_at: new Date().toISOString() })
  const resp = new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } })
  c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()))
  return resp
})

app.get('/api/sara', async (c) => {
  try {
    const saraMap = await fetchSARA()
    const gauges = []
    for (const [site_code, info] of saraMap.entries()) {
      gauges.push(saraToGauge(site_code, info as any))
    }
    return c.json({ count: gauges.length, curated: SARA_SITES.length, gauges, sources: ['SARA+USGS curated Medina upper + Leon + Salado + Cibolo', 'USGS IV sites param list'], cached_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  } catch (e:any) {
    return c.json({ error: e.message, curated: SARA_SITES, count: 0 }, 500)
  }
})

app.get('/api/historical', async (c) => {
  const site = c.req.query('site')
  const type = c.req.query('type') || 'flow'
  const days = parseInt(c.req.query('days') || '7')
  if (!site) return c.json({ error: 'missing ?site=' }, 400)
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  const s = start.toISOString().split('T')[0]
  const e = end.toISOString().split('T')[0]
  const base = c.env.LCRA_BASE || 'https://hydromet.lcra.org'
  const url = `${base}/api/HistoricData/GetDataBySite/${site}/${type}/${s}/${e}`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const json = await res.json()
    return c.json(json, { headers: { 'Cache-Control': 'public, max-age=600' } })
  } catch (err:any) {
    return c.json({ error: err.message, url }, 500)
  }
})

app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString(), bbox: c.env.USGS_BBOX, lcra: c.env.LCRA_BASE, sara_curated: SARA_SITES.length }))

app.get('/', (c) => c.json({ name: 'central-texas-river-pulse-api', freeTier: true, endpoints: ['/api/gauges','/api/gauges?basin=san-antonio&trib=Medina','/api/sara','/api/stats','/api/historical?site=6399&type=flow&days=7','/api/health'], docs: 'see docs/API.md', basins: 'lat 28.5-31.5 lon -101 to -96 including San Antonio River Authority Medina upper', sara: { curated: SARA_SITES.length, upper: 'Medina at Bandera 08178880 2,680cfs example, Macdona 08180700, Von Ormy 08180720, San Antonio 08181500 has 8 params' } }))

// Cron: warm cache
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    try {
      const lcraRaw = await fetchLCRA(env.LCRA_BASE || 'https://hydromet.lcra.org')
      const usgsMap = await fetchUSGS(env.USGS_BBOX || '-101,28.5,-96,31.5')
      const saraMap = await fetchSARA().catch(()=>new Map())
      const gauges = mergeGauges(lcraRaw, usgsMap, saraMap as any)
      console.log(`Cron warmed ${gauges.length} gauges (${saraMap.size} SARA upper) at ${new Date().toISOString()}`)
    } catch (e) {
      console.error('Cron error', e)
    }
  }
}
