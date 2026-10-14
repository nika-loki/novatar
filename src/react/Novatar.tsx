import { useMemo } from 'react'
import { createNovatar } from '../index'
import type { NovatarEngineChoice } from '../index'
import { Avatar, type AvatarProps } from './Avatar'
import { Squishmoji, type SquishmojiProps } from './Squishmoji'

export interface NovatarProps {
  /** Deterministic identity. Same seed → same avatar. Defaults to "Space UI". */
  seed?: string
  /** "avatars", "squishmoji", or "auto" (deterministic pick from the seed). */
  engine?: NovatarEngineChoice
  /** Rendered size in pixels. Defaults to 64. */
  size?: number
  /** CSS class on the wrapper element. */
  className?: string
  /** avatars engine knobs (ignored when engine resolves to squishmoji). */
  variant?: AvatarProps['variant']
  circle?: boolean
  effect?: AvatarProps['effect']
  colors?: AvatarProps['colors']
  animate?: boolean
  /** squishmoji engine knobs (ignored when engine resolves to avatars). */
  shape?: SquishmojiProps['shape']
  expression?: SquishmojiProps['expression']
  backgroundStyle?: SquishmojiProps['backgroundStyle']
}

/**
 * Unified novatar component. Static markup for both engines — the animated
 * squishmoji experience is available via <Squishmoji /> directly.
 */
export function Novatar({
  seed,
  engine,
  size = 64,
  className,
  variant,
  circle,
  effect,
  colors,
  animate,
  shape,
  expression,
  backgroundStyle,
}: NovatarProps) {
  const resolvedEngine = useMemo(
    () => {
      // Delegates per engine; keep options out of the dependency list so the
      // component only re-renders when identity knobs actually change.
      const id = engine ?? 'auto'
      return id
    },
    [engine],
  )

  const svgMarkup = useMemo(
    () =>
      createNovatar({
        seed,
        engine: resolvedEngine,
        size,
        variant,
        circle,
        effect,
        colors,
        animate,
        shape,
        expression,
        backgroundStyle,
      }),
    [
      seed,
      resolvedEngine,
      size,
      variant,
      circle,
      effect,
      colors,
      animate,
      shape,
      expression,
      backgroundStyle,
    ],
  )

  return <span className={className} dangerouslySetInnerHTML={{ __html: svgMarkup }} />
}
