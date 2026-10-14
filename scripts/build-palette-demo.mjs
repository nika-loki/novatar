// Palette demonstration fragment: same seed, seeded vs custom palettes,
// across variants/shapes of both engines.
import { writeFileSync } from 'node:fs'
import { createNovatar } from '../dist/index.js'

const PALETTES = [
  { name: 'Seeded (from "justin")', colors: null },
  { name: 'Sunset', colors: ['#ff9a3c', '#ff5c8a', '#c13584', '#701a75', '#fde68a'] },
  { name: 'Ocean', colors: ['#7dd3fc', '#38bdf8', '#0284c7', '#1e3a8a', '#082f49'] },
  { name: 'Forest', colors: ['#bbf7d0', '#4ade80', '#15803d', '#14532d', '#a3e635'] },
]

const SEED = 'justin'

const SAMPLES = [
  { label: 'avatars · triton', opts: { engine: 'avatars', variant: 'triton' } },
  { label: 'avatars · splash', opts: { engine: 'avatars', variant: 'splash' } },
  { label: 'avatars · pebble', opts: { engine: 'avatars', variant: 'pebble' } },
  { label: 'squishmoji · cat · loving', opts: { engine: 'squishmoji', shape: 'cat', expression: 'loving' } },
  { label: 'squishmoji · star · taygeta bg', opts: { engine: 'squishmoji', shape: 'star', expression: 'happy', backgroundStyle: 'taygeta' } },
]

const swatches = (colors) =>
  colors
    ? `<span class="pd-swatches">${colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`
    : `<span class="pd-swatches pd-seeded">seed</span>`

const header = PALETTES.map(
  (p) =>
    `<div class="pd-cell pd-head"><span class="pd-name">${p.name}</span>${swatches(p.colors)}</div>`,
).join('')

const rows = SAMPLES.map((sample) => {
  const cells = PALETTES.map((palette) => {
    const svg = createNovatar({
      seed: SEED,
      size: 96,
      colors: palette.colors ?? undefined,
      ...sample.opts,
    })
    const changed = palette.colors ? 'pd-custom' : ''
    return `<div class="pd-cell ${changed}">${svg}</div>`
  }).join('')
  return `<div class="pd-cell pd-rowlabel">${sample.label}</div>${cells}`
}).join('')

const fragment = `<div id="novatar-palette-demo">
  <style>
    #novatar-palette-demo { font: inherit; color: var(--foreground); }
    #novatar-palette-demo h2 { margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 500; }
    #novatar-palette-demo .pd-note { margin: 0 0 14px; color: var(--muted-foreground); }
    #novatar-palette-demo .pd-grid { display: grid; grid-template-columns: minmax(120px, auto) repeat(4, minmax(72px, 1fr)); gap: 10px 6px; align-items: center; }
    #novatar-palette-demo .pd-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
    #novatar-palette-demo .pd-head { gap: 6px; }
    #novatar-palette-demo .pd-head .pd-name { font-size: 12px; text-align: center; }
    #novatar-palette-demo .pd-rowlabel { font-size: 11px; color: var(--muted-foreground); text-align: right; align-items: flex-end; padding-right: 4px; line-height: 1.3; }
    #novatar-palette-demo .pd-cell svg { width: 72px; height: 72px; }
    #novatar-palette-demo .pd-swatches { display: inline-flex; gap: 2px; }
    #novatar-palette-demo .pd-swatches i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    #novatar-palette-demo .pd-seeded { font-size: 11px; color: var(--muted-foreground); }
    @media (max-width: 560px) {
      #novatar-palette-demo .pd-grid { grid-template-columns: minmax(96px, auto) repeat(4, minmax(56px, 1fr)); }
      #novatar-palette-demo .pd-cell svg { width: 56px; height: 56px; }
    }
  </style>
  <h2>Seeded vs custom palettes — same seed, both engines</h2>
  <p class="pd-note">Every column is the same seed <code>${SEED}</code>: geometry never changes, only the palette. Column 1 is the palette the seed generates; the rest pass <code>--colors</code>. npx novatar ${SEED} --engine squishmoji --shape cat --colors '#ff9a3c,#ff5c8a,#c13584,#701a75,#fde68a'</p>
  <div class="pd-grid">
    <div class="pd-cell pd-head"></div>
    ${header}
    ${rows}
  </div>
</div>`

const out =
  '/Users/justincheu/.zcode/v2/visualizations/bba2a8979d96f14351adaf07597ef5dc1159bb2dd7a8bb749c50b0c64d96ab7b/novatar-palette-demo.html'
writeFileSync(out, fragment)
console.log('palette demo written:', out, `(${fragment.length} bytes)`)
