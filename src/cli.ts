#!/usr/bin/env node
/**
 * novatar CLI — deterministic avatars for humans and AI agents.
 *
 * Designed for non-interactive use: no prompts, stable exit codes,
 * machine-readable JSON on request, binary-safe stdout, batch-friendly.
 */
import { readFileSync } from 'node:fs'
import {
  createNovatar,
  listNovatarStyles,
  resolveEngine,
  resolveShape,
  resolveExpression,
  resolveBackgroundStyle,
  renderAnimatedSvg,
  renderAnimatedGif,
  renderAnimatedApng,
  renderWebp,
  renderPng,
  NovatarOutputFormat,
  NovatarEngine,
  DEFAULT_SEED,
  type NovatarOptions,
  type AnimatedAvatarOptions,
} from './index'

const VERSION = '0.2.0'

const HELP = `novatar ${VERSION} — deterministic generative SVG avatars

USAGE
  novatar [seed] [options]        Generate one avatar (SVG to stdout by default)
  novatar --batch a,b,c [opts]    Generate many avatars in one invocation
  echo ids | novatar - [opts]     Seeds from stdin (one per line; >1 = batch)
  novatar --list [--engine ID]    Print the style catalog as JSON
  novatar --mcp                   Start the MCP stdio server (same as novatar-mcp)
  novatar --help | --version

ENGINES
  avatars     21 generative variants in 4 families (gradient, fluid, classic, paletteless)
  duo  21 body shapes x 22 expressions x 6 backgrounds (aliases: duo, emoji)
  auto        pick deterministically from the seed (default)

SEEDS
  novatar justin ...              One named seed (deterministic identity)
  novatar --random ...            One fresh random seed (reported on stderr + JSON)
  novatar --random --count 20 ... 20 fresh random seeds
  novatar --batch alice,bob,carol ...
  git log --format=%an | sort -u | novatar - --png --out 'team/{seed}.png'

STYLE OPTIONS
  --engine <id>                   Engine: avatars | duo | auto (default auto)
  --variant <id|family|all>       [avatars] variant, family, or "all"
  --shape <id|all>                [duo] body shape
  --expression <id|all>           [duo] facial expression
  --background <id|all>           [duo] background style (alias: --background-style)
  --colors <hex,hex,hex,hex,hex>  Exactly 5 hex colors, both engines (overrides the
                                  seeded palette; geometry stays seed-driven)
  --circle                        [avatars] clip to a full circle
  --effect <none|noise>           [avatars] post-processing effect
  --animate                       [avatars] enable built-in SVG animation
  --size <px>                     Rendered size in pixels (1-4096)

OUTPUT FORMATS
  --format svg                    Static SVG (default)
  --format json                   Metadata + svg + dataUri (array in batch)
  --format png                    Still PNG
  --format webp                   Still WebP (needs optional sharp: npm i sharp)
  --format gif                    ANIMATED GIF — duo engine (blinks, gazes)
  --format apng                   ANIMATED APNG with alpha — duo engine
  --animate                       With --format svg/json: animated (SMIL) SVG

ANIMATION OPTIONS (gif / apng / --animate)
  --fps <1..60>                   Frames per second (default 12)
  --duration <seconds>            Loop length; snapped to the 4.7s blink cycle
                                  for seamless looping (default 4.7)
  --wobble                        Add the gentle floating wobble transform
  --quality <1..100>              WebP quality (default 92)
  --gif-bg <hex>                  GIF matte color behind transparency (default #ffffff)

DELIVERY
  --datauri                       Print a ready-to-embed data:image/... URI instead of
                                  the raw payload (one per line in batch)
  --out <path>                    Write result to a file; use "{seed}" as a placeholder
                                  in batch mode (e.g. --out 'avatars/{seed}.png')
  --quiet                         Suppress stderr notes (random seeds, wrote-file info)

INTROSPECTION & SERVERS
  --list [--engine <id>]          Machine-readable style catalog (JSON)
  --mcp                           MCP stdio server for AI agents

EXAMPLES
  novatar justin > justin.svg
  novatar justin --engine duo --shape cat --expression loving --size 256
  novatar justin --engine avatars --variant triton --format json
  novatar justin --png --size 512 --out avatar.png
  novatar justin --webp --quality 95 --out avatar.webp
  novatar justin --animate --out animated.svg          # SMIL, loops forever
  novatar justin --gif --size 256 --out avatar.gif     # animated GIF
  novatar justin --apng --size 256 --out avatar.png    # animated, alpha
  novatar justin --gif --datauri                       # data:image/gif;base64,...
  novatar --batch alice,bob,carol --json                # JSON array to stdout
  novatar --batch alice,bob,carol --apng --out 'team/{seed}.png'
  novatar --random --count 12 --engine avatars --variant all --out 'grid/{seed}.svg'
  echo $USER_ID | novatar - --json
  novatar --list --engine duo

Exit codes: 0 success, 1 usage or generation error.
Determinism: identical seed + options produce byte-identical output.
`

type Format = 'svg' | 'json' | 'png' | 'webp' | 'gif' | 'apng'
const FORMATS: readonly Format[] = ['svg', 'json', 'png', 'webp', 'gif', 'apng']
const ANIMATED_RASTER: readonly Format[] = ['gif', 'apng']

const MIME: Record<Format, string> = {
  svg: 'image/svg+xml',
  json: 'application/json',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  apng: 'image/png',
}

interface ParsedArgs {
  seed?: string
  batch?: string[]
  options: NovatarOptions
  format: Format
  animate: boolean
  fps?: number
  duration?: number
  wobble: boolean
  quality?: number
  gifBackground?: string
  datauri: boolean
  out?: string
  list: boolean
  mcp: boolean
  random: boolean
  quiet: boolean
  count?: number
  help: boolean
  version: boolean
}

function fail(message: string, code = 1): never {
  process.stderr.write(`novatar: ${message}\n`)
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    options: {},
    format: 'svg',
    animate: false,
    wobble: false,
    datauri: false,
    list: false,
    mcp: false,
    random: false,
    quiet: false,
    help: false,
    version: false,
  }
  const positional: string[] = []

  const expectValue = (flag: string, index: number): string => {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      fail(`missing value for ${flag}`)
    }
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--help':
      case '-h':
        parsed.help = true
        break
      case '--version':
      case '-v':
        parsed.version = true
        break
      case '--engine':
      case '-e':
        parsed.options.engine = expectValue(arg, i++)
        break
      case '--variant':
        parsed.options.variant = expectValue(arg, i++)
        break
      case '--shape':
        parsed.options.shape = expectValue(arg, i++)
        break
      case '--expression':
        parsed.options.expression = expectValue(arg, i++)
        break
      case '--background':
      case '--background-style':
        parsed.options.backgroundStyle = expectValue(arg, i++)
        break
      case '--size': {
        const raw = expectValue(arg, i++)
        const size = Number(raw)
        if (!Number.isFinite(size) || size < 1 || size > 4096) {
          fail(`--size must be a number between 1 and 4096 (got "${raw}")`)
        }
        parsed.options.size = size
        break
      }
      case '--circle':
        parsed.options.circle = true
        break
      case '--effect':
        parsed.options.effect = expectValue(arg, i++)
        break
      case '--animate':
        parsed.animate = true
        parsed.options.animate = true
        break
      case '--colors': {
        const raw = expectValue(arg, i++)
        const colors = raw.split(',').map((c) => c.trim()).filter(Boolean)
        if (colors.length !== 5) {
          fail(`--colors needs exactly 5 comma-separated hex colors (got ${colors.length})`)
        }
        parsed.options.colors = colors
        break
      }
      case '--format': {
        const raw = expectValue(arg, i++).toLowerCase()
        if (!FORMATS.includes(raw as Format)) {
          fail(`--format must be one of ${FORMATS.join('|')} (got "${raw}")`)
        }
        parsed.format = raw as Format
        break
      }
      case '--json':
        parsed.format = 'json'
        break
      case '--png':
        parsed.format = 'png'
        break
      case '--webp':
        parsed.format = 'webp'
        break
      case '--gif':
        parsed.format = 'gif'
        break
      case '--apng':
        parsed.format = 'apng'
        break
      case '--fps': {
        const raw = expectValue(arg, i++)
        const fps = Number(raw)
        if (!Number.isFinite(fps) || fps < 1 || fps > 60) {
          fail(`--fps must be a number between 1 and 60 (got "${raw}")`)
        }
        parsed.fps = fps
        break
      }
      case '--duration': {
        const raw = expectValue(arg, i++)
        const duration = Number(raw)
        if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
          fail(`--duration must be a positive number of seconds (got "${raw}")`)
        }
        parsed.duration = duration
        break
      }
      case '--wobble':
        parsed.wobble = true
        break
      case '--quality': {
        const raw = expectValue(arg, i++)
        const quality = Number(raw)
        if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
          fail(`--quality must be a number between 1 and 100 (got "${raw}")`)
        }
        parsed.quality = quality
        break
      }
      case '--gif-bg':
        parsed.gifBackground = expectValue(arg, i++)
        break
      case '--datauri':
        parsed.datauri = true
        break
      case '--out':
      case '-o':
        parsed.out = expectValue(arg, i++)
        break
      case '--batch':
      case '-b': {
        const raw = expectValue(arg, i++)
        parsed.batch = raw.split(',').map((s) => s.trim()).filter(Boolean)
        if (parsed.batch.length === 0) fail('--batch needs at least one comma-separated seed')
        break
      }
      case '--count': {
        const raw = expectValue(arg, i++)
        const count = Number(raw)
        if (!Number.isInteger(count) || count < 1 || count > 1000) {
          fail(`--count must be an integer between 1 and 1000 (got "${raw}")`)
        }
        parsed.count = count
        break
      }
      case '--random':
        parsed.random = true
        break
      case '--quiet':
      case '-q':
        parsed.quiet = true
        break
      case '--list':
        parsed.list = true
        break
      case '--mcp':
        parsed.mcp = true
        break
      case '-':
        positional.push(arg)
        break
      default:
        if (arg.startsWith('--')) {
          fail(`unknown option "${arg}" (see --help)`)
        }
        positional.push(arg)
    }
  }

  if (positional.length > 1) fail('expected a single seed argument (use --batch for many)')
  parsed.seed = positional[0]
  return parsed
}

function randomSeed(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function readStdinSeeds(): string[] {
  try {
    return readFileSync(0, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Filesystem-safe rendering of a seed for {seed} placeholders. */
function fileNameFor(seed: string): string {
  const safe = seed
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
  return safe || 'avatar'
}

function note(quiet: boolean, message: string): void {
  if (!quiet) process.stderr.write(`novatar: ${message}\n`)
}

async function writeOut(data: string | Uint8Array, out: string | undefined): Promise<void> {
  if (!out || out === '-') {
    if (typeof data === 'string') {
      process.stdout.write(data.endsWith('\n') ? data : data + '\n')
    } else {
      process.stdout.write(Buffer.from(data))
    }
    return
  }
  const { writeFile, mkdir } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  const directory = dirname(out)
  if (directory && directory !== '.') await mkdir(directory, { recursive: true })
  await writeFile(out, data)
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

interface Payload {
  text?: string
  bytes?: Uint8Array
  mime: string
}

async function generatePayload(args: ParsedArgs, seed: string): Promise<Payload> {
  const animation: AnimatedAvatarOptions = {
    seed,
    shape: args.options.shape,
    expression: args.options.expression,
    backgroundStyle: args.options.backgroundStyle,
    colors: args.options.colors,
    fps: args.fps,
    duration: args.duration,
    wobble: args.wobble,
  }

  if (args.format === 'json') {
    if (args.animate && resolveEngine(seed, args.options.engine) === NovatarEngine.duo) {
      const svg = renderAnimatedSvg(animation)
      const json = {
        seed,
        engine: NovatarEngine.duo,
        animated: true,
        fps: animation.fps ?? 12,
        duration: args.duration,
        shape: resolveShape(seed, args.options.shape),
        expression: resolveExpression(seed, args.options.expression),
        backgroundStyle: resolveBackgroundStyle(seed, args.options.backgroundStyle),
        svg,
        dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      }
      return { text: JSON.stringify(json, null, 2), mime: MIME.json }
    }
    const json = createNovatar({ ...args.options, seed, format: NovatarOutputFormat.json })
    return { text: JSON.stringify(json, null, 2), mime: MIME.json }
  }

  if (args.format === 'svg') {
    if (args.animate) {
      const engine = resolveEngine(seed, args.options.engine)
      if (engine === NovatarEngine.duo) {
        return { text: renderAnimatedSvg(animation), mime: MIME.svg }
      }
      // avatars engine: built-in declarative animation, animate flag already set
      return { text: createNovatar({ ...args.options, seed }), mime: MIME.svg }
    }
    return { text: createNovatar({ ...args.options, seed }), mime: MIME.svg }
  }

  if (args.format === 'png') {
    const svg = createNovatar({ ...args.options, seed })
    return { bytes: await renderPng(svg, { width: args.options.size }), mime: MIME.png }
  }

  if (args.format === 'webp') {
    const svg = createNovatar({ ...args.options, seed })
    try {
      return {
        bytes: await renderWebp(svg, { width: args.options.size, quality: args.quality }),
        mime: MIME.webp,
      }
    } catch (error) {
      fail((error as Error).message)
    }
  }

  // gif / apng — animated raster, duo engine
  const raster = { ...animation, width: args.options.size ?? 256, gifBackground: args.gifBackground }
  if (args.format === 'gif') {
    return { bytes: await renderAnimatedGif(raster), mime: MIME.gif }
  }
  return { bytes: await renderAnimatedApng(raster), mime: MIME.apng }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (args.version) {
    process.stdout.write(VERSION + '\n')
    return 0
  }
  if (args.mcp) {
    const { runMcpServer } = await import('./mcp')
    await runMcpServer(process.stdin, process.stdout)
    return 0
  }
  if (args.list) {
    const catalog = listNovatarStyles(args.options.engine)
    await writeOut(JSON.stringify(catalog, null, 2), args.out)
    return 0
  }

  // ------------------------------------------------------------ validation
  if (args.format === 'json' && args.datauri) {
    fail('--datauri is a stdout payload mode; combine it with svg/png/webp/gif/apng, not --json')
  }
  const animatedExport = ANIMATED_RASTER.includes(args.format) || (args.animate && args.format === 'svg')
  if (args.animate && (args.format === 'png' || args.format === 'webp')) {
    fail('--animate applies to svg, json, gif, and apng — still formats cannot animate')
  }
  if ((args.fps !== undefined || args.duration !== undefined || args.wobble) && !animatedExport) {
    fail('--fps/--duration/--wobble only apply to animated exports (gif, apng, or --animate)')
  }

  // Animation defaults to the duo engine (the expressive animated
  // one), mirroring the gif/apng rule. Explicit --engine avatars keeps the
  // avatars engine's built-in animation for svg.
  const wantsAnimation = args.animate || ANIMATED_RASTER.includes(args.format)
  if (wantsAnimation) {
    if (!args.options.engine) {
      args.options.engine = NovatarEngine.duo
      note(args.quiet, 'animation: engine defaulted to duo')
    } else if (ANIMATED_RASTER.includes(args.format) && resolveEngine('probe', args.options.engine) === NovatarEngine.avatars) {
      fail('animated raster exports (gif/apng) require the duo engine')
    }
  }

  // ------------------------------------------------------------------ seeds
  let seeds: string[] = []
  let seedSource = 'named'

  if (args.seed === '-') {
    seeds = readStdinSeeds()
    seedSource = 'stdin'
    if (seeds.length === 0) fail('stdin was empty — pass a seed or --random')
  } else if (args.seed !== undefined) {
    if (args.seed === 'random') args.random = true
    else seeds = [args.seed]
  }

  if (args.batch) {
    if (seeds.length > 0) fail('pass seeds either positionally or via --batch, not both')
    seeds = args.batch
    seedSource = 'batch'
  }

  if (args.count !== undefined) {
    if (seeds.length > 0) fail('--count generates random seeds; remove it when seeds are given')
    args.random = true
    seeds = Array.from({ length: args.count }, () => randomSeed())
    seedSource = 'random'
  } else if (args.random && seeds.length === 0) {
    seeds = [randomSeed()]
    seedSource = 'random'
  } else if (args.random && seeds.length > 0 && args.seed !== 'random') {
    fail('pass either a named seed or --random, not both')
  }

  if (seeds.length === 0) seeds = [DEFAULT_SEED]
  if (args.random && seedSource === 'random') {
    note(args.quiet, `seeds: ${seeds.join(', ')}`)
  }

  const isBatch = seeds.length > 1
  const binary = args.format === 'png' || args.format === 'webp' || args.format === 'gif' || args.format === 'apng'

  if (isBatch && binary && args.datauri !== true && (!args.out || !args.out.includes('{seed}'))) {
    fail(`batch ${args.format} needs --out with a "{seed}" placeholder (or --datauri for URIs)`)
  }
  if (isBatch && args.out && !args.out.includes('{seed}')) {
    fail(`--out must contain "{seed}" in batch mode (e.g. --out 'avatars/{seed}.${args.format === 'apng' ? 'png' : args.format}')`)
  }

  // Validate engine before generating so errors are crisp.
  resolveEngine(seeds[0] || DEFAULT_SEED, args.options.engine)

  // ------------------------------------------------------------------ emit
  if (args.datauri) {
    const uris: string[] = []
    for (const seed of seeds) {
      const payload = await generatePayload(args, seed)
      if (payload.text !== undefined) {
        uris.push(`data:${payload.mime};utf8,${encodeURIComponent(payload.text)}`)
      } else {
        uris.push(`data:${payload.mime};base64,${base64(payload.bytes!)}`)
      }
    }
    await writeOut(uris.join('\n'), args.out)
    return 0
  }

  if (args.format === 'json') {
    // JSON payloads are aggregated into a single document (array in batch).
    const results: unknown[] = []
    for (const seed of seeds) {
      const payload = await generatePayload(args, seed)
      results.push(JSON.parse(payload.text!))
    }
    await writeOut(JSON.stringify(isBatch ? results : results[0], null, 2), args.out)
    return 0
  }

  if (args.out && args.out.includes('{seed}')) {
    for (const seed of seeds) {
      const payload = await generatePayload(args, seed)
      const path = args.out.replace('{seed}', fileNameFor(seed))
      await writeOut(payload.text ?? payload.bytes!, path)
      note(args.quiet, `wrote ${path} (seed=${seed})`)
    }
    return 0
  }

  // stdout (or a single fixed --out)
  if (isBatch) {
    // text formats only reach here: newline-separated documents
    const parts: string[] = []
    for (const seed of seeds) {
      const payload = await generatePayload(args, seed)
      parts.push(payload.text!)
    }
    await writeOut(parts.join('\n'), args.out)
    return 0
  }

  const payload = await generatePayload(args, seeds[0]!)
  await writeOut(payload.text ?? payload.bytes!, args.out)
  if (args.out && args.out !== '-') {
    note(args.quiet, `wrote ${args.out} (engine=${resolveEngine(seeds[0]!, args.options.engine)}, seed=${seeds[0]})`)
  }
  return 0
}

main()
  .then((code) => {
    // Only force-exit on failure; a zero exit lets stdout pipe writes flush.
    if (code !== 0) process.exit(code)
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    fail(message)
  })
