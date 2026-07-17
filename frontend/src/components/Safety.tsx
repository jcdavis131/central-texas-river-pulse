import type { NormalizedGauge } from '../lib/lcra'
import { BASINS } from '../lib/basins'

export function SafetyPanel({ gauges }: { gauges: NormalizedGauge[] }) {
  const bySafety = {
    red: gauges.filter(g=>g.safety==='red').length,
    yellow: gauges.filter(g=>g.safety==='yellow').length,
    green: gauges.filter(g=>g.safety==='green').length,
    unknown: gauges.filter(g=>g.safety==='unknown').length,
  }
  const reds = gauges.filter(g=>g.safety==='red').slice(0,20)
  const yellows = gauges.filter(g=>g.safety==='yellow').slice(0,20)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Safety - Live Badges</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#6B7280' }}>Red danger</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#D55E00' }}>{bySafety.red}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Avoid tubing/swim, floodStage or high flow</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#6B7280' }}>Yellow caution</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#E69F00' }}>{bySafety.yellow}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Bankfull / recent rain</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#6B7280' }}>Green safe</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#009E73' }}>{bySafety.green}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Recreation OK</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#6B7280' }}>Unknown</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#8A8F98' }}>{bySafety.unknown}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>No flow/stage</div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Recreation thresholds (Hill Country)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #E8E4DC' }}><th>Site</th><th>Green</th><th>Yellow</th><th>Red</th></tr></thead>
          <tbody>
            <tr><td>Comal at NB</td><td>0-300 cfs</td><td>300-1500</td><td>&gt;1500</td></tr>
            <tr><td>Guadalupe Sattler</td><td>0-500</td><td>500-2500</td><td>&gt;2500</td></tr>
            <tr><td>San Marcos</td><td>0-500</td><td>500-1500</td><td>&gt;1500</td></tr>
            <tr><td>Barton Ck Loop360</td><td>0-100</td><td>100-300</td><td>&gt;300</td></tr>
            <tr><td>Colorado Bastrop</td><td>0-5k</td><td>5k-20k</td><td>&gt;20k</td></tr>
            <tr><td>San Antonio SA</td><td>0-500</td><td>500-2000</td><td>&gt;2000 / floodStage</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700 }}>Red now ({reds.length})</h4>
          {reds.map(g=> <div key={g.site_code} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #F2F0EB' }}>{g.name} - {g.flow_cfs? Math.round(g.flow_cfs)+' cfs': g.stage_ft? g.stage_ft.toFixed(1)+' ft': ''} ({g.basin})</div>)}
          {!reds.length && <div style={{ fontSize: 12, color: '#6B7280' }}>None - all clear</div>}
        </div>
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700 }}>Yellow now ({yellows.length})</h4>
          {yellows.map(g=> <div key={g.site_code} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #F2F0EB' }}>{g.name} - {g.flow_cfs? Math.round(g.flow_cfs)+' cfs':''} ({g.basin})</div>)}
          {!yellows.length && <div style={{ fontSize: 12, color: '#6B7280' }}>None</div>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', borderTop: '1px solid #E8E4DC', paddingTop: 12 }}>
        Safety is heuristic. Always check official NWS warnings and ATXFloods.com for road closures. Satellite SAR overlay (Sentinel-1) helps confirm overbank flow beyond point gauge.
        Basins: {BASINS.filter(b=>b.id!=='all').map(b=>b.label).join(', ')}
      </div>
    </div>
  )
}
