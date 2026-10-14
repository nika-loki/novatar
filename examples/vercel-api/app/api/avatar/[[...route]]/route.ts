// Deploy novatar as an HTTP API on Vercel.
//
//   cd examples/vercel-api
//   npm install
//   npx vercel dev     # http://localhost:3000/api/avatar/orion
//   npx vercel deploy
//
// Routes served (after deployment, prefix with your domain):
//   /api/avatar                 → route documentation
//   /api/avatar/orion           → SVG avatar for seed "orion"
//   /api/avatar/orion.png       → PNG (Node runtime, deterministic)
//   /api/avatar/orion.json      → JSON metadata + dataUri
//   /api/avatar/styles          → machine-readable style catalog
//   /api/avatar/orion?engine=squish&shape=cat&expression=loving
import { createNovatarHandler } from 'novatar/server'

export const GET = createNovatarHandler({ base: '/api/avatar' })
