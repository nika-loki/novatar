/**
 * Deterministic palette generator vendored from @usespaceui/gradients (MIT, SpaceUI).
 * Kept bit-exact with upstream so avatars keep their exact colors:
 * same hash constants, same rng, same preset selection + rotation.
 */
import { BASE_COLORS, NICE_PALETTES, PRESET_PALETTES } from './data.ts'

export const PaletteMode = {
  presets: 'presets',
  random: 'random',
  nice: 'nice',
} as const
export type PaletteMode = (typeof PaletteMode)[keyof typeof PaletteMode]

export interface GeneratePaletteOptions {
  /** Selection strategy. Omitted → deterministic auto-pick from the seed. */
  mode?: PaletteMode
  /** Custom hex colors. When every entry is valid, they win over generation. */
  colors?: readonly string[]
}

export interface GeneratedPalette {
  seed: number
  colors: string[]
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 2146121005) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 2221713035) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

function toSeed(seed: number | string): number {
  return typeof seed === 'number' ? seed : hashString(seed)
}

function createPaletteRng(seed: number): () => number {
  let state = seed
  return () => {
    state += 1831565813
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  let hex = match[1]
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  return `#${hex.toUpperCase()}`
}

function normalizeCustomColors(colors: readonly string[] | undefined): string[] | null {
  if (!colors?.length) return null
  const normalized: string[] = []
  for (const color of colors) {
    const hex = normalizeHex(color)
    if (hex) normalized.push(hex)
  }
  return normalized.length ? normalized : null
}

function autoMode(rng: () => number): PaletteMode {
  const roll = rng()
  if (roll < 0.33) return PaletteMode.random
  if (roll < 0.66) return PaletteMode.presets
  return PaletteMode.nice
}

function randomPalette(seed: number, rng: () => number): GeneratedPalette {
  const pool = BASE_COLORS.map((entry) => entry.color)
  const colors: string[] = []
  const remaining = [...pool]
  for (let i = 0; i < 5 && remaining.length !== 0; i++) {
    const index = Math.floor(rng() * remaining.length)
    colors.push(remaining[index])
    remaining.splice(index, 1)
  }
  return { seed, colors }
}

function rotate(colors: readonly string[], by: number): string[] {
  return colors.map((_, index) => colors[(index + by) % colors.length])
}

function presetPalette(seed: number, custom: readonly string[] | undefined): GeneratedPalette {
  const normalized = normalizeCustomColors(custom)
  if (normalized) return { seed, colors: normalized }
  const preset = PRESET_PALETTES[seed % PRESET_PALETTES.length]
  return { seed, colors: rotate(preset.colors, seed % preset.colors.length) }
}

function nicePalette(seed: number): GeneratedPalette {
  const palette = NICE_PALETTES[seed % NICE_PALETTES.length]
  return { seed, colors: rotate(palette.colors, seed % palette.colors.length) }
}

export function generatePalette(
  seed?: number | string,
  options: GeneratePaletteOptions = {},
): GeneratedPalette {
  const resolvedSeed = seed !== undefined ? seed : Math.random().toString(36).substring(2, 10)
  const seedInt = toSeed(resolvedSeed)
  const rng = createPaletteRng(seedInt)
  const mode = options.mode || autoMode(rng)
  if (mode === PaletteMode.random) return randomPalette(seedInt, rng)
  if (mode === PaletteMode.nice) return nicePalette(seedInt)
  return presetPalette(seedInt, options.colors)
}
