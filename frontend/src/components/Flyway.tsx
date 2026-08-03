import React, { useEffect, useMemo, useState } from 'react'
import {
  SPECIES, TRAITS, BIOMES, GRID_SIZE, START_POS,
  generateWorld, maxWind, rollUnder, pick,
  type Species, type Trait, type StatKey,
} from '../lib/flyway'

const CHAR_KEY = 'flyway-character-v1'
const STATE_KEY = 'flyway-state-v1'
const TILE_W = 56
const TILE_H = 28
const LOG_LIMIT = 8
const STAT_ABBR: Record<StatKey, string> = { flight: 'FLT', instinct: 'INS', charm: 'CHM', grit: 'GRT' }

interface Character { speciesId: string; traitIds: string[]; name: string }
interface LogEntry { id: number; text: string; tone: 'success' | 'fail' | 'info' }
interface GameState { row: number; col: number; wind: number; discovered: string[]; log: LogEntry[] }

function loadCharacter(): Character | null {
  try {
    const raw = localStorage.getItem(CHAR_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function loadState(fallbackWind: number): GameState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { row: START_POS.row, col: START_POS.col, wind: fallbackWind, discovered: [`${START_POS.row},${START_POS.col}`], log: [] }
}

function CharacterCreation({ onCreate }: { onCreate: (c: Character) => void }) {
  const [speciesId, setSpeciesId] = useState<string | null>(null)
  const [traitIds, setTraitIds] = useState<string[]>([])
  const [name, setName] = useState('')

  const toggleTrait = (id: string) => {
    setTraitIds(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const canConfirm = !!speciesId && traitIds.length === 2 && name.trim().length > 0

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Isopolis: Flyway</h2>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>
          Become a bird. Fly free over the Central Texas basins - Hill Country ridges, the Highland Lakes, the spring-fed
          Comal and San Marcos, the Mission Reach, and out to the Brazos floodplain. Roll-under mechanic inspired by <em>I, Toaster</em>.
        </p>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>1. Choose your species</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {SPECIES.map(s => (
            <button key={s.id} onClick={() => setSpeciesId(s.id)}
              style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: speciesId === s.id ? '2px solid var(--accent)' : '1px solid var(--border)', background: speciesId === s.id ? 'rgba(0,114,178,0.08)' : 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: 20 }}>{s.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>{s.epithet}</div>
              <div style={{ fontSize: 11, marginTop: 6, fontFamily: 'monospace', color: 'var(--dim)' }}>
                FLT {s.stats.flight} · INS {s.stats.instinct} · CHM {s.stats.charm} · GRT {s.stats.grit}
              </div>
            </button>
          ))}
        </div>
        {speciesId && <p style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>{SPECIES.find(s => s.id === speciesId)?.blurb}</p>}
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>2. Pick 2 traits ({traitIds.length}/2)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TRAITS.map(t => {
            const active = traitIds.includes(t.id)
            const disabled = !active && traitIds.length >= 2
            return (
              <button key={t.id} onClick={() => toggleTrait(t.id)} disabled={disabled}
                title={t.blurb}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, border: active ? '2px solid var(--accent)' : '1px solid var(--border)', background: active ? 'rgba(0,114,178,0.08)' : 'white', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>3. Name your bird</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Skeet" maxLength={24}
          style={{ width: '100%', maxWidth: 280, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14 }} />
      </div>

      <button onClick={() => canConfirm && onCreate({ speciesId: speciesId!, traitIds, name: name.trim() })}
        disabled={!canConfirm}
        style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 999, border: 'none', background: canConfirm ? 'var(--text)' : 'var(--border)', color: 'white', fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
        Take flight
      </button>
    </div>
  )
}

export function Flyway() {
  const [character, setCharacter] = useState<Character | null>(() => loadCharacter())
  const species: Species | undefined = useMemo(() => SPECIES.find(s => s.id === character?.speciesId), [character])
  const traits: Trait[] = useMemo(() => TRAITS.filter(t => character?.traitIds.includes(t.id)), [character])
  const world = useMemo(() => generateWorld(), [])

  const [game, setGame] = useState<GameState>(() => loadState(species ? maxWind(species.stats.grit) : 12))
  const [nextLogId, setNextLogId] = useState(1)

  useEffect(() => {
    if (character) localStorage.setItem(CHAR_KEY, JSON.stringify(character))
  }, [character])

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(game))
  }, [game])

  const maxW = species ? maxWind(species.stats.grit) : 0
  const discoveredSet = new Set(game.discovered)

  const addLog = (text: string, tone: LogEntry['tone']) => {
    setNextLogId(id => id + 1)
    setGame(g => ({ ...g, log: [{ id: nextLogId, text, tone }, ...g.log].slice(0, LOG_LIMIT) }))
  }

  const move = (dr: number, dc: number) => {
    if (!species) return
    const nr = Math.min(GRID_SIZE - 1, Math.max(0, game.row + dr))
    const nc = Math.min(GRID_SIZE - 1, Math.max(0, game.col + dc))
    if (nr === game.row && nc === game.col) return

    if (game.wind <= 0) {
      setGame(g => ({ ...g, wind: Math.min(maxW, g.wind + 3) }))
      addLog('Too exhausted to fly further - you glide down and catch your breath.', 'fail')
      return
    }

    const tile = world[nr][nc]
    const key = `${nr},${nc}`
    const biome = BIOMES[tile.biome]

    if (tile.biome === 'roost') {
      setGame(g => ({ ...g, row: nr, col: nc, wind: maxW }))
      addLog('You land at a quiet roost and fully recover your wind.', 'info')
      return
    }

    setGame(g => ({ ...g, row: nr, col: nc, wind: g.wind - 1 }))

    if (!discoveredSet.has(key)) {
      setGame(g => ({ ...g, discovered: [...g.discovered, key] }))
      const enc = pick(biome.encounters)
      const bonus = traits.filter(t => t.bonusStat === enc.stat).length
      const statVal = species!.stats[enc.stat]
      const result = rollUnder(statVal, bonus)
      const statLabel: Record<StatKey, string> = { flight: 'Flight', instinct: 'Instinct', charm: 'Charm', grit: 'Grit' }
      const suffix = `(2D6=${result.roll}${bonus ? ` -${bonus} trait` : ''} vs ${statLabel[enc.stat]} ${statVal})`
      addLog(`${biome.label}: ${result.success ? enc.success : enc.fail} ${suffix}`, result.success ? 'success' : 'fail')
    } else {
      addLog(`Back over ${biome.label.toLowerCase()}. ${biome.description}`, 'info')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') move(-1, 0)
      else if (e.key === 'ArrowDown' || e.key === 's') move(1, 0)
      else if (e.key === 'ArrowLeft' || e.key === 'a') move(0, -1)
      else if (e.key === 'ArrowRight' || e.key === 'd') move(0, 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, game.row, game.col, game.wind])

  if (!character || !species) {
    return <CharacterCreation onCreate={(c) => {
      setCharacter(c)
      const sp = SPECIES.find(s => s.id === c.speciesId)!
      const initWind = maxWind(sp.stats.grit)
      const fresh: GameState = { row: START_POS.row, col: START_POS.col, wind: initWind, discovered: [`${START_POS.row},${START_POS.col}`], log: [] }
      setGame(fresh)
    }} />
  }

  const releaseBird = () => {
    if (!window.confirm(`Release ${character.name} back into the wild? This clears your saved bird and progress.`)) return
    localStorage.removeItem(CHAR_KEY)
    localStorage.removeItem(STATE_KEY)
    setCharacter(null)
  }

  const offsetX = (GRID_SIZE - 1) * (TILE_W / 2)
  const containerW = 2 * (GRID_SIZE - 1) * (TILE_W / 2) + TILE_W
  const containerH = 2 * (GRID_SIZE - 1) * (TILE_H / 2) + TILE_H

  const tilePos = (row: number, col: number) => ({
    left: (col - row) * (TILE_W / 2) + offsetX,
    top: (col + row) * (TILE_H / 2),
  })

  const birdPos = tilePos(game.row, game.col)
  const statLabel: Record<StatKey, string> = { flight: 'Flight', instinct: 'Instinct', charm: 'Charm', grit: 'Grit' }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{species.emoji} {character.name}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>{species.name} · {species.epithet} · {traits.map(t => t.label).join(' + ')}</div>
        </div>
        <button onClick={releaseBird} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'white', color: 'var(--dim)' }}>Release bird</button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>
          <span>Wind</span><span>{game.wind} / {maxW}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(game.wind / maxW) * 100}%`, background: game.wind > maxW * 0.3 ? 'var(--accent)' : 'var(--safe-red)', transition: 'width 0.2s' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, fontFamily: 'monospace', color: 'var(--dim)' }}>
          {(Object.keys(species.stats) as StatKey[]).map(k => (
            <span key={k}>{STAT_ABBR[k]} {species.stats[k]}{traits.some(t => t.bonusStat === k) ? '+' : ''}</span>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: containerW, height: containerH, flexShrink: 0 }}>
          {world.flat().map(tile => {
            const { left, top } = tilePos(tile.row, tile.col)
            const biome = BIOMES[tile.biome]
            const isHere = tile.row === game.row && tile.col === game.col
            const isDiscovered = discoveredSet.has(`${tile.row},${tile.col}`)
            const isAdjacent = Math.abs(tile.row - game.row) + Math.abs(tile.col - game.col) === 1
            return (
              <div key={`${tile.row},${tile.col}`}
                onClick={() => isAdjacent && move(tile.row - game.row, tile.col - game.col)}
                title={biome.label}
                style={{
                  position: 'absolute', left, top, width: TILE_W, height: TILE_H,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  background: biome.color,
                  opacity: isDiscovered ? 0.95 : 0.45,
                  outline: isHere ? '2px solid white' : isAdjacent ? '1px solid rgba(255,255,255,0.6)' : 'none',
                  outlineOffset: -2,
                  cursor: isAdjacent ? 'pointer' : 'default',
                }}
              />
            )
          })}
          <div style={{
            position: 'absolute', left: birdPos.left + TILE_W / 2 - 12, top: birdPos.top + TILE_H / 2 - 14,
            fontSize: 20, transition: 'left 0.2s, top 0.2s', pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
          }}>{species.emoji}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button onClick={() => move(-1, 0)} style={dpadStyle}>▲</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => move(0, -1)} style={dpadStyle}>◀</button>
          <button onClick={() => move(1, 0)} style={dpadStyle}>▼</button>
          <button onClick={() => move(0, 1)} style={dpadStyle}>▶</button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>Arrow keys / WASD, or tap an adjacent tile</div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Flight log</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {game.log.length === 0 && <div style={{ fontSize: 12, color: 'var(--dim)' }}>Take off and see what you find.</div>}
          {game.log.map(entry => (
            <div key={entry.id} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, background: 'var(--surface-2)', borderLeft: `3px solid ${entry.tone === 'success' ? 'var(--safe-green)' : entry.tone === 'fail' ? 'var(--safe-red)' : 'var(--dim)'}` }}>
              {entry.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const dpadStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 14, cursor: 'pointer',
}
