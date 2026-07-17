import { useState, useMemo } from 'react'
import type { NormalizedGauge } from '../lib/lcra'
import { BASINS } from '../lib/basins'

export function GaugeList({ gauges, onSelect }: { gauges: NormalizedGauge[], onSelect: (g: NormalizedGauge) => void }) {
  const [q, setQ] = useState('')
  const [basin, setBasin] = useState('all')
  const [safety, setSafety] = useState('all')
  const [agency, setAgency] = useState('all')

  const filtered = useMemo(() => {
    return gauges.filter(g => {
      if (basin !== 'all' && g.basin !== basin) return false
      if (safety !== 'all' && g.safety !== safety) return false
      if (agency !== 'all' && g.agency !== agency) return false
      if (q) {
        const qq = q.toLowerCase()
        return g.name.toLowerCase().includes(qq) || g.site_code.toLowerCase().includes(qq) || g.authority.toLowerCase().includes(qq)
      }
      return true
    }).sort((a,b) => (b.flow_cfs ?? -1) - (a.flow_cfs ?? -1))
  }, [gauges, q, basin, safety, agency])

  const agencies = useMemo(() => Array.from(new Set(gauges.map(g=>g.agency))).sort(), [gauges])

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, site code" style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 999, border: '1px solid #E8E4DC' }} />
        <select value={basin} onChange={e=>setBasin(e.target.value)} style={{ padding: '8px 10px', borderRadius: 999, border: '1px solid #E8E4DC' }}>
          <option value="all">All basins</option>
          {BASINS.filter(b=>b.id!=='all').map(b=> <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select value={safety} onChange={e=>setSafety(e.target.value)} style={{ padding: '8px 10px', borderRadius: 999, border: '1px solid #E8E4DC' }}>
          <option value="all">All safety</option>
          <option value="green">Green safe</option>
          <option value="yellow">Yellow caution</option>
          <option value="red">Red danger</option>
        </select>
        <select value={agency} onChange={e=>setAgency(e.target.value)} style={{ padding: '8px 10px', borderRadius: 999, border: '1px solid #E8E4DC' }}>
          <option value="all">All agencies</option>
          {agencies.map(a=> <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280' }}>{filtered.length} of {gauges.length} gauges · sorted flow desc</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.slice(0,200).map(g=>(
          <button key={`${g.agency}-${g.site_code}`} onClick={()=>onSelect(g)} style={{ textAlign: 'left', border: '1px solid #E8E4DC', borderRadius: 12, padding: 12, background: 'white', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{g.agency}·{g.site_code} · {g.basin} · {g.authority} · {g.site_type}</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{g.flow_cfs!=null? `${Math.round(g.flow_cfs)} cfs`:'— flow'} | {g.stage_ft!=null? `${g.stage_ft.toFixed(2)} ft`:'— stage'} | Rain {g.rain_24h_in ?? '—'}" 24h {g.stale?'⚠️ stale':''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, display: 'inline-block' }} className={`badge-${g.safety}`}>{g.safety}</span>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>{new Date(g.last_updated).toLocaleTimeString()}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
