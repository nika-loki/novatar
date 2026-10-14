#!/usr/bin/env node
/**
 * Bakes the README image library: every avatar variant, squishmoji shape,
 * expression, and background as a small standalone SVG in assets/gallery/,
 * then injects the gallery tables into README.md between markers.
 *
 * Regenerate after engine changes:  node scripts/build-readme-gallery.mjs
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import {
  createAvatar,
  createSquishmoji,
  listNovatarStyles,
  getAllAvatarDetails,
} from '../dist/index.js'

const catalog = listNovatarStyles()
const avatarsCatalog = catalog.engines.find((e) => e.id === 'avatars')
const squishCatalog = catalog.engines.find((e) => e.id === 'squishmoji')
const details = Object.fromEntries(getAllAvatarDetails().map((d) => [d.id, d]))

const AVATAR_SEED = 'orion'
const SQUISH_SEED = 'novatar'

mkdirSync('assets/gallery/avatars', { recursive: true })
mkdirSync('assets/gallery/squish', { recursive: true })

const write = (path, svg) => writeFileSync(path, svg)
let bytes = 0

// --- avatars: one tile per variant, grouped by family --------------------
const familyTables = []
for (const [family, variants] of Object.entries(avatarsCatalog.families)) {
  const cells = variants.map((variant) => {
    const svg = createAvatar({ name: AVATAR_SEED, variant, size: 96 })
    bytes += svg.length
    write(`assets/gallery/avatars/${variant}.svg`, svg)
    return `<td align="center"><img src="assets/gallery/avatars/${variant}.svg" width="72" alt="${variant} avatar" /><br /><sub><code>${variant}</code>${details[variant]?.supportsColors ? '' : ' <i>(ink-only)</i>'}</sub></td>`
  })
  const rows = cells.map((_, i) => (i % 7 === 0 ? cells.slice(i, i + 7) : null)).filter(Boolean)
  familyTables.push(
    `<h4>${family}</h4>\n\n` +
      rows.map((row) => `<table><tr>\n${row.join('\n')}\n</tr></table>`).join('\n\n'),
  )
}

// --- squishmoji: shapes (rotating expressions for life) -------------------
const EXPRESSIONS = [
  'loving', 'happy', 'excited', 'curious', 'surprised', 'amazed', 'sleepy',
  'proud', 'shy', 'attentive', 'determined', 'laughing', 'guilty', 'bored',
  'angry', 'suspicious', 'confused', 'crazy', 'sad', 'doubtful', 'scared',
]
const shapeCells = squishCatalog.shapes.map((shape, i) => {
  const expression = EXPRESSIONS[i % EXPRESSIONS.length]
  const svg = createSquishmoji(SQUISH_SEED, { shape, expression, size: 96 })
  bytes += svg.length
  write(`assets/gallery/squish/shape-${shape}.svg`, svg)
  return `<td align="center"><img src="assets/gallery/squish/shape-${shape}.svg" width="72" alt="${shape} shape" /><br /><sub><code>${shape}</code></sub></td>`
})
const shapeRows = shapeCells.map((_, i) => (i % 7 === 0 ? shapeCells.slice(i, i + 7) : null)).filter(Boolean)
const shapesTable = shapeRows.map((row) => `<table><tr>\n${row.join('\n')}\n</tr></table>`).join('\n\n')

// --- squishmoji: expressions (one fixed shape isolates the difference) ----
const expressionCells = squishCatalog.expressions.map((expression) => {
  const svg = createSquishmoji(SQUISH_SEED, { shape: 'circle', expression, size: 96 })
  bytes += svg.length
  write(`assets/gallery/squish/expression-${expression}.svg`, svg)
  return `<td align="center"><img src="assets/gallery/squish/expression-${expression}.svg" width="60" alt="${expression} expression" /><br /><sub><code>${expression}</code></sub></td>`
})
const expressionRows = expressionCells.map((_, i) => (i % 8 === 0 ? expressionCells.slice(i, i + 8) : null)).filter(Boolean)
const expressionsTable = expressionRows.map((row) => `<table><tr>\n${row.join('\n')}\n</tr></table>`).join('\n\n')

// --- squishmoji: backgrounds ------------------------------------------------
const backgroundCells = squishCatalog.backgrounds.map((background) => {
  const svg = createSquishmoji(SQUISH_SEED, { shape: 'circle', expression: 'neutral', backgroundStyle: background, size: 96 })
  bytes += svg.length
  write(`assets/gallery/squish/background-${background}.svg`, svg)
  return `<td align="center"><img src="assets/gallery/squish/background-${background}.svg" width="72" alt="${background} background" /><br /><sub><code>${background}</code></sub></td>`
})
const backgroundsTable = `<table><tr>\n${backgroundCells.join('\n')}\n</tr></table>`

// --- assemble and inject into README ----------------------------------------
const gallery = `<!-- novatar:gallery:start -->
### avatars engine — 21 variants

All tiles use the same seed (\`${AVATAR_SEED}\`), so palette differences come from the variants themselves.

${familyTables.join('\n\n')}

### squishmoji engine — 21 shapes

Seed \`${SQUISH_SEED}\`, rotating expressions to show a little life:

${shapesTable}

### 22 expressions

Same seed and shape — only the expression changes:

${expressionsTable}

### 6 generative backgrounds

${backgroundsTable}
<!-- novatar:gallery:end -->`

const readme = readFileSync('README.md', 'utf8')
const START = '<!-- novatar:gallery:start -->'
const END = '<!-- novatar:gallery:end -->'
const start = readme.indexOf(START)
const end = readme.indexOf(END)

let next
if (start !== -1 && end !== -1) {
  next = readme.slice(0, start) + gallery + readme.slice(end + END.length)
} else {
  // First bake: replace the legacy text-only catalog block inside "## Style catalog"
  const header = '## Style catalog\n\n'
  const idx = readme.indexOf(header)
  const notes = `\nEvery catalog accepts \`all\` for a deterministic pick from the seed. Query the live\ncatalog anywhere: \`npx novatar --list\` or \`listNovatarStyles()\`.\n\n---\n`
  const before = readme.slice(0, idx + header.length)
  const afterIdx = readme.indexOf('\n---\n', idx + header.length)
  const after = readme.slice(afterIdx === -1 ? readme.length : afterIdx + 1)
  next = before + gallery + '\n' + notes + after
}

writeFileSync('README.md', next)
const count = 21 + 21 + 22 + 6
console.log(
  `gallery baked: ${count} svgs (${(bytes / 1024).toFixed(1)} kB raw) + README updated between markers`,
)
