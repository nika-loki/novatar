import node from '@astrojs/node'

// The adapter is only required for `astro build` with on-demand routes
// (`prerender = false`). `astro dev` serves them without one.
export default {
  adapter: node({ mode: 'standalone' }),
}
