// Parity check: vendored palette vs @usespaceui/gradients across seeds & modes.
import { generatePalette as upstream } from '/tmp/package/dist/index.js'
import { generatePalette } from '../src/palette/index.ts'

let checked = 0
const seeds = []
for (let i = 0; i < 3000; i++) seeds.push(`seed-${i}`)
seeds.push('', 'Space UI', 'space-explorer', 'Ünïcödé ✓ 話', 'a', '0', Math.random().toString())

for (const seed of seeds) {
  for (const mode of [undefined, 'presets', 'random', 'nice']) {
    const a = upstream(seed, mode ? { mode } : {})
    const b = generatePalette(seed, mode ? { mode } : {})
    if (a.seed !== b.seed || JSON.stringify(a.colors) !== JSON.stringify(b.colors)) {
      console.error(`MISMATCH seed=${JSON.stringify(seed)} mode=${mode}`)
      console.error('  upstream:', JSON.stringify(a))
      console.error('  vendored:', JSON.stringify(b))
      process.exit(1)
    }
    checked++
  }
}
// custom colors path
const custom = ['#fff', 'abc', '#12345g', '#aabbcc']
for (const seed of ['x', 'y']) {
  const a = upstream(seed, { mode: 'presets', colors: custom })
  const b = generatePalette(seed, { mode: 'presets', colors: custom })
  if (JSON.stringify(a.colors) !== JSON.stringify(b.colors)) {
    console.error('MISMATCH custom colors')
    process.exit(1)
  }
  checked++
}
console.log(`OK: ${checked} palette comparisons identical`)
