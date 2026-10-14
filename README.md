<p align="center">
  <img src="assets/logo-animated.svg?v=2" width="160" alt="novatar logo" />
</p>

# novatar

**Deterministic generative SVG avatars — one package, two engines, built for humans *and* AI agents.**

The same seed always produces the same avatar: byte-identical output across machines, runtimes, and replays.

- `npx novatar <seed>` — zero-config CLI exporting **SVG · PNG · WebP** stills and **animated SVG · APNG · GIF**
- `novatar-mcp` — MCP server for AI agents (Claude, Notion AI agents, Cursor, …)
- `novatar/server` — Web-standard HTTP handler (Vercel, Workers, Bun, Deno)
- `novatar/react` — React components (static + animated)
- Pure-JS/WASM encoders, no native builds required (WebP uses optional prebuilt sharp). No prompts. No network.

<p align="center"><strong>Optimized for AI agents</strong> — one deterministic toolchain every agent can drive via CLI, MCP, or HTTP.</p>

<table><tr>
<td align="center"><img src="assets/agents/claude.svg" width="26" alt="Claude logo" /><br /><sub><b>Claude</b></sub></td>
<td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/agents/grok-white.svg" /><img src="assets/agents/grok.svg" width="26" alt="Grok logo" /></picture><br /><sub><b>Grok</b></sub></td>
<td align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/agents/openai-white.svg" /><img src="assets/agents/openai.svg" width="26" alt="OpenAI logo" /></picture><br /><sub><b>OpenAI</b></sub></td>
<td align="center"><img src="assets/agents/gemini.svg" width="26" alt="Gemini logo" /><br /><sub><b>Gemini</b></sub></td>
</tr></table>

Two engines, one identity model:

| Engine       | Catalog                                                           |
| ------------ | ----------------------------------------------------------------- |
| `avatars`    | 21 variants · 4 families (gradient, fluid, classic, paletteless)  |
| `squishmoji` | 21 shapes × 22 expressions × 6 generative backgrounds             |

---

## Quick start (CLI)

```bash
npx novatar justin > justin.svg                          # SVG to stdout
npx novatar justin --engine squishmoji --shape cat --expression loving
npx novatar justin --engine avatars --variant triton --json
npx novatar justin --png --size 512 --out avatar.png     # still PNG
npx novatar justin --webp --quality 95 --out avatar.webp # still WebP
npx novatar justin --animate --out animated.svg          # animated SVG (SMIL, loops forever)
npx novatar justin --gif --size 256 --out avatar.gif     # animated GIF
npx novatar justin --apng --size 256 --out avatar.png    # animated PNG with alpha
npx novatar justin --gif --datauri                       # ready-to-embed data:image/gif URI
npx novatar --batch alice,bob,carol --apng --out 'team/{seed}.png'  # batch animations
npx novatar --random --count 12 --json                   # 12 random avatars as a JSON array
npx novatar --list                                        # machine-readable catalog
```

Read seeds from stdin — one per line; more than one line is a batch:

```bash
echo "user-42" | npx novatar - --json
git log --format=%an | sort -u | npx novatar - --png --out 'team/{seed}.png'
```

Full CLI reference: `npx novatar --help`. Agent-oriented cookbook: [AGENTS.md](./AGENTS.md).

## Install

```bash
npm install novatar
```

Works in Node ≥ 18, browser bundlers, Vercel Functions (Node & Edge for SVG), Cloudflare Workers, Bun, Deno.

---

## Programmatic API

### Unified — `createNovatar`

```ts
import { createNovatar } from 'novatar'

const svg = createNovatar({ seed: 'justin', engine: 'squishmoji', shape: 'cat', expression: 'loving' })

const json = createNovatar({ seed: 'justin', engine: 'avatars', variant: 'triton', format: 'json' })
// { seed, engine, svg, dataUri, variant, circle, effect, animate }
```

- `engine: 'auto'` (default) picks deterministically from the seed. Aliases: `squish`, `emoji`, `avatar`, `art`.
- Engine-specific options are ignored by the other engine, so one call shape covers both.

### Engine compat APIs

The full upstream surfaces are preserved for drop-in migration:

```ts
import { createAvatar, resolveVariant } from 'novatar'            // @usespaceui/avatars API
import { createSquishmoji, resolveLayout, renderLayout, SquishEngine } from 'novatar' // @usespaceui/squishmoji API
```

### Introspection & palettes

```ts
import { listNovatarStyles, generatePalette } from 'novatar'

listNovatarStyles()        // { engines: [{ id, variants | shapes, expressions, backgrounds }] }
listNovatarStyles('squishmoji')
generatePalette('justin')  // { seed, colors: [ '#..', ×5 ] } — bit-exact with @usespaceui/gradients
```

### Raster, WebP & animation exports

```ts
import { renderPng, renderPngDataUri, renderWebp } from 'novatar/raster'
import { renderAnimatedSvg, renderAnimatedGif, renderAnimatedApng } from 'novatar'

const png = await renderPng(svg, { width: 512 })                  // Uint8Array (resvg WASM)
const webp = await renderWebp(svg, { width: 512, quality: 95 })   // optional sharp
const animatedSvg = renderAnimatedSvg({ seed: 'justin', shape: 'cat' }) // SMIL, loops forever
const gif = await renderAnimatedGif({ seed: 'justin', width: 256, fps: 12 })
const apng = await renderAnimatedApng({ seed: 'justin', width: 256 })    // full alpha
```

Animated exports reproduce the `<Squishmoji />` motion (autonomous blinking
+ gaze drift, optional `wobble`) from one frame solver, so every format
moves identically. Loops are locked to the 4.7 s blink cycle — `duration` is
snapped to a multiple of it so GIF/APNG wraps are seamless. GIF composites
transparency onto a `gifBackground` matte (1-bit alpha); APNG and animated
SVG keep full alpha. Animated raster exports use the squishmoji engine
(the avatars engine's CSS animation cannot be time-sampled by rasterizers).

---

## React

```tsx
import { Novatar, Avatar, Squishmoji } from 'novatar/react'

<Novatar seed="justin" engine="squishmoji" shape="cat" size={64} />
<Avatar name="orion" variant={/* 'triton' | family | 'all' */ 'fluid'} animate />
<Squishmoji seed="justin" shape="cat" expression="loving" animate animOnClick animOnHover />
```

`<Squishmoji />` is the fully alive experience: breathing, gaze drift, blinks,
hover/click reactions, reduced-motion aware. `<Avatar />` and `<Novatar />` render
static markup (SSR-safe). React 18+ is an optional peer dependency — the core
never imports it.

---

## HTTP API (Vercel & friends)

```ts
// app/api/avatar/[[...route]]/route.ts
import { createNovatarHandler } from 'novatar/server'

export const GET = createNovatarHandler({ base: '/api/avatar' })
```

```html
<img src="https://your-app.vercel.app/api/avatar/orion.svg" />
<img src="https://your-app.vercel.app/api/avatar/justin.png?engine=squishmoji&shape=cat&expression=loving" />
```

Deterministic responses ship with `Cache-Control: immutable`. See
[examples/vercel-api](./examples/vercel-api) for a deployable project.

---

## Astro

First-class — and no React required. The core generates plain SVG strings, so
avatars render at build time with **zero client-side JavaScript** (even the
animated SVG blinks via SMIL, no hydration):

```astro
---
import { createNovatar, renderAnimatedSvg } from 'novatar'
const avatar = createNovatar({ seed: 'justin', engine: 'squishmoji', shape: 'cat', expression: 'loving' })
const animated = renderAnimatedSvg({ seed: 'hero', shape: 'ufo' })
---
<Fragment set:html={avatar} />
<Fragment set:html={animated} />
```

The HTTP handler drops into an Astro endpoint as a Web-standard
`Request → Response` function (all formats: svg / png / webp / gif / apng /
json, plus `?animate=true`):

```ts
// src/pages/api/avatar/[...route].ts
import type { APIRoute } from 'astro'
import { createNovatarHandler } from 'novatar/server'

export const prerender = false // on-demand route (Astro is static by default)
const handler = createNovatarHandler({ base: '/api/avatar' })
export const GET: APIRoute = (ctx) => handler(ctx.request)
```

`astro dev` serves the endpoint as-is; `astro build` needs any adapter (e.g.
`@astrojs/node`) for on-demand routes. The React components from
`novatar/react` also work through `@astrojs/react` when you want interactive
islands (`<Squishmoji client:load />`). Complete working project:
[examples/astro](./examples/astro).

---

## Style catalog

<!-- novatar:gallery:start -->
### avatars engine — 21 variants

All tiles use the same seed (`orion`), so palette differences come from the variants themselves.

<h4>gradient</h4>

<table><tr>
<td align="center"><img src="assets/gallery/avatars/lumina.svg" width="72" alt="lumina avatar" /><br /><sub><code>lumina</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/shaula.svg" width="72" alt="shaula avatar" /><br /><sub><code>shaula</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/singularity.svg" width="72" alt="singularity avatar" /><br /><sub><code>singularity</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/triton.svg" width="72" alt="triton avatar" /><br /><sub><code>triton</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/solar-flare.svg" width="72" alt="solar-flare avatar" /><br /><sub><code>solar-flare</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/titan.svg" width="72" alt="titan avatar" /><br /><sub><code>titan</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/glass.svg" width="72" alt="glass avatar" /><br /><sub><code>glass</code></sub></td>
</tr></table>

<h4>fluid</h4>

<table><tr>
<td align="center"><img src="assets/gallery/avatars/splash.svg" width="72" alt="splash avatar" /><br /><sub><code>splash</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/animals.svg" width="72" alt="animals avatar" /><br /><sub><code>animals</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/astronaut.svg" width="72" alt="astronaut avatar" /><br /><sub><code>astronaut</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/ghost.svg" width="72" alt="ghost avatar" /><br /><sub><code>ghost</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/bot.svg" width="72" alt="bot avatar" /><br /><sub><code>bot</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/glitch.svg" width="72" alt="glitch avatar" /><br /><sub><code>glitch</code></sub></td>
</tr></table>

<h4>classic</h4>

<table><tr>
<td align="center"><img src="assets/gallery/avatars/pebble.svg" width="72" alt="pebble avatar" /><br /><sub><code>pebble</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/invader.svg" width="72" alt="invader avatar" /><br /><sub><code>invader</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/grunge.svg" width="72" alt="grunge avatar" /><br /><sub><code>grunge</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/bored.svg" width="72" alt="bored avatar" /><br /><sub><code>bored</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/doodle.svg" width="72" alt="doodle avatar" /><br /><sub><code>doodle</code></sub></td>
<td align="center"><img src="assets/gallery/avatars/squiggle.svg" width="72" alt="squiggle avatar" /><br /><sub><code>squiggle</code></sub></td>
</tr></table>

<h4>paletteless</h4>

<table><tr>
<td align="center"><img src="assets/gallery/avatars/critter.svg" width="72" alt="critter avatar" /><br /><sub><code>critter</code> <i>(ink-only)</i></sub></td>
<td align="center"><img src="assets/gallery/avatars/kendo.svg" width="72" alt="kendo avatar" /><br /><sub><code>kendo</code> <i>(ink-only)</i></sub></td>
</tr></table>

### squishmoji engine — 21 shapes

Seed `novatar`, rotating expressions to show a little life:

<table><tr>
<td align="center"><img src="assets/gallery/squish/shape-circle.svg" width="72" alt="circle shape" /><br /><sub><code>circle</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-pebble.svg" width="72" alt="pebble shape" /><br /><sub><code>pebble</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-squircle.svg" width="72" alt="squircle shape" /><br /><sub><code>squircle</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-capsule.svg" width="72" alt="capsule shape" /><br /><sub><code>capsule</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-triangle.svg" width="72" alt="triangle shape" /><br /><sub><code>triangle</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-hexagon.svg" width="72" alt="hexagon shape" /><br /><sub><code>hexagon</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-cloud.svg" width="72" alt="cloud shape" /><br /><sub><code>cloud</code></sub></td>
</tr></table>

<table><tr>
<td align="center"><img src="assets/gallery/squish/shape-drop.svg" width="72" alt="drop shape" /><br /><sub><code>drop</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-square.svg" width="72" alt="square shape" /><br /><sub><code>square</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-pentagon.svg" width="72" alt="pentagon shape" /><br /><sub><code>pentagon</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-octagon.svg" width="72" alt="octagon shape" /><br /><sub><code>octagon</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-star.svg" width="72" alt="star shape" /><br /><sub><code>star</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-cat.svg" width="72" alt="cat shape" /><br /><sub><code>cat</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-ghost.svg" width="72" alt="ghost shape" /><br /><sub><code>ghost</code></sub></td>
</tr></table>

<table><tr>
<td align="center"><img src="assets/gallery/squish/shape-ufo.svg" width="72" alt="ufo shape" /><br /><sub><code>ufo</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-flower.svg" width="72" alt="flower shape" /><br /><sub><code>flower</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-bot.svg" width="72" alt="bot shape" /><br /><sub><code>bot</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-alien.svg" width="72" alt="alien shape" /><br /><sub><code>alien</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-lion.svg" width="72" alt="lion shape" /><br /><sub><code>lion</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-monkey.svg" width="72" alt="monkey shape" /><br /><sub><code>monkey</code></sub></td>
<td align="center"><img src="assets/gallery/squish/shape-mecha.svg" width="72" alt="mecha shape" /><br /><sub><code>mecha</code></sub></td>
</tr></table>

### 22 expressions

Same seed and shape — only the expression changes:

<table><tr>
<td align="center"><img src="assets/gallery/squish/expression-neutral.svg" width="60" alt="neutral expression" /><br /><sub><code>neutral</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-attentive.svg" width="60" alt="attentive expression" /><br /><sub><code>attentive</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-surprised.svg" width="60" alt="surprised expression" /><br /><sub><code>surprised</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-excited.svg" width="60" alt="excited expression" /><br /><sub><code>excited</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-happy.svg" width="60" alt="happy expression" /><br /><sub><code>happy</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-laughing.svg" width="60" alt="laughing expression" /><br /><sub><code>laughing</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-angry.svg" width="60" alt="angry expression" /><br /><sub><code>angry</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-sad.svg" width="60" alt="sad expression" /><br /><sub><code>sad</code></sub></td>
</tr></table>

<table><tr>
<td align="center"><img src="assets/gallery/squish/expression-scared.svg" width="60" alt="scared expression" /><br /><sub><code>scared</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-suspicious.svg" width="60" alt="suspicious expression" /><br /><sub><code>suspicious</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-confused.svg" width="60" alt="confused expression" /><br /><sub><code>confused</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-curious.svg" width="60" alt="curious expression" /><br /><sub><code>curious</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-proud.svg" width="60" alt="proud expression" /><br /><sub><code>proud</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-shy.svg" width="60" alt="shy expression" /><br /><sub><code>shy</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-bored.svg" width="60" alt="bored expression" /><br /><sub><code>bored</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-sleepy.svg" width="60" alt="sleepy expression" /><br /><sub><code>sleepy</code></sub></td>
</tr></table>

<table><tr>
<td align="center"><img src="assets/gallery/squish/expression-crazy.svg" width="60" alt="crazy expression" /><br /><sub><code>crazy</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-loving.svg" width="60" alt="loving expression" /><br /><sub><code>loving</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-determined.svg" width="60" alt="determined expression" /><br /><sub><code>determined</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-guilty.svg" width="60" alt="guilty expression" /><br /><sub><code>guilty</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-amazed.svg" width="60" alt="amazed expression" /><br /><sub><code>amazed</code></sub></td>
<td align="center"><img src="assets/gallery/squish/expression-doubtful.svg" width="60" alt="doubtful expression" /><br /><sub><code>doubtful</code></sub></td>
</tr></table>

### 6 generative backgrounds

<table><tr>
<td align="center"><img src="assets/gallery/squish/background-solid.svg" width="72" alt="solid background" /><br /><sub><code>solid</code></sub></td>
<td align="center"><img src="assets/gallery/squish/background-taygeta.svg" width="72" alt="taygeta background" /><br /><sub><code>taygeta</code></sub></td>
<td align="center"><img src="assets/gallery/squish/background-maia.svg" width="72" alt="maia background" /><br /><sub><code>maia</code></sub></td>
<td align="center"><img src="assets/gallery/squish/background-merope.svg" width="72" alt="merope background" /><br /><sub><code>merope</code></sub></td>
<td align="center"><img src="assets/gallery/squish/background-celaeno.svg" width="72" alt="celaeno background" /><br /><sub><code>celaeno</code></sub></td>
<td align="center"><img src="assets/gallery/squish/background-alcyone.svg" width="72" alt="alcyone background" /><br /><sub><code>alcyone</code></sub></td>
</tr></table>
<!-- novatar:gallery:end -->

Every catalog accepts `all` for a deterministic pick from the seed. Query the live
catalog anywhere: `npx novatar --list` or `listNovatarStyles()`.

---

## MCP server (AI agents)

Expose novatar to any MCP client — three tools: `novatar_generate`,
`novatar_list_styles`, `novatar_palette`.

```jsonc
// e.g. Claude Desktop: claude_desktop_config.json
{
  "mcpServers": {
    "novatar": { "command": "npx", "args": ["-y", "novatar", "--mcp"] }
  }
}
```

Any stdio MCP client works: `novatar-mcp` is also a standalone bin. Setup recipes
for Notion AI agents and sandbox environments: [AGENTS.md](./AGENTS.md).

---

## Determinism & versioning

- Same seed + same options → byte-identical SVG/PNG, on every machine, forever within a major version.
- Output parity with upstream `@usespaceui/avatars@0.1.x` / `@usespaceui/squishmoji@0.1.x` / `@usespaceui/gradients@0.1.x` is enforced by the contract tests (`npm test`).
- Breaking visual changes will bump the major version.

## Development

```bash
npm install
npm run build      # tsup → dist (esm + cjs + types)
npm test           # contract tests: engines, upstream parity, CLI, MCP, HTTP
```

## Credits & license

[MIT](./LICENSE) © 2026 Justin Cheu.

novatar merges and extends two MIT-licensed engines by
[SpaceUI](https://github.com/usespaceui), with bit-exact output parity verified
by the test suite:

| Engine       | Ported from                                                                                     | Catalog                                                    |
| ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `avatars`    | [`@usespaceui/avatars`](https://github.com/usespaceui/avatars)                                   | 21 variants · 4 families (gradient, fluid, classic, paletteless) |
| `squishmoji` | [`@usespaceui/squishmoji`](https://github.com/usespaceui/squishmoji)                             | 21 shapes × 22 expressions × 6 generative backgrounds      |

Palette data is vendored from
[@usespaceui/gradients](https://www.npmjs.com/package/@usespaceui/gradients)
(MIT, SpaceUI). PNG rasterization by
[resvg-wasm](https://github.com/thx/resvg-js). Agent logos from
[thesvg.org](https://thesvg.org); all trademarks belong to their owners.
