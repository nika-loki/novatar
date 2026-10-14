// Full avatar API inside Astro: svg / png / webp / gif / apng / json,
// e.g. /api/avatar/justin.png?engine=duo&shape=cat&size=256
import type { APIRoute } from 'astro'
import { createNovatarHandler } from 'novatar/server'

// On-demand route (Astro is static-by-default; the Node adapter covers
// `astro build`, and `astro dev` works without one).
export const prerender = false

const handler = createNovatarHandler({ base: '/api/avatar' })

export const GET: APIRoute = (ctx) => handler(ctx.request)
