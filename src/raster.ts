/**
 * Optional PNG rasterization for novatar (pure WASM — no native binaries,
 * works in Node, Vercel Functions, and sandboxes without compilation).
 *
 * The resvg WASM module is loaded lazily: code paths that only need SVG
 * never touch it, keeping cold starts fast.
 */

export interface RenderPngOptions {
  /** Target width in pixels. Defaults to 512 (or height×aspect when only height given). */
  width?: number
  /** Target height in pixels. */
  height?: number
  /**
   * Preloaded WASM bytes. Required on runtimes without a filesystem (edge);
   * in Node the bundled wasm is read automatically.
   */
  wasmBinary?: Uint8Array | ArrayBuffer
  /** Additional resvg options (fonts, background, etc.). */
  resvgOptions?: Record<string, unknown>
}

type ResvgModule = typeof import('@resvg/resvg-wasm')

// Native in CommonJS; undefined in ESM where import.meta.url takes over.
declare const __filename: string | undefined

let wasmPromise: Promise<ResvgModule> | null = null

async function loadResvg(wasmBinary?: Uint8Array | ArrayBuffer): Promise<ResvgModule> {
  const mod = (await import('@resvg/resvg-wasm')) as unknown as ResvgModule

  let binary = wasmBinary
  if (!binary) {
    try {
      const { createRequire } = await import('node:module')
      const { readFile } = await import('node:fs/promises')
      const selfReference =
        typeof __filename !== 'undefined' ? __filename : import.meta.url
      const nodeRequire = createRequire(selfReference as string)
      const wasmPath = nodeRequire.resolve('@resvg/resvg-wasm/index_bg.wasm')
      binary = new Uint8Array(await readFile(wasmPath))
    } catch {
      throw new Error(
        'novatar/raster: this runtime cannot read the bundled WASM file. ' +
          'Pass `wasmBinary` (the contents of @resvg/resvg-wasm/index_bg.wasm).',
      )
    }
  }

  await mod.initWasm(binary as Uint8Array)
  return mod
}

function ensureWasm(wasmBinary?: Uint8Array | ArrayBuffer): Promise<ResvgModule> {
  if (!wasmPromise) {
    wasmPromise = loadResvg(wasmBinary).catch((error) => {
      wasmPromise = null // allow retry after a transient failure
      throw error
    })
  }
  return wasmPromise
}

/** Rasterizes an SVG string to PNG bytes. */
export async function renderPng(svg: string, options: RenderPngOptions = {}): Promise<Uint8Array> {
  const { Resvg } = await ensureWasm(options.wasmBinary)
  const rendered = renderToPixmap(Resvg, svg, options)
  return rendered.asPng() as Uint8Array
}

/** Raw RGBA pixels of a rasterized SVG — the shared input for every encoder. */
export interface RasterPixmap {
  width: number
  height: number
  data: Uint8Array
}

type ResvgConstructor = new (svg: string, options: Record<string, unknown>) => {
  render: () => { width: number; height: number; pixels: Uint8Array; asPng: () => Uint8Array }
}

export function resolveFitTo(options: RenderPngOptions): Record<string, unknown> {
  if (options.width) return { mode: 'width', value: options.width }
  if (options.height) return { mode: 'height', value: options.height }
  return { mode: 'width', value: 512 }
}

function renderToPixmap(
  Resvg: ResvgConstructor,
  svg: string,
  options: RenderPngOptions,
): { width: number; height: number; pixels: Uint8Array; asPng: () => Uint8Array } {
  return new Resvg(svg, {
    fitTo: resolveFitTo(options) as never,
    ...(options.resvgOptions ?? {}),
  }).render()
}

/** Rasterizes an SVG string to raw RGBA pixels (width × height × 4 bytes). */
export async function renderPixmap(svg: string, options: RenderPngOptions = {}): Promise<RasterPixmap> {
  const { Resvg } = await ensureWasm(options.wasmBinary)
  const rendered = renderToPixmap(Resvg, svg, options)
  return { width: rendered.width, height: rendered.height, data: rendered.pixels }
}

export interface RenderWebpOptions extends RenderPngOptions {
  /** WebP quality 1-100. Defaults to 92. */
  quality?: number
  /** Trade encode time for smaller files (0-6). Defaults to 4. */
  effort?: number
}

/**
 * Rasterizes an SVG string to WebP via sharp (optional dependency, loaded
 * lazily — only WebP requests pay for it). Throws with install guidance
 * when sharp is unavailable on the platform.
 */
export async function renderWebp(svg: string, options: RenderWebpOptions = {}): Promise<Uint8Array> {
  let sharpModule: typeof import('sharp').default
  try {
    sharpModule = (await import('sharp')).default
  } catch {
    throw new Error(
      'novatar/raster: WebP export needs the optional "sharp" dependency. ' +
        'Install it with `npm install sharp` (prebuilt binaries, no compilation).',
    )
  }
  const { width, height, data } = await renderPixmap(svg, options)
  const buffer = await sharpModule(data, {
    raw: { width, height, channels: 4 },
  })
    .webp({ quality: options.quality ?? 92, effort: options.effort ?? 4 })
    .toBuffer()
  return new Uint8Array(buffer)
}

/** Rasterizes an SVG string to a `data:image/png;base64` URI. */
export async function renderPngDataUri(svg: string, options: RenderPngOptions = {}): Promise<string> {
  const png = await renderPng(svg, options)
  let binary = ''
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:image/png;base64,${btoa(binary)}`
}
