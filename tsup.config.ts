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
    js: `/*! novatar v0.2.0 | MIT | Avatar engines adapted from SpaceUI (MIT) */`,
  },
})
