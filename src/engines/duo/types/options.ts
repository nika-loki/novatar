import type {
  DuoShape,
  DuoExpression,
  DuoBackgroundStyle,
  DuoShapeChoice,
  DuoExpressionChoice,
  DuoBackgroundStyleChoice,
} from './catalog'
import type { DuoLayout } from './layout'

/** Default deterministic seed used across Space UI avatar libraries. */
export const DEFAULT_SEED = 'Space UI'

/**
 * Output format supported by createAvatar.
 */
export const DuoOutputFormat = {
  svg: 'svg',
  json: 'json',
} as const

export type DuoOutputFormat = (typeof DuoOutputFormat)[keyof typeof DuoOutputFormat]

/** Compatibility alias */
export const AvatarOutputFormat = DuoOutputFormat
export type AvatarOutputFormat = DuoOutputFormat

/**
 * Structured JSON representation of a generated duo.
 */
export interface DuoJson {
  /** Deterministic identity seed. */
  seed: string
  /** Physical shape profile. */
  shape: DuoShape
  /** Facial expression of the avatar. */
  expression: DuoExpression
  /** Rendered size in pixels if specified. */
  size?: number
  /** Applied background style. */
  backgroundStyle: DuoBackgroundStyle
  /** Complete standalone SVG markup. */
  svg: string
  /** Ready-to-use Data URI string. */
  dataUri: string
  /** Calculated internal geometric layout data. */
  layout: DuoLayout
}

/** Compatibility alias */
export type AvatarJson = DuoJson

/**
 * Options used to customize the deterministic generation of a duo.
 */
export interface DuoOptions {
  /** Deterministic avatar identity seed (used when passing a single options object). */
  seed?: string
  /** The size in pixels of the rendered avatar SVG (width and height). */
  size?: number
  /** Shape id, or `"all"` to pick deterministically from the seed. Defaults to circle. */
  shape?: DuoShapeChoice
  /** Expression id, or `"all"` to pick deterministically from the seed. Defaults to neutral. */
  expression?: DuoExpressionChoice
  /** Background style, or `"all"` to pick deterministically from the seed. Defaults to solid. */
  backgroundStyle?: DuoBackgroundStyleChoice
  /**
   * Exactly 5 hexadecimal colors. When provided, they override the palette
   * generated from the seed (novatar extension — upstream is seeded-only).
   * The seed still drives geometry, so the shape stays identical.
   */
  colors?: readonly string[]
  /** Output format ("svg" or "json"). Defaults to "svg". */
  format?: DuoOutputFormat | 'svg' | 'json'
}
