# AGENTS.md — novatar for AI agents

You are using **novatar**, a deterministic avatar generator. This file is the
complete operating manual for agents (Claude, Notion AI agents, Codex, …)
running in terminals, Vercel Computers/sandboxes, or over MCP.

**Core contract: the same `seed` + options always produce byte-identical
output.** Persist the seed and you can regenerate the exact avatar forever.

## 30-second start (no install)

```bash
npx novatar justin --json          # metadata + svg + dataUri, stdout
npx novatar justin --png --out a.png
```

## Interfaces

| Surface             | Invoke                                        | Use when                                   |
| ------------------- | --------------------------------------------- | ------------------------------------------ |
| CLI                 | `npx novatar …` / `novatar …`                 | Shell access (sandboxes, CI, scripts)      |
| MCP server          | `npx novatar --mcp` or `novatar-mcp`          | Your runtime speaks Model Context Protocol |
| Node API            | `import { createNovatar } from 'novatar'`     | Writing code                               |
| HTTP                | `novatar/server` handler or `npx novatar` + deploy | Serving images                  |

## CLI reference

```
novatar [seed] [options]
  --engine avatars|squishmoji|auto     default auto (deterministic from seed)
  --variant <id|family|all>            [avatars]
  --shape <id|all>                     [squishmoji]
  --expression <id|all>                [squishmoji]
  --background <id|all>                [squishmoji]
  --size <1..4096>
  --circle                             [avatars] clip to circle
  --effect none|noise                  [avatars]
  --colors <hex,hex,hex,hex,hex>       exactly 5, both engines (overrides seeded palette)
  --format svg|json|png|webp|gif|apng  shorthands: --json --png --webp --gif --apng
                                       gif/apng are ANIMATED (squishmoji engine)
  --animate                            with svg/json: animated (SMIL) SVG
  --fps <1..60>                        animated exports, default 12
  --duration <seconds>                 loop length, snapped to the 4.7s blink cycle
  --wobble                             gentle floating wobble (animated exports)
  --quality <1..100>                   webp quality, default 92
  --gif-bg <hex>                       gif matte behind transparency, default #ffffff
  --datauri                            print a data:image/... URI (any image format)
  --out <path>                         write to a file; "{seed}" placeholder in batch
  --batch a,b,c                        many seeds in one invocation
  --count N                            N fresh random seeds (with --random)
  --random                             one fresh random seed (reported on stderr)
  --quiet                              suppress stderr notes
  --list [--engine ID]                 style catalog as JSON
  --mcp                                start the MCP stdio server
  short flags: -e engine · -o out · -b batch · -q quiet · -h help · -v version
```

Animated exports (gif / apng / `--animate`) reproduce the React
`<Squishmoji />` motion — autonomous blinking + gaze drift, optional wobble —
from one frame solver, so every format moves identically, and loops are
seamless (blink cycle 4.7 s). GIF composites transparency onto the
`--gif-bg` matte; APNG and animated SVG keep full alpha. WebP stills use the
optional `sharp` package (`npm i sharp`, prebuilt binaries).

Batch rules: `--json` prints one array; `--datauri` prints one URI per line;
SVGs to stdout are newline-separated; binary formats (png/webp/gif/apng)
require `--out` with a `{seed}` placeholder. Multi-line stdin is a batch
(`git log --format=%an | sort -u | novatar - --png --out 'team/{seed}.png'`).
Seeds are filesystem-sanitized inside `{seed}` (`Alice L.` → `Alice_L`).

Exit codes: `0` success · `1` usage/generation error (message on stderr, no stack traces).
The CLI never prompts and never touches the network.

### Cookbook

```bash
# Discover valid ids before generating
npx novatar --list
npx novatar --list --engine squishmoji

# Squishy character, exact control
npx novatar justin --engine squishmoji --shape cat --expression loving --background taygeta --size 256 --out justin.svg

# Abstract avatar across a family (deterministic pick from seed)
npx novatar justin --engine avatars --variant fluid --json

# Whole team in one invocation (no shell loop needed)
npx novatar --batch alice,bob,carol --png --size 256 --out 'team/{seed}.png'

# Avatar per git author
git log --format=%an | sort -u | novatar - --png --out 'team/{seed}.png'

# 12 random avatars as a JSON array
npx novatar --random --count 12 --json

# Ready-to-embed URIs for HTML/Notion
npx novatar justin --png --datauri
npx novatar --batch a,b,c --datauri            # one URI per line

# Animated exports (blinking + gaze drift, seamless 4.7s loops)
npx novatar justin --animate --out animated.svg   # SMIL svg, works in GitHub READMEs
npx novatar justin --gif --size 256 --out a.gif   # animated GIF (white matte)
npx novatar justin --apng --size 256 --out a.png  # animated PNG with alpha
npx novatar justin --animate --wobble             # add floating wobble
npx novatar justin --gif --fps 20 --duration 9.4  # smoother, two blink cycles

# Still WebP (uses the optional sharp package)
npx novatar justin --webp --quality 95 --out a.webp

# Custom palette on any engine (geometry stays seed-driven)
npx novatar justin --engine squishmoji --shape cat --colors '#ff9a3c,#ff5c8a,#c13584,#701a75,#fde68a'

# Stable identity from a pipeline id
echo "$USER_ID" | npx novatar - --json
```

### Output formats

- **svg** — raw `<svg …>` markup on stdout.
- **json** — `{ seed, engine, svg, dataUri, …resolved options }`. `dataUri` is a
  ready-to-embed `data:image/svg+xml;utf8,…` URI.
- **png** — binary to stdout or `--out`. Default width 512; set `--size`.
  First PNG call takes ~100ms extra to initialize the WASM rasterizer.

## Notion workflows

1. **External URL (simplest).** Notion image blocks accept external URLs.
   Deploy [examples/vercel-api](./examples/vercel-api) once, then attach:
   `https://<app>.vercel.app/api/avatar/<seed>.png?engine=squishmoji&shape=cat`
2. **File upload.** Generate a PNG with the CLI and upload it through the
   Notion API file-upload endpoint, then attach the upload to an image block.
3. **Inline data URI.** `--json` output includes `dataUri`; usable in HTML,
   markdown, and anywhere data URIs render.

Always store the seed (e.g. in a Notion property) so avatars stay regenerable.

## MCP

Three tools: `novatar_generate`, `novatar_list_styles`, `novatar_palette`.
Stdio transport, newline-delimited JSON-RPC 2.0. Start with `npx novatar --mcp`
(register `npx -y novatar --mcp` in your client config) or the `novatar-mcp` bin.

```jsonc
// client config shape
{ "mcpServers": { "novatar": { "command": "npx", "args": ["-y", "novatar", "--mcp"] } } }
```

`novatar_generate` arguments: `seed`, `engine`, `variant`, `shape`,
`expression`, `background`, `size`, `format` (`svg|json|png`), `output_path`
(writes the artifact to disk, creating parent directories). PNG returns an
image content block plus a text summary; `svg` returns markup; `json` returns
full metadata including `dataUri`.

## Valid ids (quick reference)

- **engines:** `avatars`, `squishmoji` (aliases `squish`, `emoji`; `auto` = deterministic pick)
- **avatars variants:** `lumina` `shaula` `singularity` `triton` `solar-flare` `titan` `glass` `splash` `animals` `astronaut` `ghost` `bot` `glitch` `pebble` `invader` `grunge` `bored` `doodle` `squiggle` `critter` `kendo`; families `gradient` `fluid` `classic` `paletteless`; or `all`
- **shapes:** `circle` `pebble` `squircle` `capsule` `triangle` `hexagon` `cloud` `drop` `square` `pentagon` `octagon` `star` `flower` `cat` `ghost` `ufo` `bot` `alien` `lion` `monkey` `mecha`
- **expressions:** `neutral` `happy` `sad` `excited` `angry` `loving` `surprised` `laughing` `scared` `suspicious` `confused` `curious` `proud` `shy` `bored` `sleepy` `crazy` `determined` `guilty` `amazed` `doubtful` `attentive`
- **backgrounds:** `solid` `taygeta` `celaeno` `alcyone` `maia` `merope`
- Any catalog id also accepts `all` for a deterministic pick from the seed.
- Authoritative live list: `npx novatar --list`.

## Environment notes (Vercel Computer / sandboxes)

- Node ≥ 18 required; no native compilation, no network calls, no config files.
- `npm install novatar` or plain `npx novatar` both work in fresh sandboxes.
- PNG rasterization is pure WASM and offline-safe.
- To serve images from a sandbox: `npx vercel deploy` the example, or run the
  handler in any Node server.

## Failure modes

| Message                                             | Fix                                        |
| --------------------------------------------------- | ------------------------------------------ |
| `Unknown avatar variant or family: X`               | pick ids from `--list`                     |
| `Unknown shape/expression/background style: X`       | pick ids from `--list --engine squishmoji` |
| `Unknown engine: X`                                 | `avatars`, `squishmoji`, or `auto`         |
| `--colors needs exactly 5 …`                        | pass 5 comma-separated hex colors          |
| `animated raster exports (gif/apng) require the squishmoji engine` | drop `--engine avatars` or pick a still format |
| `--animate applies to svg, json, gif, and apng …`   | still formats cannot animate               |
| `WebP export needs the optional "sharp" …`          | `npm install sharp` (prebuilt, no compile) |
| `batch … needs --out with a "{seed}" placeholder`   | add `--out 'dir/{seed}.png'`               |
| `--out must contain "{seed}" in batch mode`         | add the placeholder to --out               |
| `pass either a named seed or --random, not both`    | drop one of the two                        |
| `png rasterization failed: … cannot read … WASM …`  | edge runtime — pass `wasmBinary`           |
