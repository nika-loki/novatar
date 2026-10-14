#!/usr/bin/env node
/**
 * Builds the animated novatar logo (assets/logo-animated.svg) using the
 * package's own renderAnimatedSvg — the same motion shipped to users.
 *
 * Re-bake with different knobs:
 *   node scripts/build-logo.mjs --seed "Andrew Clark" --shape cat --expression loving
 */
import { writeFileSync } from 'node:fs'
import { renderAnimatedSvg } from '../dist/index.js'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

const seed = flag('seed') ?? 'Andrew Clark'
const svg = renderAnimatedSvg({
  seed,
  shape: flag('shape'),
  expression: flag('expression'),
  backgroundStyle: flag('background'),
  colors: flag('colors') ? flag('colors').split(',') : undefined,
  size: flag('size') ? Number(flag('size')) : undefined,
})

const out = flag('out') ?? 'assets/logo-animated.svg'
writeFileSync(out, svg)
console.log(`animated logo written: ${out} (${svg.length} bytes, seed="${seed}")`)
