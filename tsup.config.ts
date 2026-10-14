import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.ts',
    server: 'src/server.ts',
    raster: 'src/raster.ts',
    cli: 'src/cli.ts',
    mcp: 'src/mcp.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: true,
  minifySyntax: true,
  minifyWhitespace: true,
  minifyIdentifiers: false,
  external: ['react', 'sharp'],
  banner: {
    js: `/*! novatar v0.1.0 | MIT | Engines ported from @usespaceui/avatars & @usespaceui/squishmoji (MIT, SpaceUI) */`,
  },
})
