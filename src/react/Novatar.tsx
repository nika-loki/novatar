import { useMemo } from 'react'
import { createNovatar } from '../index'
import type { NovatarEngineChoice } from '../index'
import { Avatar, type AvatarProps } from './Avatar'
import { Duo, type DuoProps } from './Duo'

export interface NovatarProps {
  /** Deterministic identity. Same seed → same avatar. Defaults to "Space UI". */
  seed?: string
  /** "avatars", "duo", or "auto" (deterministic pick from the seed). */
  engine?: NovatarEngineChoice
  /** Rendered size in pixels. Defaults to 64. */
  size?: number
  /** CSS class on the wrapper element. */
  className?: string
  /** avatars engine knobs (ignored when engine resolves to duo). */
  variant?: AvatarProps['variant']
  circle?: boolean
  effect?: AvatarProps['effect']
  colors?: AvatarProps['colors']
  animate?: boolean
  /** duo engine knobs (ignored when engine resolves to avatars). */
  shape?: DuoProps['shape']
  expression?: DuoProps['expression']
  backgroundStyle?: DuoProps['backgroundStyle']
}

/**
 * Unified novatar component. Static markup for both engines — the animated
 * duo experience is available via <Duo /> directly.
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
