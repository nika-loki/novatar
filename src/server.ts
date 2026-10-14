/**
 * Web-standard HTTP handler for novatar — drops into Vercel Functions,
 * Edge Runtime, Cloudflare Workers, Bun, and Deno without adaptation.
 *
 *   import { createNovatarHandler } from 'novatar/server'
 *   export const GET = createNovatarHandler()               // any path
 *   export const GET = createNovatarHandler({ base: '/api/avatar' })
 *
 * Routes (relative to the optional base):
 *   GET /                     → route documentation (JSON)
 *   GET /:seed                → SVG          e.g. /v1/orion
 *   GET /:seed.png            → PNG (Node runtime)
 *   GET /:seed.json           → JSON metadata + dataUri
 * Query parameters override the path seed and add options:
 *   seed, engine, variant, shape, expression, background, size,
 *   circle, effect, animate, colors (comma-separated), format (svg|json|png)
 */
import {
  createNovatar,
  listNovatarStyles,
  NovatarOutputFormat,
  resolveEngine,
  type NovatarOptions,
} from './index'

const IMMUTABLE = 'public, max-age=31536000, immutable'

export interface NovatarHandlerOptions {
  /** Path prefix this handler is mounted under, e.g. "/api/avatar". */
  base?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined
  if (value === '' || value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
}

function optionsFromQuery(url: URL): NovatarOptions {
  const q = url.searchParams
  const options: NovatarOptions = {}

  const seed = q.get('seed') ?? q.get('name')
  if (seed) options.seed = seed
  const engine = q.get('engine')
  if (engine) options.engine = engine
  const variant = q.get('variant')
  if (variant) options.variant = variant
  const shape = q.get('shape')
  if (shape) options.shape = shape
  const expression = q.get('expression')
  if (expression) options.expression = expression
  const background = q.get('background') ?? q.get('backgroundStyle')
  if (background) options.backgroundStyle = background
  const size = q.get('size')
  if (size) {
    const parsed = Number(size)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 4096) options.size = parsed
  }
  const circle = parseBoolean(q.get('circle'))
  if (circle !== undefined) options.circle = circle
  const effect = q.get('effect')
  if (effect) options.effect = effect
  const animate = parseBoolean(q.get('animate'))
  if (animate !== undefined) options.animate = animate
  const colors = q.get('colors')
  if (colors) {
    const list = colors.split(',').map((c) => c.trim()).filter(Boolean)
    if (list.length === 5) options.colors = list
  }

  return options
}

function routeInfo(baseUrl: string): Record<string, unknown> {
  return {
    name: 'novatar',
    description: 'Deterministic generative SVG avatars (avatars + squish engines).',
    routes: {
      [`${baseUrl}/`]: 'this documentation',
      [`${baseUrl}/:seed`]: 'SVG avatar for the seed',
      [`${baseUrl}/:seed.png`]: 'PNG raster (Node runtime only)',
      [`${baseUrl}/:seed.json`]: 'JSON metadata + dataUri',
      [`${baseUrl}/styles`]: 'style catalog (JSON)',
    },
    query: {
      engine: 'avatars | squish | auto (default auto)',
      variant: 'avatars engine: variant, family, or all',
      shape: 'squish engine: shape or all',
      expression: 'squish engine: expression or all',
      background: 'squish engine: background style or all',
      size: 'pixels (1-4096)',
      circle: 'true|false (avatars engine)',
      effect: 'none|noise (avatars engine)',
      animate: 'true → animated SVG (both engines), baked-in motion for avatars',
      fps: 'animated exports: frames per second 1-60 (default 12)',
      duration: 'animated exports: loop seconds, snapped to the 4.7s blink cycle',
      wobble: 'true → gentle floating wobble (animated exports)',
      colors: 'exactly 5 comma-separated hex colors (both engines)',
      format: 'svg|json|png|webp|gif|apng (overrides path extension)',
    },
    determinism: 'identical seed + options produce byte-identical output',
  }
}

export function createNovatarHandler(options: NovatarHandlerOptions = {}): (request: Request) => Promise<Response> {
  const base = (options.base ?? '').replace(/\/+$/, '')

  return async function handler(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({ error: 'method not allowed — use GET' }, 405)
    }

    const url = new URL(request.url)
    let path = url.pathname
    if (base && path.startsWith(base)) path = path.slice(base.length)
    path = path.replace(/\/+$/, '')
    const segments = path.split('/').filter(Boolean)

    if (segments.length === 0) {
      return jsonResponse(routeInfo(`${base || ''}/`))
    }

    if (segments[0] === 'styles') {
      return jsonResponse(listNovatarStyles(url.searchParams.get('engine') ?? undefined))
    }

    if (segments.length > 1) {
      return jsonResponse({ error: `unknown route "${path}" — see ${base || ''}/ for routes` }, 404)
    }

    // Seed may carry an extension choosing the format:
    // seed.png / seed.json / seed.webp / seed.gif / seed.apng
    let seed = decodeURIComponent(segments[0])
    let pathFormat: 'svg' | 'json' | 'png' | 'webp' | 'gif' | 'apng' | undefined
    const extensionMatch = seed.match(/\.(png|json|webp|gif|apng)$/i)
    if (extensionMatch) {
      pathFormat = extensionMatch[1]!.toLowerCase() as NonNullable<typeof pathFormat>
      seed = seed.slice(0, -(extensionMatch[1]!.length + 1))
    }
    if (!seed) seed = 'Space UI'

    const queryOptions = optionsFromQuery(url)
    const format = (url.searchParams.get('format') as typeof pathFormat | null) ?? pathFormat ?? 'svg'
    const animate = parseBoolean(url.searchParams.get('animate')) ?? false
    const fpsParam = Number(url.searchParams.get('fps'))
    const durationParam = Number(url.searchParams.get('duration'))
    const resolvedOptions: NovatarOptions = { ...queryOptions, seed }
    // seed from the path wins unless the query explicitly redefines it — the
    // spread above already handles that by putting query seed first, so
    // restore the path seed as the identity when both exist.
    if (queryOptions.seed && queryOptions.seed !== seed && !url.searchParams.has('name')) {
      resolvedOptions.seed = queryOptions.seed
    }

    // Animation defaults to the squish engine; gif/apng require it.
    if ((animate || format === 'gif' || format === 'apng') && !resolvedOptions.engine) {
      resolvedOptions.engine = 'squish'
    }
    if ((format === 'gif' || format === 'apng') && resolvedOptions.engine && resolveEngine(seed, resolvedOptions.engine) === 'avatars') {
      return jsonResponse({ error: 'animated raster exports (gif/apng) require the squish engine' }, 400)
    }

    try {
      resolveEngine(seed, resolvedOptions.engine) // fail fast with a clean 400

      const animationCommon = {
        seed,
        shape: resolvedOptions.shape,
        expression: resolvedOptions.expression,
        backgroundStyle: resolvedOptions.backgroundStyle,
        colors: resolvedOptions.colors,
        fps: Number.isFinite(fpsParam) && fpsParam >= 1 && fpsParam <= 60 ? fpsParam : undefined,
        duration: Number.isFinite(durationParam) && durationParam > 0 ? durationParam : undefined,
        wobble: parseBoolean(url.searchParams.get('wobble')) ?? false,
      }

      if (format === 'gif' || format === 'apng') {
        const svg = createNovatar(resolvedOptions)
        void svg
        if (format === 'gif') {
          const { renderAnimatedGif } = await import('./animation')
          const gif = await renderAnimatedGif({ ...animationCommon, width: resolvedOptions.size ?? 256 })
          return new Response(gif as unknown as BodyInit, {
            headers: { 'content-type': 'image/gif', 'cache-control': IMMUTABLE },
          })
        }
        const { renderAnimatedApng } = await import('./animation')
        const apng = await renderAnimatedApng({ ...animationCommon, width: resolvedOptions.size ?? 256 })
        return new Response(apng as unknown as BodyInit, {
          headers: { 'content-type': 'image/png', 'cache-control': IMMUTABLE },
        })
      }

      if (format === 'webp') {
        const svg = createNovatar(resolvedOptions)
        const { renderWebp } = await import('./raster')
        const webp = await renderWebp(svg, { width: resolvedOptions.size })
        return new Response(webp as unknown as BodyInit, {
          headers: { 'content-type': 'image/webp', 'cache-control': IMMUTABLE },
        })
      }

      if (format === 'png') {
        const svg = createNovatar(resolvedOptions)
        const { renderPng } = await import('./raster')
        const png = await renderPng(svg, { width: resolvedOptions.size })
        return new Response(png as unknown as BodyInit, {
          headers: {
            'content-type': 'image/png',
            'cache-control': IMMUTABLE,
          },
        })
      }

      if (format === 'svg' && animate && resolveEngine(seed, resolvedOptions.engine) === 'squish') {
        const { renderAnimatedSvg } = await import('./animation')
        const svg = renderAnimatedSvg(animationCommon)
        return new Response(svg, {
          headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': IMMUTABLE },
        })
      }

      if (format === 'json') {
        const json = createNovatar({ ...resolvedOptions, format: NovatarOutputFormat.json })
        return new Response(JSON.stringify(json, null, 2), {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': IMMUTABLE },
        })
      }

      const svg = createNovatar(resolvedOptions)
      return new Response(svg, {
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': IMMUTABLE },
      })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400)
    }
  }
}
