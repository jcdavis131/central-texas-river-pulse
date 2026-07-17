import React, { useState } from 'react'
import { useGauges } from '../hooks/useGauges'
import { MapView } from './Map'
import { GaugeList } from './GaugeList'
import { SafetyPanel } from './Safety'
import type { NormalizedGauge } from '../lib/lcra'

type Tab = 'map' | 'gauges' | 'safety' | 'learn'

export default function App() {
  const { gauges, loading, error, lastUpdated, refresh } = useGauges('/api/gauges')
  const [tab, setTab] = useState<Tab>('map')
  const [selectedBasin, setSelectedBasin] = useState('all')
  const [selectedGauge, setSelectedGauge] = useState<NormalizedGauge | null>(null)
  const [nexradOn, setNexradOn] = useState(true)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 56 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(252,251,248,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E8E4DC', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'serif', fontWeight: 700, fontSize: 17 }}>Central Texas River Pulse</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>
            {loading ? 'Loading...' : `${gauges.length} gauges • ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : ''} • free tier • LCRA+USGS+SARA+GBRA`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid #E8E4DC', background: 'white', fontSize: 12 }}>↻ Refresh</button>
        </div>
      </header>

      {error && <div style={{ margin: 12, padding: 12, borderRadius: 12, background: 'rgba(213,94,0,0.08)', border: '1px solid rgba(213,94,0,0.25)', fontSize: 13 }}>Fetch error: {error} - will retry via direct client fallback</div>}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'map' && (
          <>
            <div style={{ padding: '8px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {['all','colorado','guadalupe','san-antonio','pedernales','llano','san-marcos','brazos'].map(b=> (
                <button key={b} onClick={()=>setSelectedBasin(b)} style={{ flexShrink: 0, fontSize: 11, fontFamily: 'monospace', padding: '4px 10px', borderRadius: 999, border: '1px solid #E8E4DC', background: selectedBasin===b ? '#1A1D23' : 'white', color: selectedBasin===b ? 'white' : '#6B7280' }}>{b}</button>
              ))}
              <button onClick={()=>setNexradOn(!nexradOn)} style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid #E8E4DC', background: nexradOn ? '#1A1D23':'white', color: nexradOn ? 'white':'#6B7280' }}>{nexradOn?'●':'○'} NEXRAD</button>
            </div>
            <div style={{ flex: 1, minHeight: 420, padding: 8 }}>
              <div style={{ height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid #E8E4DC' }}>
                <MapView gauges={gauges} selectedBasin={selectedBasin} onSelectGauge={setSelectedGauge} activeLayers={{ nexrad: nexradOn }} />
              </div>
            </div>
          </>
        )}
        {tab === 'gauges' && <GaugeList gauges={gauges} onSelect={setSelectedGauge} />}
        {tab === 'safety' && <SafetyPanel gauges={gauges} />}
        {tab === 'learn' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>How this works - Point + Area</h2>
            <p style={{ fontSize: 14, color: '#6B7280' }}>LCRA Hydromet gives perfect point truth every 15-min (406 sites, 274 LCRA, +COA/USGS/Hays/GBRA). Satellite gives area truth: NEXRAD radar 5-min, Suomi drought/soil moisture daily, Sentinel-1 SAR flood through clouds, SWOT catches 30-ft 166-mile waves on Colorado River south of Austin (tracked to Matagorda Bay Jan 2024).</p>
            <ul style={{ fontSize: 13 }}>
              <li>LCRA main feed: api/GetDataForAllSites - stage ft, flow cfs, rain inches, temp F, flood/bankfull ft, battery V</li>
              <li>USGS IV bbox: bBox=-101,28.5,-96,31.5 param 00060,00065,00045 free json</li>
              <li>NEXRAD tiles: mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/...</li>
              <li>SWOT: NASA PO.DAAC L2_HR_RiverSP 21-day global, 10-day US revisit</li>
              <li>Sentinel-1: IW 250km swath 10m, Harvey/Imelda &gt;94% flood mapping SE TX</li>
            </ul>
            <p style={{ fontSize: 12, color: '#6B7280' }}>Solo personal project, no employer connection, public/free tier only. Data auto-retrieved subject to revision - follow NWS for life safety.</p>
            <a href="https://hydromet.lcra.org/" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>LCRA Hydromet →</a>
          </div>
        )}
      </main>

      {selectedGauge && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={()=>setSelectedGauge(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 8px 64px', borderRadius: 20, border: '1px solid #E8E4DC', background: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: selectedGauge.safety==='green'?'#009E73': selectedGauge.safety==='yellow'?'#E69F00': selectedGauge.safety==='red'?'#D55E00':'#8A8F98' }} />
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>{selectedGauge.agency}·{selectedGauge.site_code} · {selectedGauge.basin} · {selectedGauge.authority}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{selectedGauge.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>{selectedGauge.lat.toFixed(3)}, {selectedGauge.lon.toFixed(3)}</div>
                </div>
                <button onClick={()=>setSelectedGauge(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #E8E4DC', background: '#F2F0EB' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ background: '#F2F0EB', borderRadius: 12, padding: 10 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>Flow</div><div style={{ fontWeight: 600, marginTop: 4 }}>{selectedGauge.flow_cfs!=null? Math.round(selectedGauge.flow_cfs).toLocaleString()+' cfs' : '—'}</div></div>
                <div style={{ background: '#F2F0EB', borderRadius: 12, padding: 10 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>Stage</div><div style={{ fontWeight: 600, marginTop: 4 }}>{selectedGauge.stage_ft!=null? selectedGauge.stage_ft.toFixed(2)+' ft' : '—'}</div><div style={{ fontSize: 10, color: '#6B7280' }}>{selectedGauge.flood_stage_ft? `Flood ${selectedGauge.flood_stage_ft}ft`:''}</div></div>
                <div style={{ background: '#F2F0EB', borderRadius: 12, padding: 10 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>Safety</div><div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, marginTop: 4 }} className={`badge-${selectedGauge.safety}`}>{selectedGauge.safety}</div></div>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 12 }}>Rain 24h {selectedGauge.rain_24h_in ?? '—'}" | Battery {selectedGauge.battery_v ?? '—'}V | Updated {new Date(selectedGauge.last_updated).toLocaleString()} {selectedGauge.stale?'⚠️ stale>1h':''}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 12 }}><a href={`https://hydromet.lcra.org/Charts/?siteNumber=${selectedGauge.site_code}&siteType=flow&agency=${selectedGauge.agency}`} target="_blank" rel="noreferrer">LCRA chart</a><a href={`https://waterdata.usgs.gov/monitoring-location/${selectedGauge.site_code}/`} target="_blank" rel="noreferrer">USGS page</a></div>
            </div>
          </div>
        </div>
      )}

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, borderTop: '1px solid #E8E4DC', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', height: 56, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {[
          {id:'map', label:'Map', icon:'◍'},
          {id:'gauges', label:'Gauges', icon:'≋'},
          {id:'safety', label:'Safety', icon:'⚑'},
          {id:'learn', label:'Learn', icon:'◑'},
        ].map(t=> (
          <button key={t.id} onClick={()=>setTab(t.id as Tab)} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'transparent', border: 'none', color: tab===t.id?'#1A1D23':'#6B7280' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tab===t.id?'#1A1D23':'transparent', color: tab===t.id?'white':'#6B7280', fontSize: 14 }}>{t.icon}</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: tab===t.id?700:400 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
