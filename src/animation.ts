/**
 * Animated avatar exports — animated SVG (SMIL), APNG, and GIF.
 *
 * The React <Squish /> component animates via requestAnimationFrame;
 * these exporters reproduce its exact steady-state motion (autonomous
 * blinking + gaze drift, optional wobble) as pure functions of time, so
 * every format shows identical movement:
 *
 *   - renderAnimatedSvg: declarative SMIL keyframes, zero rasterization,
 *     infinitely looping, tiny files. Works inside GitHub README <img>.
 *   - renderAnimatedGif / renderAnimatedApng: the same frame solver
 *     rasterized frame-by-frame (resvg) and encoded with gifenc / upng-js.
 *
 * Loop locking: the autonomous blink runs on a fixed 4.7 s cycle; the gaze
 * drift is loop-locked to one sweep per cycle so finite exports (and the
 * SMIL keyframe list) wrap seamlessly. Durations are snapped to a multiple
 * of the blink cycle for the same reason.
 */
import { renderLayout } from './engines/squish/core/render'
import { backgroundMarkup } from './engines/squish/engine/backgrounds'
import { stableId, escapeXml, format } from './engines/squish/core/svg'
import { resolveBackgroundStyle } from './engines/squish/core/resolve'
import { resolveLayout } from './engines/squish/engine/layout'
import { BACKGROUND_STYLES, type SquishOptions, type SquishLayout } from './engines/squish/types'
import { renderPixmap } from './raster'

// Motion constants mirrored from the React component (Squish.tsx).
const BLINK_PERIOD = 4.7
const BLINK_PHASE_OFFSET = 1.35
const BLINK_OPEN_WINDOW = 0.18
const BLINK_SHUTTER = 0.09
const LID_MIN = 0.035
const GAZE_X_AMPLITUDE = 12.4
const GAZE_Y_AMPLITUDE = 9.6
const GAZE_X_PHASE = 0.8
const GAZE_Y_PHASE = 2.2
const WOBBLE_AMPLITUDE = 1.5
const WOBBLE_ROTATION = 0.45

export interface AnimatedAvatarOptions {
  /** Deterministic identity. Same seed → same avatar and same motion. */
  seed: string
  /** Body shape id or "all". Defaults like createSquish. */
  shape?: string
  /** Expression id or "all". */
  expression?: string
  /** Background style id or "all". */
  backgroundStyle?: string
  /** Exactly 5 hex colors overriding the seeded palette. */
  colors?: readonly string[]
  /** Frames per second for raster + SMIL keyframe sampling. Default 12. */
  fps?: number
  /**
   * Loop duration in seconds. Snapped to a multiple of the 4.7 s blink
   * cycle (minimum 4.7) so loops stay seamless. Default 4.7.
   */
  duration?: number
  /** Adds the gentle floating wobble transform (off by default, as in React). */
  wobble?: boolean
}

/** One solved animation frame: the eye layout transforms at time t. */
export interface AnimationFrame {
  time: number
  /** The full layout with time-adjusted eyes (body is constant). */
  layout: SquishLayout
}

function lidAt(time: number): number {
  const phase = (time + BLINK_PHASE_OFFSET) % BLINK_PERIOD
  if (phase > BLINK_OPEN_WINDOW) return 1
  return Math.max(LID_MIN, Math.abs(phase / BLINK_SHUTTER - 1))
}

function driftAt(time: number, loop: number): { x: number; y: number } {
  // Loop-locked single sweep per cycle (native drift periods 9.8 s / 14.6 s
  // share no finite period with the blink, so exports lock to the loop).
  const angle = (2 * Math.PI * time) / loop
  return {
    x: Math.sin(angle + GAZE_X_PHASE) * GAZE_X_AMPLITUDE,
    y: Math.sin(angle + GAZE_Y_PHASE) * GAZE_Y_AMPLITUDE,
  }
}

function wobbleAt(time: number, loop: number): string {
  const angle = (2 * Math.PI * time) / loop
  return `translate(${(Math.sin(angle * 2) * WOBBLE_AMPLITUDE).toFixed(2)}px, ${(Math.cos(angle * 2) * WOBBLE_AMPLITUDE).toFixed(2)}px) rotate(${(Math.sin(angle) * WOBBLE_ROTATION).toFixed(3)}deg)`
}

function effectiveDuration(duration: number | undefined): number {
  const requested = duration ?? BLINK_PERIOD
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new RangeError('duration must be a positive number of seconds')
  }
  const cycles = Math.max(1, Math.round(requested / BLINK_PERIOD))
  return Number((cycles * BLINK_PERIOD).toFixed(10))
}

function effectiveFps(fps: number | undefined): number {
  const value = fps ?? 12
  if (!Number.isFinite(value) || value < 1 || value > 60) {
    throw new RangeError('fps must be a number between 1 and 60')
  }
  return value
}

function cloneLayoutWithEyes(layout: SquishLayout, eyes: SquishLayout['eyes']): SquishLayout {
  return { ...layout, eyes }
}

/**
 * Solves the animation loop as explicit frames. Frame i sits at
 * t = i · duration / frames; the loop wraps frame N → frame 0 seamlessly.
 */
export function solveAnimationFrames(options: AnimatedAvatarOptions): {
  frames: AnimationFrame[]
  duration: number
  fps: number
} {
  const duration = effectiveDuration(options.duration)
  const fps = effectiveFps(options.fps)
  const count = Math.max(2, Math.round(duration * fps))
  const base = resolveLayout(options.seed, options as SquishOptions)

  const frames: AnimationFrame[] = []
  for (let i = 0; i < count; i++) {
    const time = (i * duration) / count
    const lid = lidAt(time)
    const drift = driftAt(time, duration)
    const eyes = base.eyes.map((eye) => {
      const matrix = [...eye.matrix] as typeof eye.matrix
      matrix[3] *= lid
      matrix[4] += drift.x
      matrix[5] += drift.y
      return { ...eye, matrix }
    })
    frames.push({ time, layout: cloneLayoutWithEyes(base, eyes) })
  }
  return { frames, duration, fps }
}

// ---------------------------------------------------------------------------
// Baked eye geometry
//
// <animateTransform type="matrix"> is NOT part of the SMIL/SVG spec (only
// translate|scale|rotate|skewX|skewY are legal), so browsers ignore it. To
// animate the full per-frame eye affine we bake it into the capsule outline
// itself: the capsule is approximated with cubic beziers (which affine maps
// transform exactly), and the path `d` attribute is animated with <animate>,
// which every browser interpolates when the command structure matches.
// ---------------------------------------------------------------------------

const BEZIER_K = 0.5522847498307936

interface Point {
  x: number
  y: number
}

interface CapsuleSegment {
  command: 'M' | 'L' | 'C' | 'Z'
  points: Point[]
}

/** Capsule outline as M/L/C commands, mirroring the static capsulePath shape. */
function capsuleSegments(width: number, height: number): CapsuleSegment[] {
  const rx = Math.max(width, 0.01) / 2
  const ry = Math.max(height, 0.01) / 2
  const s = Math.min(rx, ry)
  const k = BEZIER_K * s

  // quarter-arc from a to b on a circle of radius s around center, sweep=1
  const arc = (a: Point, b: Point, center: Point): CapsuleSegment => {
    const u = { x: (a.x - center.x) / s, y: (a.y - center.y) / s }
    const v = { x: (b.x - center.x) / s, y: (b.y - center.y) / s }
    // sweep=1 tangent at a point p is perp(p − center) = (−dy, dx)
    const c1 = { x: a.x + k * -u.y, y: a.y + k * u.x }
    const c2 = { x: b.x - k * -v.y, y: b.y - k * v.x }
    return { command: 'C', points: [c1, c2, b] }
  }

  const p0 = { x: -rx, y: -ry + s }
  const p1 = { x: -rx + s, y: -ry }
  const p2 = { x: rx - s, y: -ry }
  const p3 = { x: rx, y: -ry + s }
  const p4 = { x: rx, y: ry - s }
  const p5 = { x: rx - s, y: ry }
  const p6 = { x: -rx + s, y: ry }
  const p7 = { x: -rx, y: ry - s }

  return [
    { command: 'M', points: [p0] },
    arc(p0, p1, { x: -rx + s, y: -ry + s }),
    { command: 'L', points: [p2] },
    arc(p2, p3, { x: rx - s, y: -ry + s }),
    { command: 'L', points: [p4] },
    arc(p4, p5, { x: rx - s, y: ry - s }),
    { command: 'L', points: [p6] },
    arc(p6, p7, { x: -rx + s, y: ry - s }),
    { command: 'Z', points: [] },
  ]
}

/** Applies a 2×3 affine [a,b,c,d,e,f] to a point. */
function applyMatrix(matrix: readonly number[], p: Point): Point {
  return {
    x: matrix[0]! * p.x + matrix[2]! * p.y + matrix[4]!,
    y: matrix[1]! * p.x + matrix[3]! * p.y + matrix[5]!,
  }
}

/** Full per-frame eye path with the affine baked into the geometry. */
function bakedEyePath(width: number, height: number, matrix: readonly number[]): string {
  return capsuleSegments(width, height)
    .map((segment) => {
      if (segment.command === 'Z') return 'Z'
      const pts = segment.points.map((p) => {
        const t = applyMatrix(matrix, p)
        return `${format(t.x)} ${format(t.y)}`
      })
      return `${segment.command}${pts.join(' ')}`
    })
    .join('')
}

/**
 * Renders the avatar as a self-contained animated SVG (SMIL keyframes).
 * No scripts, no external assets — renders and loops forever inside plain
 * <img> tags (GitHub READMEs, npm, Notion embeds).
 */
export function renderAnimatedSvg(options: AnimatedAvatarOptions): string {
  const { frames, duration } = solveAnimationFrames(options)
  const base = frames[0]!.layout
  const seed = options.seed
  const backgroundStyle = resolveBackgroundStyle(seed, options.backgroundStyle)
  const requestedSize = resolveLayoutOptionsSize(options)

  const size = requestedSize ? ` width="${requestedSize}" height="${requestedSize}"` : ''
  const bodyColor = escapeXml(base.colors.body)
  const palette = base.colors.palette
  const uid = `sq-${stableId(base.body + backgroundStyle + palette.join('|') + base.seed)}`
  const iris = escapeXml(base.colors.eye)

  const background = backgroundMarkup(base.body, backgroundStyle, palette, uid, base.seed)
  const body =
    backgroundStyle === BACKGROUND_STYLES.solid
      ? `<path d="${base.body}" fill="${bodyColor}"/>`
      : ''

  const frameValues = [...frames, frames[0]!]
  const eyes = base.eyes
    .map((eye, index) => {
      const values = frameValues
        .map((frame) => bakedEyePath(eye.width, eye.height, frame.layout.eyes[index]!.matrix))
        .join(';')
      return `<path data-sq-eye="${index}" d="${bakedEyePath(eye.width, eye.height, frames[0]!.layout.eyes[index]!.matrix)}" fill="${iris}"><animate attributeName="d" values="${values}" calcMode="linear" dur="${duration}s" repeatCount="indefinite"/></path>`
    })
    .join('')

  let inner = `<defs>${background.defs}</defs>${body}${background.layers}${eyes}`
  if (options.wobble) {
    const keyTimes = frameValues.map((_, i) => (i / (frameValues.length - 1)).toFixed(6)).join(';')
    inner = `<g><animateTransform attributeName="transform" type="translate" additive="sum" values="${frames
      .map((f) => wobbleTranslateOnly(f.time, duration))
      .concat(wobbleTranslateOnly(frames[0]!.time, duration))
      .join(';')}" keyTimes="${keyTimes}" calcMode="linear" dur="${duration}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="rotate" additive="sum" values="${frames
      .map((f) => wobbleRotateOnly(f.time, duration))
      .concat(wobbleRotateOnly(frames[0]!.time, duration))
      .join(';')}" keyTimes="${keyTimes}" calcMode="linear" dur="${duration}s" repeatCount="indefinite"/>${inner}</g>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-158 -158 316 316"${size} style="overflow:visible" role="img" aria-label="Animated avatar">${inner}</svg>`
}

function wobbleTranslateOnly(time: number, loop: number): string {
  const angle = (2 * Math.PI * time) / loop
  return `${(Math.sin(angle * 2) * WOBBLE_AMPLITUDE).toFixed(2)} ${(Math.cos(angle * 2) * WOBBLE_AMPLITUDE).toFixed(2)}`
}

function wobbleRotateOnly(time: number, loop: number): string {
  const angle = (2 * Math.PI * time) / loop
  return (Math.sin(angle) * WOBBLE_ROTATION).toFixed(3)
}

function resolveLayoutOptionsSize(options: AnimatedAvatarOptions): number | undefined {
  return (options as SquishOptions).size
}

export interface RasterAnimationOptions extends AnimatedAvatarOptions {
  /** Raster width in pixels. Default 256. */
  width?: number
  /** GIF only: matte color behind transparent pixels (hex). Default '#ffffff'. */
  gifBackground?: string
}

function frameSvg(frame: AnimationFrame, options: AnimatedAvatarOptions): string {
  const svg = renderLayout(frame.layout, {
    seed: options.seed,
    backgroundStyle: options.backgroundStyle,
  } as SquishOptions)
  if (options.wobble) {
    const wobble = wobbleAt(frame.time, Number(effectiveDuration(options.duration)))
    return svg.replace('style="overflow:visible"', `style="overflow:visible;transform:${wobble}"`)
  }
  return svg
}

/** CJS/ESM interop: encoders ship as CommonJS with ambiguous named exports. */
async function importCjs<T>(specifier: string): Promise<T> {
  const namespace = (await import(specifier)) as unknown as Record<string, unknown>
  if (namespace.default && !namespaceHeuristic(namespace)) {
    return namespace.default as T
  }
  return namespace as unknown as T
}

function namespaceHeuristic(namespace: Record<string, unknown>): boolean {
  // The namespace already exposes plausible named functions.
  return typeof namespace.GIFEncoder === 'function' || typeof namespace.encode === 'function'
}

/** Renders the animation loop as an animated GIF (gifenc, pure JS). */
export async function renderAnimatedGif(options: RasterAnimationOptions): Promise<Uint8Array> {
  const solved = solveAnimationFrames(options)
  const width = options.width ?? 256
  const gifenc = await importCjs<typeof import('gifenc')>('gifenc')
  const gif = gifenc.GIFEncoder()
  const delay = Math.round(1000 / solved.fps)
  const matte = parseHex(options.gifBackground ?? '#ffffff')

  for (const frame of solved.frames) {
    const svg = frameSvg(frame, options)
    const { width: w, height: h, data } = await renderPixmap(svg, { width })
    const matted = matteRgba(data, matte)
    const palette = gifenc.quantize(matted, 256)
    const index = gifenc.applyPalette(matted, palette)
    gif.writeFrame(index, w, h, { palette, delay })
  }
  gif.finish()
  return gif.bytes()
}

/** Renders the animation loop as an APNG with full alpha (upng-js, pure JS). */
export async function renderAnimatedApng(options: RasterAnimationOptions): Promise<Uint8Array> {
  const solved = solveAnimationFrames(options)
  const width = options.width ?? 256
  const UPNG = await importCjs<typeof import('upng-js').default>('upng-js')
  const buffers: ArrayBuffer[] = []
  for (const frame of solved.frames) {
    const svg = frameSvg(frame, options)
    const { data } = await renderPixmap(svg, { width })
    buffers.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  }
  const delay = Math.round(1000 / solved.fps)
  const encoded = UPNG.encode(buffers, width, width, 0, buffers.map(() => delay))
  return new Uint8Array(encoded)
}

function parseHex(hex: string): [number, number, number] {
  const match = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!match) throw new RangeError(`gifBackground must be a hex color like "#ffffff" (got "${hex}")`)
  const int = parseInt(match[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/** GIF has 1-bit alpha — composite transparent pixels onto a matte color. */
function matteRgba(data: Uint8Array, matte: [number, number, number]): Uint8Array {
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!
    if (alpha === 255) {
      out[i] = data[i]!
      out[i + 1] = data[i + 1]!
      out[i + 2] = data[i + 2]!
      out[i + 3] = 255
    } else if (alpha === 0) {
      out[i] = matte[0]
      out[i + 1] = matte[1]
      out[i + 2] = matte[2]
      out[i + 3] = 255
    } else {
      out[i] = Math.round((data[i]! * alpha + matte[0] * (255 - alpha)) / 255)
      out[i + 1] = Math.round((data[i + 1]! * alpha + matte[1] * (255 - alpha)) / 255)
      out[i + 2] = Math.round((data[i + 2]! * alpha + matte[2] * (255 - alpha)) / 255)
      out[i + 3] = 255
    }
  }
  return out
}
