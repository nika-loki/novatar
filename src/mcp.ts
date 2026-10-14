#!/usr/bin/env node
/**
 * novatar MCP server — exposes the avatar engines to AI agents (Claude,
 * Notion AI agents, Cursor, …) over the Model Context Protocol (stdio).
 *
 * Zero SDK dependency: a compact, permissive JSON-RPC 2.0 implementation
 * speaking newline-delimited MCP messages. Never writes anything but
 * protocol frames to stdout (errors go to stderr) so it is safe to embed.
 */
import { createNovatar, listNovatarStyles, resolveEngine, NovatarOutputFormat, type NovatarOptions } from './index'

const SERVER_NAME = 'novatar'
const SERVER_VERSION = '0.2.0'
const SUPPORTED_PROTOCOL_VERSION = '2025-06-18'

// ---------------------------------------------------------------------------
// JSON-RPC plumbing
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: Record<string, unknown>
}

interface ContentBlock {
  type: 'text' | 'image'
  text?: string
  data?: string
  mimeType?: string
}

type ResponseResult = Record<string, unknown>

function sendResponse(
  output: NodeJS.WritableStream,
  id: number | string | null,
  result: ResponseResult,
): void {
  const frame = JSON.stringify({ jsonrpc: '2.0', id, result })
  output.write(frame + '\n')
}

function sendError(
  output: NodeJS.WritableStream,
  id: number | string | null,
  code: number,
  message: string,
): void {
  const frame = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
  output.write(frame + '\n')
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const GENERATE_SCHEMA = {
  type: 'object',
  properties: {
    seed: { type: 'string', description: 'Deterministic identity. Same seed → same avatar, forever. Omit for the default "Space UI".' },
    engine: { type: 'string', enum: ['avatars', 'duo', 'auto'], description: 'avatars = 21 generative variants; duo = expressive characters (21 shapes × 22 expressions × 6 backgrounds); auto = deterministic pick from the seed. Default auto.' },
    variant: { type: 'string', description: '[avatars engine] variant id (e.g. "triton", "pebble"), family ("gradient"|"fluid"|"classic"|"paletteless"), or "all".' },
    shape: { type: 'string', description: '[duo engine] body shape id or "all" (circle, cat, ghost, ufo, bot, star, …).' },
    expression: { type: 'string', description: '[duo engine] expression id or "all" (happy, loving, angry, sleepy, …).' },
    background: { type: 'string', description: '[duo engine] background style id or "all" (solid, taygeta, maia, merope, celaeno, alcyone).' },
    colors: { type: 'array', items: { type: 'string' }, description: 'Exactly 5 hex colors overriding the seeded palette (both engines). The seed keeps driving geometry.' },
    size: { type: 'number', description: 'Rendered size in pixels (default 512 stills, 256 animated).' },
    format: { type: 'string', enum: ['svg', 'json', 'png', 'webp', 'gif', 'apng'], description: 'svg (default) raw markup; json full metadata + dataUri; png/webp still images; gif/apng ANIMATED (duo engine: blinking + gaze drift, seamless 4.7s loop).' },
    animate: { type: 'boolean', description: 'With format svg/json: emit an animated (SMIL) SVG that loops forever inside <img> tags.' },
    fps: { type: 'number', description: 'Animated exports: frames per second 1-60 (default 12).' },
    duration: { type: 'number', description: 'Animated exports: loop seconds; snapped to the 4.7s blink cycle (default 4.7).' },
    wobble: { type: 'boolean', description: 'Animated exports: add the gentle floating wobble.' },
    quality: { type: 'number', description: 'WebP quality 1-100 (default 92; needs the optional sharp package).' },
    output_path: { type: 'string', description: 'Optional file path to write the result to (any format). Parent directories are created.' },
  },
  additionalProperties: false,
} as const

const LIST_SCHEMA = {
  type: 'object',
  properties: {
    engine: { type: 'string', enum: ['avatars', 'duo'], description: 'Restrict the catalog to one engine. Omit for both.' },
  },
  additionalProperties: false,
} as const

const PALETTE_SCHEMA = {
  type: 'object',
  properties: {
    seed: { type: 'string', description: 'Deterministic seed for the palette.' },
    mode: { type: 'string', enum: ['presets', 'random', 'nice'], description: 'Palette strategy. Omit for deterministic auto-pick.' },
  },
  additionalProperties: false,
} as const

function toolResult(content: ContentBlock[], isError = false): ResponseResult {
  return isError ? { content, isError: true } : { content }
}

function textResult(text: string, isError = false): ResponseResult {
  return toolResult([{ type: 'text', text }], isError)
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function callGenerate(params: Record<string, unknown>): Promise<ResponseResult> {
  const format = (params.format as string) ?? 'svg'
  const validFormats = ['svg', 'json', 'png', 'webp', 'gif', 'apng']
  if (!validFormats.includes(format)) {
    return textResult(`Invalid format "${String(params.format)}". Use ${validFormats.join(', ')}.`, true)
  }
  const animate = params.animate === true
  const fps = typeof params.fps === 'number' ? params.fps : undefined
  const duration = typeof params.duration === 'number' ? params.duration : undefined
  const wobble = params.wobble === true
  const quality = typeof params.quality === 'number' ? params.quality : undefined

  const options: NovatarOptions & { output_path?: string } = {}
  if (typeof params.seed === 'string' && params.seed.trim()) options.seed = params.seed
  if (typeof params.engine === 'string') options.engine = params.engine
  if (typeof params.variant === 'string') options.variant = params.variant
  if (typeof params.shape === 'string') options.shape = params.shape
  if (typeof params.expression === 'string') options.expression = params.expression
  if (typeof params.background === 'string') options.backgroundStyle = params.background
  if (Array.isArray(params.colors) && params.colors.every((c) => typeof c === 'string')) {
    options.colors = params.colors as string[]
  }
  if (typeof params.size === 'number' && Number.isFinite(params.size)) options.size = params.size
  const outputPath = typeof params.output_path === 'string' ? params.output_path : undefined

  const animatedRaster = format === 'gif' || format === 'apng'
  const wantsAnimation = animate || animatedRaster
  if (wantsAnimation && !options.engine) {
    options.engine = 'duo'
  }
  if (animatedRaster && options.engine && resolveEngine(options.seed || 'Space UI', options.engine) === 'avatars') {
    return textResult('Animated raster exports (gif/apng) require the duo engine.', true)
  }

  const writeBinary = async (bytes: Uint8Array, label: string): Promise<ResponseResult> => {
    const blocks: ContentBlock[] = [
      { type: 'image', data: toBase64(bytes), mimeType: label === 'apng' ? 'image/png' : label === 'gif' ? 'image/gif' : label === 'webp' ? 'image/webp' : 'image/png' },
      {
        type: 'text',
        text: JSON.stringify({
          format: label,
          bytes: bytes.length,
          ...(animate || animatedRaster ? { animated: true, ...(fps ? { fps } : {}), ...(duration ? { duration } : {}) } : {}),
          ...(options.seed !== undefined ? { seed: options.seed } : {}),
          engine: options.engine ?? 'auto',
        }),
      },
    ]
    if (outputPath) {
      const { writeFile, mkdir } = await import('node:fs/promises')
      const { dirname } = await import('node:path')
      if (dirname(outputPath) && dirname(outputPath) !== '.') {
        await mkdir(dirname(outputPath), { recursive: true })
      }
      await writeFile(outputPath, bytes)
      blocks.push({ type: 'text', text: `wrote ${outputPath}` })
    }
    return toolResult(blocks)
  }

  try {
    if (format === 'png' || format === 'webp') {
      const svg = createNovatar(options)
      if (format === 'webp') {
        const { renderWebp } = await import('./raster')
        return await writeBinary(await renderWebp(svg, { width: options.size, quality }), 'webp')
      }
      const { renderPng } = await import('./raster')
      return await writeBinary(await renderPng(svg, { width: options.size }), 'png')
    }

    if (animatedRaster) {
      const animationOptions = {
        seed: options.seed || 'Space UI',
        shape: options.shape,
        expression: options.expression,
        backgroundStyle: options.backgroundStyle,
        colors: options.colors,
        fps,
        duration,
        wobble,
        width: options.size ?? 256,
      }
      if (format === 'gif') {
        const { renderAnimatedGif } = await import('./animation')
        return await writeBinary(await renderAnimatedGif(animationOptions), 'gif')
      }
      const { renderAnimatedApng } = await import('./animation')
      return await writeBinary(await renderAnimatedApng(animationOptions), 'apng')
    }

    if (format === 'json' && animate && resolveEngine(options.seed || 'Space UI', options.engine) === 'duo') {
      const { renderAnimatedSvg, resolveShape, resolveExpression, resolveBackgroundStyle } = await import('./index')
      const svg = renderAnimatedSvg({
        seed: options.seed || 'Space UI',
        shape: options.shape,
        expression: options.expression,
        backgroundStyle: options.backgroundStyle,
        colors: options.colors,
        fps,
        duration,
        wobble,
      })
      const seed = options.seed || 'Space UI'
      const payload = JSON.stringify({
        seed,
        engine: 'duo',
        animated: true,
        fps: fps ?? 12,
        ...(duration ? { duration } : {}),
        shape: resolveShape(seed, options.shape),
        expression: resolveExpression(seed, options.expression),
        backgroundStyle: resolveBackgroundStyle(seed, options.backgroundStyle),
        svg,
        dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      })
      return textResult(payload)
    }

    if (format === 'json') {
      const json = createNovatar({ ...options, format: NovatarOutputFormat.json })
      const payload = JSON.stringify(json)
      if (outputPath) {
        const { writeFile, mkdir } = await import('node:fs/promises')
        const { dirname } = await import('node:path')
        if (dirname(outputPath) && dirname(outputPath) !== '.') {
          await mkdir(dirname(outputPath), { recursive: true })
        }
        await writeFile(outputPath, payload)
        return textResult(`wrote ${outputPath}\n${payload}`)
      }
      return textResult(payload)
    }

    // svg (optionally animated)
    let svg: string
    if (animate && resolveEngine(options.seed || 'Space UI', options.engine) === 'duo') {
      const { renderAnimatedSvg } = await import('./animation')
      svg = renderAnimatedSvg({
        seed: options.seed || 'Space UI',
        shape: options.shape,
        expression: options.expression,
        backgroundStyle: options.backgroundStyle,
        colors: options.colors,
        fps,
        duration,
        wobble,
      })
    } else {
      svg = createNovatar({ ...options, animate })
    }
    if (outputPath) {
      const { writeFile, mkdir } = await import('node:fs/promises')
      const { dirname } = await import('node:path')
      if (dirname(outputPath) && dirname(outputPath) !== '.') {
        await mkdir(dirname(outputPath), { recursive: true })
      }
      await writeFile(outputPath, svg)
      return textResult(`wrote ${outputPath} (${svg.length} bytes of SVG)`)
    }
    return textResult(svg)
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), true)
  }
}

function callListStyles(params: Record<string, unknown>): ResponseResult {
  const engine = typeof params.engine === 'string' ? params.engine : undefined
  return textResult(JSON.stringify(listNovatarStyles(engine), null, 2))
}

async function callPalette(params: Record<string, unknown>): Promise<ResponseResult> {
  const { generatePalette } = await import('./palette')
  const seed = typeof params.seed === 'string' ? params.seed : undefined
  const mode = typeof params.mode === 'string' ? (params.mode as 'presets' | 'random' | 'nice') : undefined
  const palette = generatePalette(seed, mode ? { mode } : {})
  return textResult(JSON.stringify(palette))
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

function listTools(): ResponseResult {
  return {
    tools: [
      {
        name: 'novatar_generate',
        description:
          'Generate a deterministic SVG avatar. Same seed + options → byte-identical avatar. ' +
          'Returns raw SVG (format "svg"), full JSON metadata with a ready-to-use dataUri (format "json"), ' +
          'or a PNG image block (format "png"). Optionally writes the result to output_path.',
        inputSchema: GENERATE_SCHEMA,
      },
      {
        name: 'novatar_list_styles',
        description:
          'List every available style: avatars engine variants by family, and duo shapes, expressions, and backgrounds.',
        inputSchema: LIST_SCHEMA,
      },
      {
        name: 'novatar_palette',
        description: 'Generate the deterministic 5-color palette for a seed.',
        inputSchema: PALETTE_SCHEMA,
      },
    ],
  }
}

async function handleRequest(request: JsonRpcRequest, output: NodeJS.WritableStream): Promise<void> {
  const { method, params = {} } = request
  const id = request.id ?? null
  if (request.id === undefined) return // notification or malformed frame — no id, no response

  switch (method) {
    case 'initialize':
      sendResponse(output, id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'Generate deterministic SVG avatars. Call novatar_list_styles for the catalog, ' +
          'then novatar_generate with a seed. The same seed always yields the same avatar.',
      })
      return
    case 'ping':
      sendResponse(output, id, {})
      return
    case 'tools/list':
      sendResponse(output, id, listTools())
      return
    case 'tools/call': {
      const name = params.name
      if (name === 'novatar_generate') {
        sendResponse(output, id, await callGenerate((params.arguments as Record<string, unknown>) ?? {}))
        return
      }
      if (name === 'novatar_list_styles') {
        sendResponse(output, id, callListStyles((params.arguments as Record<string, unknown>) ?? {}))
        return
      }
      if (name === 'novatar_palette') {
        sendResponse(output, id, await callPalette((params.arguments as Record<string, unknown>) ?? {}))
        return
      }
      sendError(output, id, -32602, `Unknown tool: ${String(name)}`)
      return
    }
    case 'resources/list':
      sendResponse(output, id, { resources: [] })
      return
    case 'prompts/list':
      sendResponse(output, id, { prompts: [] })
      return
    case 'logging/setLevel':
      sendResponse(output, id, {})
      return
    default:
      if (method.startsWith('notifications/')) return // notifications get no response
      sendError(output, id, -32601, `Method not found: ${method}`)
  }
}

/** Runs the MCP stdio server until stdin closes. */
export async function runMcpServer(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<void> {
  const { createInterface } = await import('node:readline')
  const readline = createInterface({ input, terminal: false })

  return new Promise((resolve) => {
    let busy = false
    let closed = false
    const queue: JsonRpcRequest[] = []

    const drain = async () => {
      if (busy) return
      busy = true
      while (queue.length > 0) {
        const request = queue.shift()
        if (!request) break
        try {
          await handleRequest(request, output)
        } catch (error) {
          if (request.id !== undefined && request.id !== null) {
            sendError(output, request.id, -32603, error instanceof Error ? error.message : String(error))
          }
        }
      }
      busy = false
      if (closed) resolve()
    }

    readline.on('line', (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        process.stderr.write(`novatar-mcp: ignoring malformed line\n`)
        return
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as JsonRpcRequest).method === 'string'
      ) {
        queue.push(parsed as JsonRpcRequest)
        void drain()
      }
    })

    readline.on('close', () => {
      closed = true
      if (!busy) resolve()
    })
  })
}

// Direct execution (novatar-mcp bin): start the server when this module is the
// invoked program (argv[1] basename is "mcp" regardless of extension/platform).
const invokedAs = (process.argv[1] ?? '').split(/[\\/]/).pop() ?? ''
if (invokedAs.replace(/\.(js|cjs|mjs)$/, '').toLowerCase() === 'mcp') {
  runMcpServer().catch((error: unknown) => {
    process.stderr.write(`novatar-mcp: ${(error as Error).message}\n`)
    process.exit(1)
  })
}
