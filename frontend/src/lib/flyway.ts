// Isopolis: Flyway - a light roll-under bird RPG layered over the Central Texas river world.
// Mechanic inspired by I, Toaster's 2D6 roll-under system: roll 2D6, succeed if result <= stat.

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

export type BiomeId = 'hill' | 'lake' | 'spring' | 'farmland' | 'delta' | 'river' | 'roost' | 'town'

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
    description: 'Limestone ridges above the Llano and Pedernales.',
    encounters: [
      { stat: 'flight', success: 'You catch an updraft off the ridge and gain altitude for free.', fail: 'A gust off the caprock knocks you sideways into a cedar.' },
      { stat: 'instinct', success: 'You spot a dry creek bed before it matters - rain’s coming this way.', fail: 'You miss the signs and get caught in a sudden downpour.' },
    ],
  },
  lake: {
    id: 'lake', label: 'Highland Lakes', color: '#0072B2',
    description: 'Buchanan to Travis, the Colorado’s chain of reservoirs.',
    encounters: [
      { stat: 'instinct', success: 'You find a shoal of shad churning the surface - easy dinner.', fail: 'The water’s too deep and cold here; nothing worth catching.' },
      { stat: 'grit', success: 'You out-glide a fishing boat’s wake without breaking stride.', fail: 'The boat wake soaks your feathers; you have to shake off and regroup.' },
    ],
  },
  spring: {
    id: 'spring', label: 'Spring-fed Rivers', color: '#009E73',
    description: 'Comal and San Marcos, cold and clear year-round.',
    encounters: [
      { stat: 'charm', success: 'Tubers on the bank toss you a piece of bread and cheer.', fail: 'A tuber’s dog barks you clean off your perch.' },
      { stat: 'instinct', success: 'You find the exact spring outflow where the water’s always 72°F.', fail: 'You can’t find the cold spot and settle for lukewarm water.' },
    ],
  },
  farmland: {
    id: 'farmland', label: 'Mission Farmland', color: '#E69F00',
    description: 'Old acequia fields along the San Antonio River.',
    encounters: [
      { stat: 'instinct', success: 'You find a freshly-tilled row thick with grubs.', fail: 'A scarecrow fools you for a full minute before you notice.' },
      { stat: 'grit', success: 'You out-fly a startled barn cat with room to spare.', fail: 'The barn cat gets closer than you’d like to admit.' },
    ],
  },
  delta: {
    id: 'delta', label: 'Brazos Floodplain', color: '#6B7280',
    description: 'Wide, slow, and prone to flooding after storms.',
    encounters: [
      { stat: 'flight', success: 'You ride the humid headwind low over the floodplain with ease.', fail: 'The thick, humid air tires your wings faster than usual.' },
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
    id: 'town', label: 'Mission Reach Polis', color: '#D55E00',
    description: 'San Antonio’s restored river walk, thick with people and pigeons.',
    encounters: [
      { stat: 'charm', success: 'A street musician’s crowd throws you more crumbs than you can carry.', fail: 'The pigeons here have seniority and run you off the good bench.' },
      { stat: 'instinct', success: 'You spot a windowsill toaster sunning itself, oddly proud of its crumb tray. Neither of you bothers the other.', fail: 'You mistake a shiny hubcap for open water and have a very confusing landing.' },
    ],
  },
}

export const GRID_SIZE = 9

export interface Tile { row: number; col: number; biome: BiomeId }

export function generateWorld(): Tile[][] {
  const roosts = new Set(['1,1', '4,7', '7,2'])
  const grid: Tile[][] = []
  for (let row = 0; row < GRID_SIZE; row++) {
    const line: Tile[] = []
    for (let col = 0; col < GRID_SIZE; col++) {
      let biome: BiomeId
      if (row === 6 && col === 4) biome = 'town'
      else if (roosts.has(`${row},${col}`)) biome = 'roost'
      else if (col === 4) biome = 'river'
      else if (row <= 1) biome = 'hill'
      else if (row <= 3) biome = 'lake'
      else if (row <= 5) biome = 'spring'
      else if (row === 6) biome = 'farmland'
      else biome = 'delta'
      line.push({ row, col, biome })
    }
    grid.push(line)
  }
  return grid
}

export const START_POS = { row: 4, col: 4 }

export function maxWind(grit: number): number {
  return 8 + grit
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
