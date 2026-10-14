import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as novatar from '../dist/index.js'
import * as novatarReact from '../dist/react.js'
import {
  createAvatar,
  createSquishmoji,
  createNovatar,
  resolveVariant,
  resolveEngine,
  resolveLayout,
  renderLayout,
  resolveShape,
  resolveExpression,
  resolveBackgroundStyle,
  listNovatarStyles,
  generatePalette,
  NovatarEngine,
  NovatarOutputFormat,
  AvatarEffect,
  AvatarVariant,
  SquishOutputFormat,
  SHAPE_LIST,
  EXPRESSION_LIST,
  BACKGROUND_STYLE_LIST,
  getAllAvatarDetails,
  isAnimateActive,
} from '../dist/index.js'

const run = promisify(execFile)

// ---------------------------------------------------------------------------
// 1. Avatars engine contracts (ported from @usespaceui/avatars)
// ---------------------------------------------------------------------------

const defaultAvatar = createAvatar()
assert.equal(defaultAvatar, createAvatar(), 'the default name must be deterministic')
assert.equal(defaultAvatar, createAvatar({ name: '' }), 'an empty name uses the stable default avatar')
assert.match(defaultAvatar, /^<svg /, 'createAvatar returns an SVG string')

const escaped = createAvatar({ name: '"><script>alert(1)</script>' })
assert.ok(!escaped.includes('<script>'), 'untrusted titles are escaped in SVG attributes')
assert.match(escaped, /&lt;script&gt;/)

assert.throws(
  () => createAvatar({ colors: ['#ffffff', '#000000', '#ff00ff', '#00ffff'] }),
  /exactly 5 hexadecimal colors/,
)
assert.throws(() => resolveVariant('ada', 'unknown-family'), /Unknown avatar variant or family/)

const classic = createAvatar({
  name: 'ada',
  variant: AvatarVariant.pebble,
  effect: AvatarEffect.noise,
  animate: true,
  format: 'json',
})
assert.equal(classic.effect, AvatarEffect.none, 'unsupported effects are reflected in JSON output')
assert.equal(classic.animate, false, 'unsupported animation is reflected in JSON output')
assert.equal(classic.name, 'ada', 'JSON uses name as the public identity field')
assert.equal(isAnimateActive(AvatarVariant.triton, AvatarEffect.none), true)
assert.equal(isAnimateActive(AvatarVariant.triton, AvatarEffect.noise), false)

const effectColors = ['#ff5c8a', '#ffcc66', '#65d8ff', '#6f6bff', '#1d1b38']
const noiseSvg = createAvatar({
  name: 'effect-contract',
  variant: AvatarVariant.triton,
  colors: effectColors,
  effect: AvatarEffect.noise,
})
assert.match(noiseSvg, /feTurbulence/, 'noise keeps the organic turbulence source')

const details = getAllAvatarDetails()
assert.equal(details.length, 21, '21 avatar variants are catalogued')

// ---------------------------------------------------------------------------
// 2. Squishmoji engine contracts (ported from @usespaceui/squishmoji)
// ---------------------------------------------------------------------------

const defaultSquish = createSquishmoji()
assert.equal(defaultSquish, createSquishmoji(), 'the default seed must be deterministic')
assert.match(defaultSquish, /^<svg /, 'createSquishmoji returns an SVG string')

const seedA = createSquishmoji('space-cadet')
assert.equal(seedA, createSquishmoji('space-cadet'), 'same seed produces identical SVG')

const squishJson = createSquishmoji('space-cadet', {
  shape: 'cat',
  expression: 'loving',
  format: SquishOutputFormat.json,
})
assert.equal(squishJson.seed, 'space-cadet')
assert.equal(squishJson.shape, 'cat')
assert.equal(squishJson.expression, 'loving')
assert.match(squishJson.dataUri, /^data:image\/svg\+xml;utf8,/)
assert.ok(squishJson.layout, 'layout metadata is present')

const layout = resolveLayout('space-cadet')
assert.equal(typeof renderLayout(layout, { seed: 'space-cadet' }), 'string', 'two-phase pipeline works')

assert.ok(SHAPE_LIST.length >= 21, 'at least 21 shapes supported')
assert.ok(EXPRESSION_LIST.length >= 20, 'at least 20 expressions supported')
assert.ok(BACKGROUND_STYLE_LIST.length >= 6, 'at least 6 background styles supported')

assert.throws(() => resolveShape('x', 'nope'), /Unknown shape/)
assert.throws(() => resolveExpression('x', 'nope'), /Unknown expression/)
assert.throws(() => resolveBackgroundStyle('x', 'nope'), /Unknown background style/)
assert.equal(resolveShape('x', 'all'), resolveShape('x', 'all'), '"all" shape pick is deterministic')

// ---------------------------------------------------------------------------
// 3. Byte-level parity with the upstream packages
// ---------------------------------------------------------------------------

const upstreamAvatars = await import('@usespaceui/avatars')
const upstreamSquish = await import('@usespaceui/squishmoji')

for (const variant of ['pebble', 'triton', 'glass', 'splash', 'ghost', 'bot', 'invader', 'critter', 'kendo']) {
  for (const name of ['orion', 'vega', 'ada lovelace', 'Ünïcödé ✓']) {
    const ours = createAvatar({ name, variant, size: 256 })
    const theirs = upstreamAvatars.createAvatar({ name, variant, size: 256 })
    assert.equal(ours, theirs, `avatars parity: ${variant}/${name}`)
  }
}

for (const [shape, expression, background] of [
  ['cat', 'loving', 'solid'],
  ['ghost', 'excited', 'taygeta'],
  ['ufo', 'amazed', 'maia'],
  ['star', 'sleepy', 'alcyone'],
]) {
  const ours = createSquishmoji('space-cadet', { shape, expression, backgroundStyle: background, size: 256 })
  const theirs = upstreamSquish.createAvatar('space-cadet', { shape, expression, backgroundStyle: background, size: 256 })
  assert.equal(ours, theirs, `squishmoji parity: ${shape}/${expression}/${background}`)
}

// Vendored palette parity
const upstreamGradients = await import('@usespaceui/gradients')
for (const seed of ['a', 'orion', 'deep-space-9', 'Ünïcödé']) {
  assert.deepEqual(
    generatePalette(seed).colors,
    upstreamGradients.generatePalette(seed).colors,
    `palette parity: ${seed}`,
  )
}

// ---------------------------------------------------------------------------
// 3b. Custom palettes (both engines)
// ---------------------------------------------------------------------------

const SUNSET = ['#ff9a3c', '#ff5c8a', '#c13584', '#701a75', '#fde68a']
const OCEAN = ['#7dd3fc', '#38bdf8', '#0284c7', '#1e3a8a', '#082f49']

// squishmoji: custom colors recolor, geometry stays seed-driven
{
  const seeded = createSquishmoji('palette-demo', { shape: 'cat', expression: 'loving' })
  const sunset = createSquishmoji('palette-demo', { shape: 'cat', expression: 'loving', colors: SUNSET })
  const sunsetAgain = createSquishmoji('palette-demo', { shape: 'cat', expression: 'loving', colors: SUNSET })
  const ocean = createSquishmoji('palette-demo', { shape: 'cat', expression: 'loving', colors: OCEAN })

  assert.notEqual(seeded, sunset, 'custom colors change the squishmoji output')
  assert.equal(sunset, sunsetAgain, 'custom palette squishmoji is deterministic')
  assert.notEqual(sunset, ocean, 'different custom palettes produce different output')
  assert.ok(sunset.includes('#ff5c8a') || sunset.includes('#ff9a3c') || sunset.includes('#c13584') || sunset.includes('#701a75') || sunset.includes('#fde68a'), 'custom color appears in the SVG')
  // Same seed → same body path (geometry untouched by palette override)
  const seededPath = seeded.match(/ d="([^"]+)"/)[1]
  const sunsetPath = sunset.match(/ d="([^"]+)"/)[1]
  assert.equal(seededPath, sunsetPath, 'body geometry is palette-independent')

  // Custom palette flows through the unified API and JSON layout too
  const unified = createNovatar({ seed: 'palette-demo', engine: 'squishmoji', shape: 'cat', colors: SUNSET, format: 'json' })
  assert.deepEqual(unified.layout.colors.palette, SUNSET, 'layout metadata carries the custom palette')

  assert.throws(
    () => createSquishmoji('x', { colors: ['#fff', '#000'] }),
    /exactly 5 hexadecimal colors/,
    'squishmoji validates the custom palette like the avatars engine',
  )
}

// avatars: custom colors on every family that supports them (paletteless is ink-only by design)
{
  for (const variant of ['triton', 'glass', 'splash', 'ghost', 'pebble', 'doodle']) {
    const sunset = createAvatar({ name: 'palette-demo', variant, colors: SUNSET, size: 128 })
    const ocean = createAvatar({ name: 'palette-demo', variant, colors: OCEAN, size: 128 })
    assert.notEqual(sunset, ocean, `custom palettes recolor variant ${variant}`)
    assert.equal(sunset, createAvatar({ name: 'palette-demo', variant, colors: SUNSET, size: 128 }), `custom palette ${variant} is deterministic`)
  }
}

// ---------------------------------------------------------------------------
// 3c. Animation & modern format exports (svg-smil, gif, apng, webp)
// ---------------------------------------------------------------------------

{
  const solved = novatar.solveAnimationFrames({ seed: 'anim-test' })
  assert.equal(solved.frames.length, Math.round(4.7 * 12), 'default solver: 12fps over one blink cycle')
  assert.equal(solved.duration, 4.7, 'default duration is one blink cycle')
  const snapped = novatar.solveAnimationFrames({ seed: 'anim-test', duration: 10 })
  assert.equal(snapped.duration, 9.4, 'duration snaps to a multiple of the 4.7s blink cycle')

  const asvg = novatar.renderAnimatedSvg({ seed: 'anim-test', shape: 'cat' })
  assert.ok(asvg.startsWith('<svg '), 'animated svg is svg markup')
  // Eyes animate via the `d` attribute: <animateTransform type="matrix"> is not
  // part of the SMIL spec and browsers ignore it, so the eye affine is baked
  // into per-frame bezier paths instead.
  assert.equal((asvg.match(/<animate attributeName="d"/g) || []).length, 2, 'per-eye d-attribute animation')
  assert.ok(asvg.includes('repeatCount="indefinite"'), 'animated svg loops forever')
  const firstValues = asvg.match(/values="([^"]+)"/)?.[1] ?? ''
  assert.equal(firstValues.split(';').length, 57, '56 loop frames plus the wrap frame')
  const structures = new Set(firstValues.split(';').map((d) => d.replace(/[-\d. ]/g, '')))
  assert.equal(structures.size, 1, 'path command structure matches across frames (animatable)')
  assert.equal(asvg, novatar.renderAnimatedSvg({ seed: 'anim-test', shape: 'cat' }), 'animated svg is deterministic')
  const wobbling = novatar.renderAnimatedSvg({ seed: 'anim-test', wobble: true })
  const wobbleTypes = [...wobbling.matchAll(/animateTransform[^>]*type="(\w+)"/g)].map((m) => m[1])
  assert.deepEqual(wobbleTypes.sort(), ['rotate', 'translate'], 'wobble uses legal animateTransform types only')
}

{
  const gif = await novatar.renderAnimatedGif({ seed: 'anim-test', width: 96 })
  assert.equal(Buffer.from(gif.slice(0, 6)).toString(), 'GIF89a', 'gif magic')
  assert.ok(Buffer.from(gif).includes('NETSCAPE', 'ascii'), 'gif loops forever')
  assert.equal(Buffer.from(gif).equals(Buffer.from(await novatar.renderAnimatedGif({ seed: 'anim-test', width: 96 }))), true, 'gif is deterministic')

  const apng = await novatar.renderAnimatedApng({ seed: 'anim-test', width: 96 })
  assert.equal(apng[0], 0x89, 'apng png magic byte')
  assert.ok(Buffer.from(apng.slice(0, 200)).includes('acTL', 'ascii'), 'apng animation control chunk present')
  assert.equal(Buffer.from(apng).equals(Buffer.from(await novatar.renderAnimatedApng({ seed: 'anim-test', width: 96 }))), true, 'apng is deterministic')

  const webp = await novatar.renderWebp(novatar.createNovatar({ seed: 'still-test', engine: 'avatars', variant: 'triton' }), { width: 96 })
  assert.equal(Buffer.from(webp.slice(0, 4)).toString(), 'RIFF', 'webp riff header')
  assert.equal(Buffer.from(webp.slice(8, 12)).toString(), 'WEBP', 'webp format tag')
  assert.equal(Buffer.from(webp).equals(Buffer.from(await novatar.renderWebp(novatar.createNovatar({ seed: 'still-test', engine: 'avatars', variant: 'triton' }), { width: 96 }))), true, 'webp is deterministic')

  // No animateTransform may ever use an illegal type ("matrix" is not in the
  // SMIL spec and browsers silently ignore it — the original animated-svg bug).
  for (const markup of [
    novatar.renderAnimatedSvg({ seed: 'legal-types', wobble: true }),
    novatar.createAvatar({ name: 'legal-types', variant: 'triton', animate: true }),
  ]) {
    const types = [...markup.matchAll(/animateTransform[^>]*?type="(\w+)"/g)].map((m) => m[1])
    for (const type of types) {
      assert.ok(
        ['translate', 'scale', 'rotate', 'skewX', 'skewY'].includes(type),
        `animateTransform type "${type}" is SMIL-legal`,
      )
    }
  }
}

// Real-browser verification: load the animated SVG in Chrome, step the SMIL
// timeline, and assert the eye geometry actually changes. Skipped (with a
// notice) when Chrome or playwright-core is unavailable.
{
  let chromium
  try {
    ;({ chromium } = await import('playwright-core'))
    const browser = await chromium.launch({ channel: 'chrome', headless: true })
    const page = await browser.newPage()
    const markup = novatar.renderAnimatedSvg({ seed: 'browser-check', shape: 'cat' })
    await page.goto('data:text/html,' + encodeURIComponent('<!doctype html><body>' + markup + '</body>'))
    const samples = await page.evaluate(() => {
      const svgEl = document.querySelector('svg')
      const eye = document.querySelector('[data-sq-eye="0"]')
      svgEl.pauseAnimations()
      const at = (t) => {
        svgEl.setCurrentTime(t)
        const bb = eye.getBBox()
        return `${bb.x.toFixed(2)},${bb.y.toFixed(2)},${bb.height.toFixed(2)}`
      }
      return [at(0), at(1.2), at(2.6), at(4.69)]
    })
    await browser.close()
    assert.ok(new Set(samples).size > 1, `animated svg animates in a real browser (samples: ${samples.join(' | ')})`)
    assert.ok(samples[3] === samples[0] || Math.abs(parseFloat(samples[3]) - parseFloat(samples[0])) < 1, 'loop wraps back to the opening pose')
  } catch (error) {
    if (String(error).includes('BrowserType') || String(error).includes('connect') || String(error).includes('Cannot find')) {
      console.log('  (skipped: real-browser animation check — Chrome/playwright-core unavailable)')
    } else {
      throw error
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Unified novatar API
// ---------------------------------------------------------------------------

assert.equal(createNovatar({ seed: 'x', engine: 'avatars' }), createNovatar({ seed: 'x', engine: 'avatar' }), 'engine aliases resolve')
assert.equal(createNovatar({ seed: 'x', engine: 'squishmoji' }), createNovatar({ seed: 'x', engine: 'squish' }), 'squish aliases resolve')
assert.throws(() => resolveEngine('x', 'nope'), /Unknown engine/)

const autoJson = createNovatar({ seed: 'auto-check', engine: 'auto', format: NovatarOutputFormat.json })
assert.equal(autoJson.engine, resolveEngine('auto-check', 'auto'), 'auto engine pick is deterministic')
assert.ok(autoJson.svg.startsWith('<svg ') && autoJson.dataUri.startsWith('data:image/svg+xml'))

const avatarsJson = createNovatar({ seed: 'unified-1', engine: 'avatars', variant: 'triton', format: 'json' })
assert.equal(avatarsJson.engine, NovatarEngine.avatars)
assert.equal(avatarsJson.variant, 'triton')
assert.equal(avatarsJson.seed, 'unified-1')

const squishNJson = createNovatar({ seed: 'unified-2', engine: 'squishmoji', shape: 'bot', expression: 'happy', format: 'json' })
assert.equal(squishNJson.engine, NovatarEngine.squishmoji)
assert.equal(squishNJson.shape, 'bot')
assert.equal(squishNJson.expression, 'happy')
assert.ok(squishNJson.layout)

const catalog = listNovatarStyles()
assert.equal(catalog.engines.length, 2)
assert.equal(listNovatarStyles('squishmoji').engines.length, 1)
const avatarsEngineCatalog = catalog.engines.find((e) => e.id === 'avatars')
assert.equal(avatarsEngineCatalog.variants.length, 21)
const squishEngineCatalog = catalog.engines.find((e) => e.id === 'squishmoji')
assert.equal(squishEngineCatalog.shapes.length, 21)
assert.equal(squishEngineCatalog.expressions.length, 22)
assert.equal(squishEngineCatalog.backgrounds.length, 6)

// ---------------------------------------------------------------------------
// 5. React exports
// ---------------------------------------------------------------------------

assert.ok(novatarReact.Avatar, 'Avatar is exported in /react')
assert.ok(novatarReact.Squishmoji, 'Squishmoji is exported in /react')
assert.ok(novatarReact.Novatar, 'Novatar is exported in /react')

// ---------------------------------------------------------------------------
// 6. CLI contracts (agent surface)
// ---------------------------------------------------------------------------

const node = process.execPath
const cli = ['dist/cli.js']

{
  const { stdout } = await run(node, [...cli, 'justin'])
  assert.match(stdout, /^<svg /, 'CLI prints SVG to stdout')
}
{
  const { stdout } = await run(node, [...cli, 'justin', '--json'])
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.seed, 'justin')
  assert.ok(parsed.svg.startsWith('<svg '))
  assert.ok(parsed.dataUri.startsWith('data:image/svg+xml'))
}
{
  const { stdout } = await run(node, [...cli, 'justin', '--engine', 'squishmoji', '--shape', 'cat', '--expression', 'loving'])
  assert.equal(stdout, createSquishmoji('justin', { shape: 'cat', expression: 'loving' }) + '\n', 'CLI flags reach the engine')
}
{
  const { stdout } = await run(node, [...cli, '--list'])
  const catalog = JSON.parse(stdout)
  assert.equal(catalog.engines.length, 2, '--list prints the catalog')
}
{
  const { stdout } = await run(node, [...cli, '--png', '--size', '128', 'justin'], { encoding: 'buffer', maxBuffer: 10e6 })
  assert.equal(stdout.subarray(0, 4).toString('hex'), '89504e47', 'CLI --png writes a PNG to stdout')
}
{
  const promise = run(node, [...cli, 'justin', '--variant', 'not-a-variant', '--engine', 'avatars'])
  await promise.then(
    () => assert.fail('unknown variant should exit non-zero'),
    (error) => assert.ok(error.code !== 0, 'unknown variant exits non-zero'),
  )
}

// ---------------------------------------------------------------------------
// 6b. CLI batch, templating, data URIs, quiet (agent versatility)
// ---------------------------------------------------------------------------

{
  const { stdout } = await run(node, [...cli, '--batch', 'alice,bob,carol', '--json'])
  const parsed = JSON.parse(stdout)
  assert.ok(Array.isArray(parsed), 'batch json prints an array')
  assert.deepEqual(parsed.map((a) => a.seed), ['alice', 'bob', 'carol'])
  assert.ok(parsed.every((a) => a.svg.startsWith('<svg ')))
}
{
  const dir = await import('node:fs/promises').then((m) => m.mkdtemp('/tmp/novatar-batch-'))
  const { stdout } = await run(node, [
    ...cli, '--batch', 'Alice L.,bob,carol', '--png', '--size', '96',
    '--out', `${dir}/{seed}.png`, '--quiet',
  ])
  assert.equal(stdout, '', '--quiet silences stdout-independent notes')
  const files = (await import('node:fs/promises').then((m) => m.readdir(dir))).sort()
  assert.deepEqual(files, ['Alice_L.png', 'bob.png', 'carol.png'], '{seed} placeholder sanitizes filenames')
  const first = await import('node:fs/promises').then((m) => m.readFile(`${dir}/bob.png`))
  assert.equal(first.subarray(0, 4).toString('hex'), '89504e47', 'batch writes valid PNGs')
}
{
  const { stdout } = await run(node, [...cli, '--random', '--count', '5', '--json', '--quiet'])
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.length, 5, '--count N --json returns N avatars')
  assert.ok(new Set(parsed.map((a) => a.seed)).size === 5, 'random seeds are distinct')
}
{
  const { stdout } = await run(node, [...cli, 'justin', '--datauri'])
  assert.match(stdout, /^data:image\/svg\+xml;utf8,/, '--datauri emits an svg data URI')
}
{
  const { stdout } = await run(node, [...cli, 'justin', '--png', '--datauri', '--size', '64'])
  assert.match(stdout, /^data:image\/png;base64,/, '--datauri emits a png data URI')
}
{
  const { stdout } = await run(node, [...cli, '--batch', 'a,b', '--datauri'])
  const lines = stdout.trim().split('\n')
  assert.equal(lines.length, 2, 'batch data URIs print one per line')
  assert.ok(lines.every((l) => l.startsWith('data:image/svg+xml;utf8,')))
}
{
  const promise = run(node, [...cli, 'justin', '--random'])
  await promise.then(
    () => assert.fail('named seed + --random should fail'),
    (error) => assert.match(String(error.stderr), /not both/, 'named seed + --random errors'),
  )
}
{
  const promise = run(node, [...cli, '--batch', 'a,b', '--out', 'x.png'])
  await promise.then(
    () => assert.fail('batch --out without {seed} should fail'),
    (error) => assert.ok(error.code !== 0, 'batch --out without {seed} exits non-zero'),
  )
}
{
  // multi-line stdin = batch
  const { spawn } = await import('node:child_process')
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(node, [...cli, '-', '--json'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (c) => (out += c))
    child.on('error', reject)
    child.on('close', () => resolve(out))
    child.stdin.write('piped-a\npiped-b\n')
    child.stdin.end()
    setTimeout(() => reject(new Error('stdin batch did not exit')), 10000).unref?.()
  })
  const parsed = JSON.parse(stdout)
  assert.ok(Array.isArray(parsed) && parsed.length === 2, 'multi-line stdin is a batch')
  assert.deepEqual(parsed.map((a) => a.seed), ['piped-a', 'piped-b'])
}

// ---------------------------------------------------------------------------
// 6c. CLI animated + webp formats
// ---------------------------------------------------------------------------

{
  const dir = await import('node:fs/promises').then((m) => m.mkdtemp('/tmp/novatar-fmt-'))
  const { stdout: animSvg } = await run(node, [...cli, 'justin', '--animate', '--engine', 'squishmoji', '--quiet'])
  assert.ok(
    animSvg.includes('<animate attributeName="d"') && animSvg.includes('repeatCount="indefinite"'),
    'CLI --animate emits an animatable SMIL svg',
  )

  await run(node, [...cli, 'justin', '--gif', '--size', '96', '--out', `${dir}/a.gif`, '--quiet'])
  const gif = await import('node:fs/promises').then((m) => m.readFile(`${dir}/a.gif`))
  assert.equal(gif.subarray(0, 6).toString(), 'GIF89a', 'CLI --gif writes a GIF89a file')

  await run(node, [...cli, 'justin', '--apng', '--size', '96', '--out', `${dir}/a.png`, '--quiet'])
  const apng = await import('node:fs/promises').then((m) => m.readFile(`${dir}/a.png`))
  assert.ok(apng.subarray(0, 200).includes('acTL'), 'CLI --apng writes an APNG file')

  await run(node, [...cli, 'justin', '--webp', '--size', '96', '--out', `${dir}/a.webp`, '--quiet'])
  const webp = await import('node:fs/promises').then((m) => m.readFile(`${dir}/a.webp`))
  assert.equal(webp.subarray(0, 4).toString(), 'RIFF', 'CLI --webp writes a WebP file')

  const { stdout: gifUri } = await run(node, [...cli, 'justin', '--gif', '--datauri', '--size', '64', '--quiet'])
  assert.match(gifUri, /^data:image\/gif;base64,R0lGOD/, 'CLI gif datauri')
}

// ---------------------------------------------------------------------------
// 7. MCP server contract (agent surface)
// ---------------------------------------------------------------------------

{
  const { spawn } = await import('node:child_process')
  const frames = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'novatar_list_styles', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'novatar_generate', arguments: { seed: 'mcp-test', engine: 'squishmoji', shape: 'ufo' } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'novatar_generate', arguments: { seed: 'mcp-test', format: 'json' } } },
    { jsonrpc: '2.0', id: 6, method: 'ping' },
    { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'novatar_generate', arguments: { seed: 'mcp-gif', format: 'gif', size: 64 } } },
    { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'novatar_generate', arguments: { seed: 'mcp-anim', animate: true, engine: 'squishmoji' } } },
    { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'novatar_generate', arguments: { seed: 'mcp-anim-2', animate: true, engine: 'avatars', variant: 'triton' } } },
  ]
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(node, ['dist/mcp.js'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('error', reject)
    child.on('close', () => resolve(out))
    child.stdin.write(frames.map((f) => JSON.stringify(f)).join('\n') + '\n')
    child.stdin.end()
    setTimeout(() => reject(new Error('MCP server did not exit')), 15000).unref?.()
  })
  const responses = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const byId = Object.fromEntries(responses.map((r) => [r.id, r]))

  assert.equal(responses.length, 9, 'notifications produce no response')
  assert.equal(byId[1].result.serverInfo.name, 'novatar')
  assert.ok(Array.isArray(byId[2].result.tools) && byId[2].result.tools.length === 3)
  assert.equal(JSON.parse(byId[3].result.content[0].text).engines.length, 2, 'list styles tool returns the catalog')
  assert.match(byId[4].result.content[0].text, /^<svg /, 'generate tool returns SVG')
  assert.equal(JSON.parse(byId[5].result.content[0].text).seed, 'mcp-test', 'generate json tool returns metadata')
  assert.deepEqual(byId[6].result, {}, 'ping responds with empty result')
  assert.equal(byId[7].result.content[0].mimeType, 'image/gif', 'generate gif tool returns a gif image block')
  assert.ok(byId[7].result.content[0].data.startsWith('R0lGOD'), 'gif image block is base64 GIF89a')
  assert.match(byId[8].result.content[0].text, /attributeName="d"/, 'animate tool returns SMIL svg (d-attribute animation)')
  assert.match(byId[9].result.content[0].text, /animate/, 'animate + avatars engine returns its built-in animation')
}

// ---------------------------------------------------------------------------
// 8. HTTP handler contract (agent surface)
// ---------------------------------------------------------------------------

{
  const { createNovatarHandler } = await import('../dist/server.js')
  const handler = createNovatarHandler({ base: '/api/avatar' })

  const svgResponse = await handler(new Request('https://example.com/api/avatar/orion?engine=avatars&variant=triton'))
  assert.equal(svgResponse.status, 200)
  assert.equal(svgResponse.headers.get('content-type'), 'image/svg+xml; charset=utf-8')
  assert.match(await svgResponse.text(), /^<svg /)

  const pathPngResponse = await handler(new Request('https://example.com/api/avatar/vega.png'))
  assert.equal(pathPngResponse.headers.get('content-type'), 'image/png')

  const jsonResponse = await handler(new Request('https://example.com/api/avatar/vega.json?engine=squishmoji&shape=cat'))
  assert.equal(jsonResponse.headers.get('content-type'), 'application/json; charset=utf-8')
  const body = JSON.parse(await jsonResponse.text())
  assert.equal(body.seed, 'vega')
  assert.equal(body.shape, 'cat')

  const stylesResponse = await handler(new Request('https://example.com/api/avatar/styles'))
  assert.equal(JSON.parse(await stylesResponse.text()).engines.length, 2)

  const badResponse = await handler(new Request('https://example.com/api/avatar/x?variant=nope&engine=avatars'))
  assert.equal(badResponse.status, 400, 'invalid options produce a clean 400')

  const webpResponse = await handler(new Request('https://example.com/api/avatar/vega.webp?engine=avatars&variant=triton'))
  assert.equal(webpResponse.headers.get('content-type'), 'image/webp', 'webp route')
  const webpBytes = new Uint8Array(await webpResponse.arrayBuffer())
  assert.equal(Buffer.from(webpBytes.slice(0, 4)).toString(), 'RIFF', 'webp route payload')

  const gifResponse = await handler(new Request('https://example.com/api/avatar/vega.gif?shape=cat&size=96'))
  assert.equal(gifResponse.headers.get('content-type'), 'image/gif', 'gif route')
  const gifBytes = new Uint8Array(await gifResponse.arrayBuffer())
  assert.equal(Buffer.from(gifBytes.slice(0, 6)).toString(), 'GIF89a', 'gif route payload')

  const animatedSvgResponse = await handler(new Request('https://example.com/api/avatar/orion.svg?animate=true&engine=squishmoji'))
  assert.ok((await animatedSvgResponse.text()).includes('<animate attributeName="d"'), 'animated svg route')

  const gifEngineGuard = await handler(new Request('https://example.com/api/avatar/vega.gif?engine=avatars'))
  assert.equal(gifEngineGuard.status, 400, 'gif + avatars engine is a clean 400')

  const infoResponse = await handler(new Request('https://example.com/api/avatar/'))
  assert.equal(JSON.parse(await infoResponse.text()).name, 'novatar')
}

console.log('All novatar contract tests passed: engines, parity, unified API, CLI, MCP, HTTP.')
