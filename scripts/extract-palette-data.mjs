// One-off codemod: extracts palette data arrays from @usespaceui/gradients dist
// into a clean TypeScript module so novatar stays dependency-free.
import { writeFileSync } from 'node:fs'
import { BASE_COLORS, PRESET_PALETTES, NICE_PALETTES } from '/tmp/package/dist/index.js'

const serialize = (name, value) =>
  `export const ${name} = ${JSON.stringify(value)} as const\n`

let out = '// Vendored from @usespaceui/gradients@0.1.4 (MIT, SpaceUI).\n'
out += '// Deterministic palette data — do not reorder: selection is index-based.\n\n'
out += serialize('BASE_COLORS', BASE_COLORS)
out += '\n' + serialize('PRESET_PALETTES', PRESET_PALETTES)
out += '\n' + serialize('NICE_PALETTES', NICE_PALETTES)

writeFileSync(new URL('../src/palette/data.ts', import.meta.url), out)
console.log(
  `BASE_COLORS=${BASE_COLORS.length} PRESET_PALETTES=${PRESET_PALETTES.length} NICE_PALETTES=${NICE_PALETTES.length}`,
)
