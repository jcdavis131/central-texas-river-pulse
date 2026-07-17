import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, LayersControl, useMap, Marker, Popup, LayerGroup } from 'react-leaflet'
import type { NormalizedGauge } from '../lib/lcra'

interface Props {
  gauges: NormalizedGauge[]
  selectedBasin?: string
  onSelectGauge: (g: NormalizedGauge) => void
  activeLayers?: { nexrad: boolean, drought?: boolean, soil?: boolean }
}

function MapUpdater({ gauges }: { gauges: NormalizedGauge[] }) {
  const map = useMap()
  useEffect(() => {
    if (!gauges.length) return
    // Fit bounds central TX if first load
    const bounds = L.latLngBounds(gauges.map(g => [g.lat, g.lon] as [number, number]))
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 11 })
  }, [gauges.length])
  return null
}

export function MapView({ gauges, selectedBasin, onSelectGauge, activeLayers }: Props) {
  const filtered = selectedBasin && selectedBasin !== 'all' ? gauges.filter(g => g.basin === selectedBasin) : gauges

  const nexradUrl = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png?t={t}'
  const ts = Math.floor(Date.now() / 300000) * 300000 // 5-min bucket

  return (
    <MapContainer center={[30.0, -98.0]} zoom={8} style={{ height: '100%', width: '100%' }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Esri Topo + Hillshade (LCRA style)">
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay name="LCRA Streams (tiles)" >
          <TileLayer url="https://hydromet.lcra.org/tiles/streams/_alllayers/L0{z}/R{y}/C{x}.png" opacity={0.7} attribution="LCRA" />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Watersheds" >
          <TileLayer url="https://hydromet.lcra.org/tiles/watersheds/_alllayers/L0{z}/R{y}/C{x}.png" opacity={0.4} attribution="LCRA" />
        </LayersControl.Overlay>
      </LayersControl>

      {activeLayers?.nexrad && (
        <TileLayer url={nexradUrl.replace('{t}', ts.toString())} opacity={0.5} attribution="IEM NEXRAD" />
      )}

      <LayerGroup>
        {filtered.map(g => {
          const isSARA = (g as any).sara_managed || (g as any).authority?.includes('SARA')
          const colorClass = g.safety === 'green' ? 'dot-green' : g.safety === 'yellow' ? 'dot-yellow' : g.safety === 'red' ? 'dot-red' : 'dot-unknown'
          const sizeClass = isSARA ? 'dot-sara' : g.site_type === 'river' ? 'dot-river' : 'dot-rain'
          const borderClass = isSARA ? 'ring' : ''
          const icon = L.divIcon({
            className: '',
            html: `<div class="gauge-dot ${colorClass} ${sizeClass} ${borderClass}" title="${g.name} ${g.flow_cfs ?? ''} cfs ${isSARA?'[SARA]':''}">${isSARA ? '⭑' : ''}</div>`,
            iconSize: isSARA ? [18,18] : [14,14],
            iconAnchor: isSARA ? [9,9] : [7,7]
          })
          return (
            <Marker key={`${g.agency}-${g.site_code}`} position={[g.lat, g.lon]} icon={icon} eventHandlers={{ click: () => onSelectGauge(g) }}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <strong>{g.name}</strong><br />
                  <small>{g.agency} · {g.site_code} · {g.basin} · {g.authority}</small><br />
                  Flow: {g.flow_cfs != null ? `${Math.round(g.flow_cfs)} cfs` : '—'}<br />
                  Stage: {g.stage_ft != null ? `${g.stage_ft.toFixed(2)} ft` : '—'}<br />
                  {g.flood_stage_ft ? `Flood: ${g.flood_stage_ft} ft | ` : ''}{g.bankfull_ft ? `Bankfull: ${g.bankfull_ft} ft` : ''}<br />
                  Rain 24h: {g.rain_24h_in != null ? `${g.rain_24h_in}"` : '—'}<br />
                  Safety: <span style={{ color: g.safety==='green'?'#009E73': g.safety==='yellow'?'#E69F00': g.safety==='red'?'#D55E00':'#8A8F98', fontWeight: 700 }}>{g.safety}</span><br />
                  <small>Updated: {new Date(g.last_updated).toLocaleString()}</small>{g.stale ? ' ⚠️ stale>1h' : ''}<br />
                  <a href={`https://hydromet.lcra.org/Charts/?siteNumber=${g.site_code}&siteType=flow&agency=${g.agency}`} target="_blank" rel="noreferrer">LCRA chart</a> | <a href={`https://waterdata.usgs.gov/monitoring-location/${g.site_code}/`} target="_blank" rel="noreferrer">USGS page</a>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </LayerGroup>

      <MapUpdater gauges={filtered} />
    </MapContainer>
  )
}
