import { useEffect, useState } from 'react'
import type { NormalizedGauge } from '../lib/lcra'

export interface GaugesState {
  gauges: NormalizedGauge[]
  loading: boolean
  error: string | null
  lastUpdated: string | null
  count: number
}

export function useGauges(apiUrl = '/api/gauges', refreshMs = 10 * 60 * 1000) {
  const [state, setState] = useState<GaugesState>({ gauges: [], loading: true, error: null, lastUpdated: null, count: 0 })

  async function load() {
    try {
      setState(s => ({ ...s, loading: true, error: null }))
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      const json = await res.json()
      setState({ gauges: json.gauges || [], loading: false, error: null, lastUpdated: json.cached_at || new Date().toISOString(), count: json.count || json.gauges?.length || 0 })
    } catch (e: any) {
      // fallback: try direct LCRA + USGS + SARA client side (free, no worker)
      try {
        const { fetchLCRALive, normalizeLCRA } = await import('../lib/lcra')
        const { fetchUSGS } = await import('../lib/usgs')
        const { fetchSARA } = await import('../lib/sara')
        const [lcraRaw, usgs, sara] = await Promise.allSettled([fetchLCRALive(), fetchUSGS(), fetchSARA()])
        const gauges: NormalizedGauge[] = []
        if (lcraRaw.status === 'fulfilled') gauges.push(...normalizeLCRA(lcraRaw.value))
        if (usgs.status === 'fulfilled') {
          for (const g of (usgs.value as any).gauges) {
            // skip if already in SARA to avoid dup
            if (sara.status === 'fulfilled' && (sara.value as any).has(g.site_code)) continue
            gauges.push(g)
          }
        }
        if (sara.status === 'fulfilled') {
          for (const [site_code, entry] of (sara.value as any).entries()) {
            const { saraSafetyFrom } = await import('../lib/sara')
            const flow = (entry as any).params['00060']?.val ?? null
            const stage = (entry as any).params['00065']?.val ?? null
            const rain = (entry as any).params['00045']?.val ?? null
            gauges.push({
              site_code,
              name: (entry as any).name,
              lat: (entry as any).lat,
              lon: (entry as any).lon,
              agency: 'USGS',
              authority: 'SARA+USGS',
              basin: 'san-antonio',
              tributary: (entry as any).meta.trib,
              sub_basin: (entry as any).meta.subBasin,
              flow_cfs: flow,
              stage_ft: stage,
              rain_24h_in: rain,
              safety: saraSafetyFrom(flow, stage, rain, (entry as any).meta.trib) as any,
              sara_managed: true,
              last_updated: Object.values((entry as any).params).map((p:any)=>p.dt).sort().pop() || new Date().toISOString(),
              stale: false
            } as any)
          }
        }
        if (gauges.length) {
          setState({ gauges, loading: false, error: null, lastUpdated: new Date().toISOString(), count: gauges.length })
          return
        }
        throw e
      } catch (fallbackErr: any) {
        setState(s => ({ ...s, loading: false, error: e?.message || String(e) }))
      }
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, refreshMs)
    return () => clearInterval(id)
  }, [apiUrl, refreshMs])

  return { ...state, refresh: load }
}
