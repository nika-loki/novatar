#!/usr/bin/env node
/**
 * Publishes novatar to GitHub Packages as @nika-loki/novatar.
 *
 * GitHub Packages only accepts scoped package names, so this script
 * renames the package for the publish and restores it afterwards.
 * The @nika-loki scope is mapped to https://npm.pkg.github.com by .npmrc;
 * auth comes from NODE_AUTH_TOKEN (set it to a PAT with write:packages,
 * or to GITHUB_TOKEN inside Actions).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const GITHUB_SCOPE = '@nika-loki'
const path = 'package.json'
const original = readFileSync(path, 'utf8')

const restore = () => writeFileSync(path, original)
try {
  const pkg = JSON.parse(original)
  const scopedName = `${GITHUB_SCOPE}/${pkg.name.replace(/^@[^/]+\//, '')}`
  if (pkg.name !== scopedName) {
    pkg.name = scopedName
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`publishing as ${scopedName} → https://npm.pkg.github.com`)
  }
  execFileSync('npm', ['publish'], {
    stdio: 'inherit',
    env: { ...process.env },
  })
  console.log(`✓ ${scopedName}@${pkg.version} published to GitHub Packages`)
} finally {
  restore()
}
