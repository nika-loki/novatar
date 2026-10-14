import type {
  SquishShape,
  SquishExpression,
  SquishBackgroundStyle,
  SquishShapeChoice,
  SquishExpressionChoice,
  SquishBackgroundStyleChoice,
} from './catalog'
import type { SquishLayout } from './layout'

/** Default deterministic seed used across Space UI avatar libraries. */
export const DEFAULT_SEED = 'Space UI'

/**
 * Output format supported by createAvatar.
 */
export const SquishOutputFormat = {
  svg: 'svg',
  json: 'json',
} as const

export type SquishOutputFormat = (typeof SquishOutputFormat)[keyof typeof SquishOutputFormat]

/** Compatibility alias */
export const AvatarOutputFormat = SquishOutputFormat
export type AvatarOutputFormat = SquishOutputFormat

/**
 * Structured JSON representation of a generated squish.
 */
export interface SquishJson {
  /** Deterministic identity seed. */
  seed: string
  /** Physical shape profile. */
  shape: SquishShape
  /** Facial expression of the avatar. */
  expression: SquishExpression
  /** Rendered size in pixels if specified. */
  size?: number
  /** Applied background style. */
  backgroundStyle: SquishBackgroundStyle
  /** Complete standalone SVG markup. */
  svg: string
  /** Ready-to-use Data URI string. */
  dataUri: string
  /** Calculated internal geometric layout data. */
  layout: SquishLayout
}

/** Compatibility alias */
export type AvatarJson = SquishJson

/**
 * Options used to customize the deterministic generation of a squish.
 */
export interface SquishOptions {
  /** Deterministic avatar identity seed (used when passing a single options object). */
  seed?: string
  /** The size in pixels of the rendered avatar SVG (width and height). */
  size?: number
  /** Shape id, or `"all"` to pick deterministically from the seed. Defaults to circle. */
  shape?: SquishShapeChoice
  /** Expression id, or `"all"` to pick deterministically from the seed. Defaults to neutral. */
  expression?: SquishExpressionChoice
  /** Background style, or `"all"` to pick deterministically from the seed. Defaults to solid. */
  backgroundStyle?: SquishBackgroundStyleChoice
  /**
   * Exactly 5 hexadecimal colors. When provided, they override the palette
   * generated from the seed (novatar extension — upstream is seeded-only).
   * The seed still drives geometry, so the shape stays identical.
   */
  colors?: readonly string[]
  /** Output format ("svg" or "json"). Defaults to "svg". */
  format?: SquishOutputFormat | 'svg' | 'json'
}
