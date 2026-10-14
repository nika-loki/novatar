# novatar on Astro

Astro needs no React integration — novatar's core generates plain SVG
strings at build/render time, and `novatar/server` drops into an Astro
endpoint as a Web-standard `Request → Response` handler.

## Run it

```bash
cd examples/astro
npm install
npm run dev       # http://localhost:4321
npm run build     # production build (uses the Node adapter)
npm run preview   # serve the production build
```

## What it shows

- **`src/pages/index.astro`** — inline avatars via `createNovatar` /
  `renderAnimatedSvg` + `<Fragment set:html={svg} />` (zero client JS; the
  animated SVG blinks via SMIL with no hydration), plus an `<img>` from the
  API endpoint.
- **`src/pages/api/avatar/[...route].ts`** — the full API:
  `/api/avatar/:seed`, `:seed.png`, `:seed.webp`, `:seed.gif`, `:seed.apng`,
  `:seed.json`, `?animate=true`, with all style query parameters.

The React components from `novatar/react` also work in Astro through
`@astrojs/react` if you want interactive islands
(`<Squishmoji client:load />` for hover/click reactions).
