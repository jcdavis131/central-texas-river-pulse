// Isopolis: Flyway - a light roll-under bird RPG flying over the actual Central Texas
// river/lake geography this app already tracks (see lib/basins.ts).
// Mechanic inspired by I, Toaster's 2D6 roll-under system: roll 2D6, succeed if result <= stat.
import { CENTRAL_TEXAS_BBOX } from './basins'

export type StatKey = 'flight' | 'instinct' | 'charm' | 'grit'

export interface Species {
  id: string
  name: string
  epithet: string
  emoji: string
  stats: Record<StatKey, number>
  blurb: string
}

export const SPECIES: Species[] = [
  { id: 'mockingbird', name: 'Northern Mockingbird', epithet: 'The State Bird', emoji: '🐦', stats: { flight: 6, instinct: 7, charm: 9, grit: 6 }, blurb: 'Texas’ official state bird. Knows every song in the county and isn’t shy about performing them.' },
  { id: 'hawk', name: 'Red-tailed Hawk', epithet: 'The Apex', emoji: '🦅', stats: { flight: 9, instinct: 7, charm: 4, grit: 8 }, blurb: 'Rides the thermals over the Hill Country. Everyone else lands when the hawk’s shadow passes.' },
  { id: 'heron', name: 'Great Blue Heron', epithet: 'The Wader', emoji: '🩶', stats: { flight: 6, instinct: 7, charm: 6, grit: 9 }, blurb: 'Stands stock-still in the shallows for hours. Patience as a personality trait.' },
  { id: 'owl', name: 'Barn Owl', epithet: 'The Night Watch', emoji: '🦉', stats: { flight: 7, instinct: 9, charm: 4, grit: 8 }, blurb: 'Silent wings, a heart-shaped face, and strong opinions about anyone flying after dark.' },
  { id: 'hummingbird', name: 'Ruby-throated Hummingbird', epithet: 'The Zip', emoji: '🐤', stats: { flight: 9, instinct: 6, charm: 8, grit: 5 }, blurb: 'A blur between feeders. Burns twice the calories of anything else in this basin.' },
  { id: 'kingfisher', name: 'Green Kingfisher', epithet: 'The Diver', emoji: '🐧', stats: { flight: 7, instinct: 8, charm: 5, grit: 8 }, blurb: 'Hunts the clear spring-fed creeks. Dive-bombs the water and never seems to miss.' },
]

export interface Trait {
  id: string
  label: string
  bonusStat: StatKey
  blurb: string
}

export const TRAITS: Trait[] = [
  { id: 'brave', label: 'Brave', bonusStat: 'grit', blurb: 'Flies toward the storm, not away from it.' },
  { id: 'dramatic', label: 'Dramatic', bonusStat: 'charm', blurb: 'Every landing is an entrance.' },
  { id: 'grumpy', label: 'Grumpy', bonusStat: 'grit', blurb: 'Mostly there for the bugs, not the company.' },
  { id: 'innocent', label: 'Innocent', bonusStat: 'charm', blurb: 'Genuinely startled every single time.' },
  { id: 'curious', label: 'Curious', bonusStat: 'instinct', blurb: 'Has to see what’s over that next ridge.' },
  { id: 'reckless', label: 'Reckless', bonusStat: 'flight', blurb: 'Full speed between two power lines, no problem.' },
  { id: 'loyal', label: 'Loyal', bonusStat: 'grit', blurb: 'Always circles back to check on the flock.' },
  { id: 'wise', label: 'Wise', bonusStat: 'instinct', blurb: 'Remembers which storm took out which nest, and when.' },
]

export type BiomeId = 'hill' | 'lake' | 'spring' | 'farmland' | 'coastal' | 'river' | 'roost' | 'town'

export interface Biome {
  id: BiomeId
  label: string
  color: string
  description: string
  encounters: { stat: StatKey; success: string; fail: string }[]
}

export const BIOMES: Record<BiomeId, Biome> = {
  hill: {
    id: 'hill', label: 'Hill Country', color: '#B08968',
    description: 'Limestone ridges of the Edwards Plateau, west of the Balcones fault line.',
    encounters: [
      { stat: 'flight', success: 'You catch an updraft off the ridge and gain altitude for free.', fail: 'A gust off the caprock knocks you sideways into a cedar.' },
      { stat: 'instinct', success: 'You spot a dry creek bed before it matters - rain’s coming this way.', fail: 'You miss the signs and get caught in a sudden downpour.' },
    ],
  },
  lake: {
    id: 'lake', label: 'Reservoir', color: '#0072B2',
    description: 'A dammed lake along the river chain.',
    encounters: [
      { stat: 'instinct', success: 'You find a shoal of shad churning the surface - easy dinner.', fail: 'The water’s too deep and cold here; nothing worth catching.' },
      { stat: 'grit', success: 'You out-glide a fishing boat’s wake without breaking stride.', fail: 'The boat wake soaks your feathers; you have to shake off and regroup.' },
    ],
  },
  spring: {
    id: 'spring', label: 'Spring-fed River', color: '#009E73',
    description: 'Cold, clear, spring-fed water year-round.',
    encounters: [
      { stat: 'charm', success: 'Tubers on the bank toss you a piece of bread and cheer.', fail: 'A tuber’s dog barks you clean off your perch.' },
      { stat: 'instinct', success: 'You find the exact spring outflow where the water’s always 72°F.', fail: 'You can’t find the cold spot and settle for lukewarm water.' },
    ],
  },
  farmland: {
    id: 'farmland', label: 'Blackland Prairie', color: '#E69F00',
    description: 'Rich farmland between the Hill Country and the coast, old acequia fields further south.',
    encounters: [
      { stat: 'instinct', success: 'You find a freshly-tilled row thick with grubs.', fail: 'A scarecrow fools you for a full minute before you notice.' },
      { stat: 'grit', success: 'You out-fly a startled barn cat with room to spare.', fail: 'The barn cat gets closer than you’d like to admit.' },
    ],
  },
  coastal: {
    id: 'coastal', label: 'Coastal Plain', color: '#6B7280',
    description: 'Flat, humid, and low - the last stretch before the Gulf.',
    encounters: [
      { stat: 'flight', success: 'You ride the humid headwind low over the flats with ease.', fail: 'The thick, humid air tires your wings faster than usual.' },
      { stat: 'grit', success: 'You push on through the mosquitoes without slowing down.', fail: 'The mosquitoes win this round; you detour to shake them off.' },
    ],
  },
  river: {
    id: 'river', label: 'River Channel', color: '#0072B2',
    description: 'The main stem, always moving toward the Gulf.',
    encounters: [
      { stat: 'flight', success: 'You skim the current’s surface, wingtip tracing the water.', fail: 'A gust off the channel throws your line off and you have to recover.' },
      { stat: 'instinct', success: 'You clock the gauge reading on a passing sensor post - all clear downstream.', fail: 'You can’t read the current well enough to know what’s ahead.' },
    ],
  },
  roost: {
    id: 'roost', label: 'Roost', color: '#8A8F98',
    description: 'A safe perch to rest your wings.',
    encounters: [
      { stat: 'grit', success: 'A good night’s rest here; you wake up fully recovered.', fail: 'Restless night, but you still get some rest in.' },
    ],
  },
  town: {
    id: 'town', label: 'Town', color: '#D55E00',
    description: 'People, traffic, and a surprising amount of dropped food.',
    encounters: [
      { stat: 'charm', success: 'A street musician’s crowd throws you more crumbs than you can carry.', fail: 'The local pigeons have seniority and run you off the good bench.' },
      { stat: 'instinct', success: 'You spot a windowsill toaster sunning itself, oddly proud of its crumb tray. Neither of you bothers the other.', fail: 'You mistake a shiny hubcap for open water and have a very confusing landing.' },
    ],
  },
}

// One world, sized to the same bbox every gauge on the Map tab lives inside of.
export const GRID_SIZE = 36

function clampIdx(n: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, n))
}

export function latLonToCell(lat: number, lon: number): { row: number; col: number } {
  const [w, s, e, n] = CENTRAL_TEXAS_BBOX
  const col = Math.round(((lon - w) / (e - w)) * (GRID_SIZE - 1))
  const row = Math.round(((n - lat) / (n - s)) * (GRID_SIZE - 1))
  return { row: clampIdx(row), col: clampIdx(col) }
}

export interface Tile { row: number; col: number; biome: BiomeId; poi?: string }

interface RiverDef { name: string; biome: 'river' | 'spring'; points: [number, number][] } // [lat, lon]
interface BlobDef { name: string; lat: number; lon: number; radius: number }

// Real waypoints, approximate - a stylized game map, not a survey.
const RIVERS: RiverDef[] = [
  { name: 'Colorado River', biome: 'river', points: [
    [30.88, -98.42], [30.73, -98.37], [30.67, -98.42], [30.58, -98.27], [30.45, -97.95],
    [30.32, -97.82], [30.27, -97.74], [30.11, -97.31], [29.75, -96.65], [29.15, -96.15], [28.70, -95.90],
  ] },
  { name: 'Llano River', biome: 'river', points: [
    [30.68, -100.15], [30.55, -99.90], [30.62, -99.35], [30.75, -98.95], [30.70, -98.42],
  ] },
  { name: 'Pedernales River', biome: 'river', points: [
    [30.35, -98.90], [30.28, -98.87], [30.28, -98.41], [30.30, -98.25], [30.38, -97.98],
  ] },
  { name: 'Guadalupe River', biome: 'spring', points: [
    [30.05, -99.35], [30.05, -99.14], [29.95, -98.70], [29.87, -98.20], [29.70, -98.13],
    [29.50, -97.45], [29.10, -97.00], [28.65, -96.80],
  ] },
  { name: 'Comal River', biome: 'spring', points: [[29.71, -98.14], [29.70, -98.12]] },
  { name: 'San Marcos River', biome: 'spring', points: [[29.89, -97.93], [29.70, -97.68], [29.50, -97.45]] },
  { name: 'San Antonio River', biome: 'river', points: [
    [29.47, -98.47], [29.42, -98.49], [29.35, -98.47], [29.26, -98.32], [28.95, -97.85], [28.60, -97.15],
  ] },
  { name: 'Medina River', biome: 'river', points: [[29.72, -99.08], [29.35, -98.68], [29.18, -98.48], [29.26, -98.48]] },
  { name: 'Cibolo Creek', biome: 'river', points: [[29.59, -98.30], [29.00, -97.92]] },
  { name: 'Brazos River', biome: 'river', points: [[30.10, -96.13], [29.58, -95.76], [29.30, -95.45]] },
  { name: 'Lavaca-Navidad', biome: 'river', points: [[29.00, -96.60], [28.75, -96.30]] },
]

const LAKES: BlobDef[] = [
  { name: 'Lake Buchanan', lat: 30.88, lon: -98.42, radius: 1 },
  { name: 'Inks Lake', lat: 30.73, lon: -98.37, radius: 1 },
  { name: 'Lake LBJ', lat: 30.67, lon: -98.42, radius: 1 },
  { name: 'Lake Marble Falls', lat: 30.58, lon: -98.27, radius: 1 },
  { name: 'Lake Travis', lat: 30.45, lon: -97.95, radius: 2 },
  { name: 'Lady Bird Lake', lat: 30.27, lon: -97.74, radius: 1 },
  { name: 'Canyon Lake', lat: 29.87, lon: -98.20, radius: 1 },
]

const TOWNS: (BlobDef & { name: string })[] = [
  { name: 'Austin', lat: 30.27, lon: -97.74, radius: 1 },
  { name: 'San Antonio', lat: 29.42, lon: -98.49, radius: 1 },
  { name: 'New Braunfels', lat: 29.70, lon: -98.12, radius: 0 },
  { name: 'Kerrville', lat: 30.05, lon: -99.14, radius: 0 },
  { name: 'Fredericksburg', lat: 30.28, lon: -98.87, radius: 0 },
  { name: 'Johnson City', lat: 30.28, lon: -98.41, radius: 0 },
  { name: 'San Marcos', lat: 29.89, lon: -97.93, radius: 0 },
  { name: 'Gonzales', lat: 29.50, lon: -97.45, radius: 0 },
  { name: 'Llano', lat: 30.75, lon: -98.68, radius: 0 },
]

const ROOSTS: [number, number][] = [
  [30.90, -98.40], [30.42, -97.90], [29.85, -98.16], [29.30, -98.44],
  [30.02, -99.08], [29.46, -97.40], [29.55, -95.82], [30.77, -98.63],
]

export const START_POS = latLonToCell(30.27, -97.74) // Austin - Congress Ave bridge, fittingly

function paintBlob(grid: Tile[][], center: { row: number; col: number }, radius: number, biome: BiomeId, poi: string) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (Math.abs(dr) + Math.abs(dc) > radius) continue
      const row = clampIdx(center.row + dr)
      const col = clampIdx(center.col + dc)
      grid[row][col] = { row, col, biome, poi }
    }
  }
}

function paintLine(grid: Tile[][], points: { row: number; col: number }[], biome: BiomeId, poi: string) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const steps = Math.max(Math.abs(b.row - a.row), Math.abs(b.col - a.col), 1)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const row = clampIdx(Math.round(a.row + (b.row - a.row) * t))
      const col = clampIdx(Math.round(a.col + (b.col - a.col) * t))
      grid[row][col] = { row, col, biome, poi }
    }
  }
}

export function generateWorld(): Tile[][] {
  const [w, s, e, n] = CENTRAL_TEXAS_BBOX
  const grid: Tile[][] = []
  for (let row = 0; row < GRID_SIZE; row++) {
    const line: Tile[] = []
    for (let col = 0; col < GRID_SIZE; col++) {
      const lon = w + (col / (GRID_SIZE - 1)) * (e - w)
      const lat = n - (row / (GRID_SIZE - 1)) * (n - s)
      let biome: BiomeId
      if (lon < -98.3) biome = 'hill'
      else if (lat >= 29.6) biome = 'farmland'
      else biome = 'coastal'
      line.push({ row, col, biome })
    }
    grid.push(line)
  }

  for (const river of RIVERS) {
    paintLine(grid, river.points.map(([lat, lon]) => latLonToCell(lat, lon)), river.biome, river.name)
  }
  for (const lake of LAKES) {
    paintBlob(grid, latLonToCell(lake.lat, lake.lon), lake.radius, 'lake', lake.name)
  }
  for (const town of TOWNS) {
    paintBlob(grid, latLonToCell(town.lat, town.lon), town.radius, 'town', town.name)
  }
  for (const [lat, lon] of ROOSTS) {
    const { row, col } = latLonToCell(lat, lon)
    grid[row][col] = { row, col, biome: 'roost' }
  }

  return grid
}

export function maxWind(grit: number): number {
  return 10 + grit
}

export interface RollResult { die1: number; die2: number; roll: number; bonus: number; effective: number; target: number; success: boolean }

export function rollUnder(target: number, bonus: number): RollResult {
  const die1 = 1 + Math.floor(Math.random() * 6)
  const die2 = 1 + Math.floor(Math.random() * 6)
  const roll = die1 + die2
  const effective = Math.max(2, roll - bonus)
  return { die1, die2, roll, bonus, effective, target, success: effective <= target }
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
