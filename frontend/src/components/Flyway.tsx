import React, { useEffect, useMemo, useRef, useState } from 'react'
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
const STAT_LABEL: Record<StatKey, string> = { flight: 'Flight', instinct: 'Instinct', charm: 'Charm', grit: 'Grit' }
const FLASH_MS = 650
const OFFSET_X = (GRID_SIZE - 1) * (TILE_W / 2)
const WORLD_W = GRID_SIZE * TILE_W
const WORLD_H = GRID_SIZE * TILE_H
const VIEWPORT_W = 380
const VIEWPORT_H = 220

function tilePos(row: number, col: number) {
  return { left: (col - row) * (TILE_W / 2) + OFFSET_X, top: (col + row) * (TILE_H / 2) }
}

interface Character { speciesId: string; traitIds: string[]; name: string }
interface LogEntry { id: number; text: string; tone: 'success' | 'fail' | 'info' }
interface GameState { row: number; col: number; wind: number; discovered: string[]; log: LogEntry[] }
interface FlashState { key: string; tone: 'success' | 'fail' }

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
    <div className="flyway-root" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center', padding: '12px 8px 4px' }}>
        <div className="flyway-pixel" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 10 }}>ISOPOLIS</div>
        <h2 className="flyway-pixel" style={{ fontSize: 15, fontWeight: 400, margin: 0, lineHeight: 1.6 }}>FLYWAY</h2>
        <p style={{ fontSize: 15, color: 'var(--dim)', marginTop: 8, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
          Become a bird. Fly free over the actual rivers and lakes this app tracks, full scale - the Highland Lakes chain
          down the Colorado through Austin, the spring-fed Guadalupe/Comal/San Marcos, the San Antonio missions, the
          Hill Country headwaters, and out to the Brazos and the coast. Roll-under mechanic inspired by <em>I, Toaster</em>.
        </p>
      </div>

      <div>
        <div className="flyway-pixel" style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 8 }}>1. CHOOSE YOUR SPECIES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {SPECIES.map(s => (
            <button key={s.id} onClick={() => setSpeciesId(s.id)}
              aria-pressed={speciesId === s.id}
              style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: speciesId === s.id ? '2px solid var(--accent)' : '1px solid var(--border)', background: speciesId === s.id ? 'rgba(0,114,178,0.08)' : 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: 20 }}>{s.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>{s.epithet}</div>
              <div style={{ fontSize: 13, marginTop: 6, fontFamily: 'ui-monospace, monospace', color: 'var(--dim)' }}>
                FLT {s.stats.flight} · INS {s.stats.instinct} · CHM {s.stats.charm} · GRT {s.stats.grit}
              </div>
            </button>
          ))}
        </div>
        {speciesId && <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 8 }}>{SPECIES.find(s => s.id === speciesId)?.blurb}</p>}
      </div>

      <div>
        <div className="flyway-pixel" style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 8 }}>2. PICK 2 TRAITS ({traitIds.length}/2)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TRAITS.map(t => {
            const active = traitIds.includes(t.id)
            const disabled = !active && traitIds.length >= 2
            return (
              <button key={t.id} onClick={() => toggleTrait(t.id)} disabled={disabled}
                aria-pressed={active}
                title={t.blurb}
                style={{ fontSize: 14, padding: '6px 12px', borderRadius: 999, border: active ? '2px solid var(--accent)' : '1px solid var(--border)', background: active ? 'rgba(0,114,178,0.08)' : 'white', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="flyway-pixel" style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 8 }}>3. NAME YOUR BIRD</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Skeet" maxLength={24}
          aria-label="Bird name"
          style={{ width: '100%', maxWidth: 280, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 16 }} />
      </div>

      <button onClick={() => canConfirm && onCreate({ speciesId: speciesId!, traitIds, name: name.trim() })}
        disabled={!canConfirm}
        className="flyway-pixel"
        style={{ alignSelf: 'flex-start', padding: '14px 20px', borderRadius: 10, border: 'none', background: canConfirm ? 'var(--text)' : 'var(--border)', color: 'white', fontSize: 11, cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
        TAKE FLIGHT
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
  const [flash, setFlash] = useState<FlashState | null>(null)
  const [confirmingRelease, setConfirmingRelease] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (character) localStorage.setItem(CHAR_KEY, JSON.stringify(character))
  }, [character])

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(game))
  }, [game])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const available = el.clientWidth
      if (available <= 0) return
      setScale(Math.min(1, available / VIEWPORT_W))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [species])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(id)
  }, [flash])

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

    const placeName = tile.poi ?? biome.label

    if (!discoveredSet.has(key)) {
      setGame(g => ({ ...g, discovered: [...g.discovered, key] }))
      const enc = pick(biome.encounters)
      const bonus = traits.filter(t => t.bonusStat === enc.stat).length
      const statVal = species.stats[enc.stat]
      const result = rollUnder(statVal, bonus)
      const suffix = `(2D6=${result.roll}${bonus ? ` -${bonus} trait` : ''} vs ${STAT_LABEL[enc.stat]} ${statVal})`
      addLog(`${placeName}: ${result.success ? enc.success : enc.fail} ${suffix}`, result.success ? 'success' : 'fail')
      setFlash({ key, tone: result.success ? 'success' : 'fail' })
    } else {
      addLog(`Back over ${tile.poi ?? biome.label.toLowerCase()}. ${biome.description}`, 'info')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
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

  const confirmRelease = () => {
    localStorage.removeItem(CHAR_KEY)
    localStorage.removeItem(STATE_KEY)
    setConfirmingRelease(false)
    setCharacter(null)
  }

  const birdPos = tilePos(game.row, game.col)

  return (
    <div className="flyway-root" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{species.emoji} {character.name}</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>{species.name} · {species.epithet} · {traits.map(t => t.label).join(' + ')}</div>
        </div>
        <button onClick={() => setConfirmingRelease(true)} aria-label="Release bird" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'white', color: 'var(--dim)' }}>Release bird</button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--dim)', marginBottom: 4 }}>
          <span>Wind</span><span>{game.wind} / {maxW}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }} role="progressbar" aria-valuenow={game.wind} aria-valuemin={0} aria-valuemax={maxW} aria-label="Wind remaining">
          <div style={{ height: '100%', width: `${(game.wind / maxW) * 100}%`, background: game.wind > maxW * 0.3 ? 'var(--accent)' : 'var(--safe-red)', transition: 'width 0.2s' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 13, fontFamily: 'ui-monospace, monospace', color: 'var(--dim)' }}>
          {(Object.keys(species.stats) as StatKey[]).map(k => (
            <span key={k}>{STAT_ABBR[k]} {species.stats[k]}{traits.some(t => t.bonusStat === k) ? '+' : ''}</span>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: VIEWPORT_W * scale, height: VIEWPORT_H * scale, flexShrink: 0 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: VIEWPORT_W, height: VIEWPORT_H,
            overflow: 'hidden', borderRadius: 16, background: '#CBD5C0',
            transform: `scale(${scale})`, transformOrigin: 'top left',
          }}>
            <div style={{
              position: 'absolute',
              left: VIEWPORT_W / 2 - (birdPos.left + TILE_W / 2),
              top: VIEWPORT_H / 2 - (birdPos.top + TILE_H / 2),
              width: WORLD_W, height: WORLD_H,
              transition: 'left 0.2s, top 0.2s',
            }}>
              {world.flat().map(tile => {
                const { left, top } = tilePos(tile.row, tile.col)
                const biome = BIOMES[tile.biome]
                const key = `${tile.row},${tile.col}`
                const placeName = tile.poi ?? biome.label
                const isHere = tile.row === game.row && tile.col === game.col
                const isDiscovered = discoveredSet.has(key)
                const isAdjacent = Math.abs(tile.row - game.row) + Math.abs(tile.col - game.col) === 1
                const isFlashing = flash?.key === key
                const flashClass = isFlashing ? (flash!.tone === 'success' ? 'flyway-flash-success flyway-tile-pop' : 'flyway-flash-fail flyway-tile-pop') : ''
                return (
                  <div key={key}
                    className={flashClass}
                    onClick={() => isAdjacent && move(tile.row - game.row, tile.col - game.col)}
                    role={isAdjacent ? 'button' : undefined}
                    aria-label={isAdjacent ? `Fly to ${placeName}` : undefined}
                    title={placeName}
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
            </div>
            <div style={{
              position: 'absolute', left: VIEWPORT_W / 2 - 12, top: VIEWPORT_H / 2 - 14,
              fontSize: 20, pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
            }}>{species.emoji}</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center' }}>
        Currently over {world[game.row][game.col].poi ?? BIOMES[world[game.row][game.col].biome].label}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button onClick={() => move(-1, 0)} aria-label="Fly north" style={dpadStyle}>▲</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => move(0, -1)} aria-label="Fly west" style={dpadStyle}>◀</button>
          <button onClick={() => move(1, 0)} aria-label="Fly south" style={dpadStyle}>▼</button>
          <button onClick={() => move(0, 1)} aria-label="Fly east" style={dpadStyle}>▶</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>Arrow keys / WASD, or tap an adjacent tile</div>
      </div>

      <div>
        <div className="flyway-pixel" style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>FLIGHT LOG</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {game.log.length === 0 && <div style={{ fontSize: 14, color: 'var(--dim)' }}>Take off and see what you find.</div>}
          {game.log.map(entry => (
            <div key={entry.id} style={{ fontSize: 14, padding: '6px 10px', borderRadius: 10, background: 'var(--surface-2)', borderLeft: `3px solid ${entry.tone === 'success' ? 'var(--safe-green)' : entry.tone === 'fail' ? 'var(--safe-red)' : 'var(--dim)'}` }}>
              {entry.text}
            </div>
          ))}
        </div>
      </div>

      {confirmingRelease && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setConfirmingRelease(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 340, borderRadius: 16, border: '1px solid var(--border)', background: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Release {character.name}?</div>
            <p style={{ fontSize: 14, color: 'var(--dim)', marginTop: 8 }}>This clears your saved bird and progress. You'll start a new character next time.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmingRelease(false)} style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--border)', background: 'white', fontSize: 14 }}>Cancel</button>
              <button onClick={confirmRelease} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', background: 'var(--safe-red)', color: 'white', fontSize: 14, fontWeight: 700 }}>Release</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dpadStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 16, cursor: 'pointer',
}
