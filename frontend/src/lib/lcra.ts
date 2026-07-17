// LCRA Hydromet client - free JSON, no key
// Based on docs/HYDROMET_DEEP_DIVE.md endpoints

export const LCRA_BASE = 'https://hydromet.lcra.org'

export interface LCRARawSite {
  siteNumber: string
  siteName: string
  latitude: string
  longitude: string
  agency: string // LCRA, COA, USGS, Hays, GBRA
  siteType: string // river, rain, lake, dam
  dateTime: string // ISO Z
  stage?: string
  flow?: string
  rainfallRecent?: string
  rainfall30Minute?: string
  rainfall1Hour?: string
  rainfall2Hour?: string
  rainfall3Hour?: string
  rainfall6Hour?: string
  rainfall12Hour?: string
  rainfallSinceMidnight?: string
  rainfall24Hour?: string
  rainfall48Hour?: string
  rainfall7Day?: string
  temperature?: string
  relativeHumidity?: string
  batteryVoltage?: string
  floodStage?: string
  bankfullStage?: string
  waterTemperature?: string
  headElevation?: string
  tailElevation?: string
  rainfallYear?: string
  rainfallPrevYear?: string
  nwsid?: string
  [k: string]: any
}

export interface NormalizedGauge {
  site_code: string
  name: string
  lat: number
  lon: number
  agency: string
  authority: string
  basin: string
  site_type: 'river' | 'rain' | 'lake' | 'dam' | string
  flow_cfs: number | null
  stage_ft: number | null
  flood_stage_ft: number | null
  bankfull_ft: number | null
  rain_24h_in: number | null
  rain_6h_in?: number | null
  temp_f: number | null
  humidity_pct: number | null
  battery_v: number | null
  safety: 'green' | 'yellow' | 'red' | 'unknown'
  trend?: 'rising' | 'falling' | 'stable'
  last_updated: string
  stale: boolean
}

import { getBasinForPoint } from './basins'

function parseFloatSafe(v?: string | number | null): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? null : n
}

function isStale(dateStr: string): boolean {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return true
  return Date.now() - d.getTime() > 60 * 60 * 1000 // >1h per LCRA spec
}

export function safetyFromStageFlow(stage: number | null, flow: number | null, flood: number | null, bankfull: number | null, basin: string, rain6h: number | null): 'green' | 'yellow' | 'red' | 'unknown' {
  // floodStage overrides
  if (flood != null && stage != null && stage >= flood) return 'red'
  if (bankfull != null && stage != null && stage >= bankfull) return 'yellow'

  // recreation thresholds based on flow if available
  const key = basin
  // thresholds map roughly: see basins.ts RECREATION_THRESHOLDS
  const thresholds: Record<string,{greenMax:number,yellowMax:number}> = {
    'comal': { greenMax: 300, yellowMax: 1500 },
    'guadalupe': { greenMax: 500, yellowMax: 2500 },
    'san-marcos': { greenMax: 500, yellowMax: 1500 },
    'san-antonio': { greenMax: 500, yellowMax: 2000 },
    'colorado': { greenMax: 5000, yellowMax: 20000 },
    'default': { greenMax: 1000, yellowMax: 5000 }
  }
  const t = (thresholds[key] || thresholds['default'])!
  if (flow != null) {
    if (flow <= t.greenMax) {
      // rain check: >1" 6h pushes yellow
      if (rain6h != null && rain6h > 1) return 'yellow'
      return 'green'
    }
    if (flow <= t.yellowMax) return 'yellow'
    return 'red'
  }
  if (rain6h != null && rain6h > 2) return 'red'
  if (rain6h != null && rain6h > 0.5) return 'yellow'
  return 'unknown'
}

export function normalizeLCRA(records: LCRARawSite[]): NormalizedGauge[] {
  const out: NormalizedGauge[] = []
  for (const r of records) {
    const lat = parseFloatSafe(r.latitude)
    const lon = parseFloatSafe(r.longitude)
    if (lat == null || lon == null) continue
    // central TX bbox filter lat 28.5-31.5 lon -101 to -96
    if (lat < 28.5 || lat > 31.5 || lon < -101 || lon > -96) continue

    const flow = parseFloatSafe(r.flow)
    const stage = parseFloatSafe(r.stage)
    const flood = parseFloatSafe(r.floodStage)
    const bank = parseFloatSafe(r.bankfullStage)
    const rain24 = parseFloatSafe(r.rainfall24Hour)
    const rain6 = parseFloatSafe(r.rainfall6Hour)
    const temp = parseFloatSafe(r.temperature)
    const hum = parseFloatSafe(r.relativeHumidity)
    const batt = parseFloatSafe(r.batteryVoltage)
    const basin = getBasinForPoint(lat, lon)

    out.push({
      site_code: r.siteNumber?.toString() || r.siteNumber as any,
      name: r.siteName,
      lat, lon,
      agency: r.agency || 'LCRA',
      authority: r.agency?.includes('GBRA') ? 'GBRA' : r.agency?.includes('SARA') ? 'SARA' : r.agency || 'LCRA',
      basin,
      site_type: (r.siteType as any) || 'river',
      flow_cfs: flow,
      stage_ft: stage,
      flood_stage_ft: flood,
      bankfull_ft: bank,
      rain_24h_in: rain24,
      rain_6h_in: rain6,
      temp_f: temp,
      humidity_pct: hum,
      battery_v: batt,
      safety: safetyFromStageFlow(stage, flow, flood, bank, basin, rain6),
      last_updated: r.dateTime,
      stale: isStale(r.dateTime)
    })
  }
  return out
}

export async function fetchLCRALive(): Promise<LCRARawSite[]> {
  // In browser this can be called directly but CORS may need proxy; worker does it server-side
  const res = await fetch(`${LCRA_BASE}/api/GetDataForAllSites`)
  if (!res.ok) throw new Error(`LCRA fetch ${res.status}`)
  return res.json()
}

export async function fetchLCRARainfall() {
  const res = await fetch(`${LCRA_BASE}/api/GetRainfallForAllSites`)
  if (!res.ok) throw new Error(`rain ${res.status}`)
  return res.json()
}

export async function fetchLCRABySite(siteNumber: string, type: string = 'flow'): Promise<{bankFullStage?: number, floodStage?: number, records: {dateTime: string, value1: number, value2: number}[]}> {
  const res = await fetch(`${LCRA_BASE}/api/GetDataBySite/${siteNumber}/${type}`)
  if (!res.ok) throw new Error(`site ${siteNumber} ${res.status}`)
  return res.json()
}

export async function fetchHistorical(siteNumber: string, type: string, start: string, end: string, hourly = false) {
  const url = `${LCRA_BASE}/api/HistoricData/GetDataBySite/${siteNumber}/${type}/${start}/${end}${hourly ? '/hourly' : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`hist ${res.status}`)
  return res.json()
}
