/**
 * novatar — deterministic generative SVG avatars for humans and AI agents.
 *
 * One package, two engines, one identity model:
 *   engine "avatars"    → 21 generative variants (gradient / fluid / classic / paletteless)
 *                         adapted from SpaceUI (MIT)
 *   engine "duo" → 21 shapes × 22 expressions × 6 backgrounds
 *                         adapted from SpaceUI (MIT)
 *
 * The same seed always produces the same avatar on every machine, runtime,
 * and version of this package (within a major version).
 */

// ---------------------------------------------------------------------------
// Vendored palette engine (bit-exact with the adapted palette engine)
// ---------------------------------------------------------------------------
export { generatePalette, PaletteMode } from './palette'
export type { GeneratePaletteOptions, GeneratedPalette } from './palette'

// ---------------------------------------------------------------------------
// Raster & animation exports (SVG → PNG / WebP / animated SVG / APNG / GIF)
// ---------------------------------------------------------------------------
export { renderPng, renderPixmap, renderWebp } from './raster'
export type { RenderPngOptions, RenderWebpOptions, RasterPixmap } from './raster'
export {
  solveAnimationFrames,
  renderAnimatedSvg,
  renderAnimatedGif,
  renderAnimatedApng,
} from './animation'
export type { AnimatedAvatarOptions, RasterAnimationOptions, AnimationFrame } from './animation'

// ---------------------------------------------------------------------------
// Engine: avatars (drop-in compat surface)
// ---------------------------------------------------------------------------
export * from './engines/avatars'

// ---------------------------------------------------------------------------
// Engine: duo (character-engine API)
// ---------------------------------------------------------------------------
export * from './engines/duo'

import { createAvatar } from './engines/avatars'
import { createDuo } from './engines/duo'
import { SHAPE_VALUES, EXPRESSION_VALUES, BACKGROUND_STYLE_VALUES } from './engines/duo'
import type { DuoOptions, DuoJson } from './engines/duo'
import {
  AvatarFamily,
  getFamilyVariants,
} from './engines/avatars'
import type { AvatarJson, CreateAvatarOptions } from './engines/avatars'

// ---------------------------------------------------------------------------
// Unified API
// ---------------------------------------------------------------------------

export const NovatarEngine = {
  avatars: 'avatars',
  duo: 'duo',
} as const
export type NovatarEngineId = (typeof NovatarEngine)[keyof typeof NovatarEngine]
export type NovatarEngineChoice = NovatarEngineId | 'auto'

export const NovatarOutputFormat = {
  svg: 'svg',
  json: 'json',
} as const
export type NovatarOutputFormat = (typeof NovatarOutputFormat)[keyof typeof NovatarOutputFormat]

const ENGINE_ALIASES: Record<string, NovatarEngineId> = {
  avatars: NovatarEngine.avatars,
  avatar: NovatarEngine.avatars,
  art: NovatarEngine.avatars,
  duo: NovatarEngine.duo,
  emoji: NovatarEngine.duo,
  character: NovatarEngine.duo,
}

const ENGINES: readonly NovatarEngineId[] = [NovatarEngine.avatars, NovatarEngine.duo]

/** Stable default identity seed. */
export const DEFAULT_SEED = 'Space UI'

function fnv1a(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

export interface NovatarOptions {
  /** Deterministic identity. Same seed → same avatar, forever. Defaults to "Space UI". */
  seed?: string
  /**
   * Which engine renders the avatar: "avatars" (21 variants), "duo"
   * (shapes × expressions), or "auto" to pick deterministically from the seed.
   * Aliases: "duo", "emoji", "avatar", "art".
   */
  engine?: NovatarEngineChoice | string
  /** Output format: "svg" (default) or "json". PNG is available via the CLI / raster module. */
  format?: NovatarOutputFormat | 'svg' | 'json'
  /** Rendered size in pixels. Omitted → each engine's native default. */

  // --- engine "avatars" options -------------------------------------------
  /** Variant id ("triton"), family ("fluid"), or "all". Ignored by duo. */
  variant?: string
  /** Clip to a full circle (avatars engine only). */
  circle?: boolean
  /** Post-processing effect: "none" (default) or "noise" (avatars engine only). */
  effect?: string
  /** Exactly 5 hex colors; overrides the seeded palette on both engines. */
  colors?: readonly string[]
  /** Enable animation where the variant supports it (avatars engine only). */
  animate?: boolean

  // --- engine "duo" options ----------------------------------------
  /** Body shape id or "all" (duo engine only). */
  shape?: string
  /** Expression id or "all" (duo engine only). */
  expression?: string
  /** Background style id or "all" (duo engine only). */
  backgroundStyle?: string
  size?: number
}

export interface NovatarJson {
  seed: string
  engine: NovatarEngineId
  /** Complete standalone SVG markup. */
  svg: string
  /** Ready-to-use `data:image/svg+xml` URI. */
  dataUri: string
  // Present when engine === "avatars":
  variant?: string
  circle?: boolean
  effect?: string
  animate?: boolean
  // Present when engine === "duo":
  shape?: string
  expression?: string
  backgroundStyle?: string
  layout?: DuoJson['layout']
}

/** Normalizes engine aliases and picks deterministically for "auto". */
export function resolveEngine(seed: string, engine?: NovatarEngineChoice | string): NovatarEngineId {
  if (!engine || engine === 'auto') {
    const hash = fnv1a(`${seed}|novatar-engine-picker`)
    return ENGINES[hash % ENGINES.length]
  }
  const id = ENGINE_ALIASES[String(engine).trim().toLowerCase()]
  if (!id) {
    throw new RangeError(`Unknown engine: ${String(engine)}. Use "avatars", "duo", or "auto".`)
  }
  return id
}

export function createNovatar(options: NovatarOptions & { format: 'json' | NovatarOutputFormat }): NovatarJson
export function createNovatar(options?: NovatarOptions & { format?: 'svg' | NovatarOutputFormat }): string
export function createNovatar(options: NovatarOptions = {}): string | NovatarJson {
  const format = options.format ?? NovatarOutputFormat.svg
  if (format !== NovatarOutputFormat.svg && format !== NovatarOutputFormat.json) {
    throw new RangeError(`Unknown output format: ${String(format)}`)
  }

  const seed = (options.seed && options.seed.trim()) || DEFAULT_SEED
  const engine = resolveEngine(seed, options.engine)

  if (engine === NovatarEngine.duo) {
    const duoOptions: Omit<DuoOptions, 'format'> = {
      seed,
      size: options.size,
      shape: options.shape as DuoOptions['shape'],
      expression: options.expression as DuoOptions['expression'],
      backgroundStyle: options.backgroundStyle as DuoOptions['backgroundStyle'],
      colors: options.colors,
    }
    if (format === NovatarOutputFormat.json) {
      const json = createDuo({ ...duoOptions, format: 'json' })
      return {
        seed: json.seed,
        engine,
        svg: json.svg,
        dataUri: json.dataUri,
        shape: json.shape,
        expression: json.expression,
        backgroundStyle: json.backgroundStyle,
        layout: json.layout,
      }
    }
    return createDuo(duoOptions)
  }

  const avatarOptions: Omit<CreateAvatarOptions, 'format'> = {
    name: seed,
    variant: options.variant as CreateAvatarOptions['variant'],
    size: options.size,
    circle: options.circle,
    effect: options.effect as CreateAvatarOptions['effect'],
    colors: options.colors,
    animate: options.animate,
  }
  if (format === NovatarOutputFormat.json) {
    const json = createAvatar({ ...avatarOptions, format: 'json' })
    return {
      seed: json.name,
      engine,
      svg: json.svg,
      dataUri: json.dataUri,
      variant: json.variant,
      circle: json.circle,
      effect: json.effect,
      animate: json.animate,
    }
  }
  return createAvatar(avatarOptions)
}

// ---------------------------------------------------------------------------
// Machine-readable catalog (agent introspection)
// ---------------------------------------------------------------------------

export interface NovatarEngineCatalog {
  id: NovatarEngineId
  description: string
  /** avatars engine: variants grouped by visual family. */
  families?: Record<string, string[]>
  variants?: string[]
  /** duo engine catalogs. */
  shapes?: string[]
  expressions?: string[]
  backgrounds?: string[]
}

export interface NovatarCatalog {
  engines: NovatarEngineCatalog[]
}

/** Returns the full style catalog for one or all engines as plain JSON data. */
export function listNovatarStyles(engine?: NovatarEngineChoice | string): NovatarCatalog {
  const wanted = engine && engine !== 'auto' ? resolveEngine('Space UI', engine) : undefined

  const avatarsCatalog: NovatarEngineCatalog = {
    id: NovatarEngine.avatars,
    description: 'Generative abstract & character avatars (21 variants, 4 families).',
    families: {
      [AvatarFamily.gradient]: getFamilyVariants(AvatarFamily.gradient),
      [AvatarFamily.fluid]: getFamilyVariants(AvatarFamily.fluid),
      [AvatarFamily.classic]: getFamilyVariants(AvatarFamily.classic),
      [AvatarFamily.paletteless]: getFamilyVariants(AvatarFamily.paletteless),
    },
    variants: [
      ...getFamilyVariants(AvatarFamily.gradient),
      ...getFamilyVariants(AvatarFamily.fluid),
      ...getFamilyVariants(AvatarFamily.classic),
      ...getFamilyVariants(AvatarFamily.paletteless),
    ],
  }

  const duoCatalog: NovatarEngineCatalog = {
    id: NovatarEngine.duo,
    description: 'Expressive character avatars (21 shapes × 22 expressions × 6 backgrounds).',
    shapes: [...SHAPE_VALUES],
    expressions: [...EXPRESSION_VALUES],
    backgrounds: [...BACKGROUND_STYLE_VALUES],
  }

  if (wanted === NovatarEngine.avatars) return { engines: [avatarsCatalog] }
  if (wanted === NovatarEngine.duo) return { engines: [duoCatalog] }
  return { engines: [avatarsCatalog, duoCatalog] }
}
