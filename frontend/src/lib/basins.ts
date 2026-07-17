// Central Texas basins definition - free tier, lat 28.5-31.5 lon -101 to -96
export type BasinId = 'all' | 'colorado' | 'llano' | 'pedernales' | 'guadalupe' | 'comal' | 'san-marcos' | 'san-antonio' | 'brazos' | 'lavaca'

export interface BasinMeta {
  id: BasinId
  label: string
  authority: string[] // e.g., LCRA, SARA
  bbox: [number, number, number, number] // [west,south,east,north]
  tributaries: string[]
  description: string
  safetyNote?: string
}

export const CENTRAL_TEXAS_BBOX: [number, number, number, number] = [-101, 28.5, -96, 31.5] // W,S,E,N

export const BASINS: BasinMeta[] = [
  { id: 'all', label: 'All Central TX', authority: ['LCRA','BRA','GBRA','SARA','Upper Guad','LNRA'], bbox: CENTRAL_TEXAS_BBOX, tributaries: ['Colorado','Guadalupe','San Antonio'], description: 'All central Texas rivers in view' },
  { id: 'colorado', label: 'Colorado River', authority: ['LCRA'], bbox: [-100.5, 29.0, -95.8, 31.5], tributaries: ['Llano','Pedernales','Barton Creek','Onion Creek'], description: 'LCRA 600 miles, Highland Lakes chain Buchanan to Austin to Matagorda', safetyNote: 'Action stage=bankfull yellow, flood red' },
  { id: 'llano', label: 'Llano River', authority: ['LCRA','Upper Colorado'], bbox: [-100.8, 30.2, -98.5, 31.2], tributaries: ['North Llano','South Llano','James River'], description: 'North Llano near Roosevelt, South Llano at Telegraph, Llano at Mason/Llano' },
  { id: 'pedernales', label: 'Pedernales River', authority: ['LCRA'], bbox: [-99.5, 30.0, -98.0, 30.6], tributaries: ['North Grape Creek'], description: 'Fredericksburg, LBJ Ranch near Stonewall (12.5 ft example), Johnson City, Falls State Park' },
  { id: 'guadalupe', label: 'Guadalupe River', authority: ['GBRA','Upper Guadalupe'], bbox: [-100.2, 29.3, -96.5, 30.2], tributaries: ['North Fork Guadalupe','Comal','San Marcos'], description: 'Kerrville, Spring Branch, Canyon Lake inflow, Gonzales to San Antonio Bay' },
  { id: 'comal', label: 'Comal River', authority: ['GBRA','NBU'], bbox: [-98.15, 29.68, -98.10, 29.72], tributaries: [], description: 'Shortest river TX, New Braunfels tubing', safetyNote: '0-300 green, 300-1500 yellow, >1500 red closed' },
  { id: 'san-marcos', label: 'San Marcos River', authority: ['GBRA'], bbox: [-98.0, 29.7, -97.7, 30.0], tributaries: ['Barton Springs?'], description: 'Aquarena Springs, tubing, endangered species' },
  { id: 'san-antonio', label: 'San Antonio River', authority: ['SARA','GBRA'], bbox: [-99.2, 28.7, -96.8, 30.0], tributaries: ['Medina River','Cibolo Creek','Salado Creek','Leon Creek'], description: 'Blue Hole source, Museum Reach, Mission Reach 8mi restored, low-water crossings flash flood focus. Our SARA inclusion per user request.', safetyNote: 'Low-water crossing >6in over road = red' },
  { id: 'brazos', label: 'Lower Brazos', authority: ['BRA'], bbox: [-97.5, 28.5, -95.5, 31.0], tributaries: ['Navasota'], description: 'Lower Brazos Hempstead, Richmond, Rosharon, freed for irrigation rice' },
  { id: 'lavaca', label: 'Lavaca-Navidad', authority: ['LNRA'], bbox: [-96.9, 28.5, -96.0, 29.5], tributaries: [], description: 'Matagorda fringe' },
]

// Okabe-Ito for badges
export const SAFETY_COLOR: Record<string,string> = {
  green: '#009E73',
  yellow: '#E69F00',
  red: '#D55E00',
  unknown: '#8A8F98'
}

// Tubing thresholds for safety calc, from docs/BASINS.md
export const RECREATION_THRESHOLDS: Record<string, { greenMax: number, yellowMax: number }> = {
  'comal': { greenMax: 300, yellowMax: 1500 },
  'guadalupe': { greenMax: 500, yellowMax: 2500 },
  'san-marcos': { greenMax: 500, yellowMax: 1500 },
  'colorado': { greenMax: 5000, yellowMax: 20000 },
  'san-antonio': { greenMax: 500, yellowMax: 2000 },
  'default': { greenMax: 1000, yellowMax: 5000 }
}

export function getBasinForPoint(lat: number, lon: number): BasinId {
  // naive bbox check, first match
  for (const b of BASINS) {
    if (b.id === 'all') continue
    const [w,s,e,n] = b.bbox
    if (lon >= w && lon <= e && lat >= s && lat <= n) return b.id
  }
  return 'colorado'
}
