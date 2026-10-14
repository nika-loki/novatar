// Generates the visual preview gallery fragment from the built novatar dist.
import { writeFileSync } from 'node:fs'
import { createNovatar, listNovatarStyles, createAvatar } from '../dist/index.js'

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const catalog = listNovatarStyles()
const avatarsVariants = catalog.engines.find((e) => e.id === 'avatars').variants
const shapes = catalog.engines.find((e) => e.id === 'duo').shapes

// Vary expressions across the duo grid for a lively sample.
const expressions = [
  'neutral', 'happy', 'loving', 'excited', 'surprised', 'curious', 'sleepy',
  'angry', 'shy', 'amazed', 'laughing', 'suspicious', 'bored', 'proud',
  'confused', 'determined', 'sad', 'scared', 'crazy', 'guilty', 'attentive',
]

const tile = (svg, label, sub) => `
  <figure class="nt-tile">
    <div class="nt-art">${svg}</div>
    <figcaption><span class="nt-name">${escape(label)}</span>${sub ? `<span class="nt-sub">${escape(sub)}</span>` : ''}</figcaption>
  </figure>`

const avatarsTiles = avatarsVariants
  .map((variant) => tile(createAvatar({ name: 'orion', variant, size: 96 }), variant))
  .join('')

const duoTiles = shapes
  .map((shape, i) =>
    tile(
      createNovatar({ seed: 'novatar', engine: 'duo', shape, expression: expressions[i % expressions.length] }),
      shape,
      expressions[i % expressions.length],
    ),
  )
  .join('')

const fragment = `<div id="novatar-gallery">
  <style>
    #novatar-gallery { font: inherit; color: var(--foreground); }
    #novatar-gallery h2 { margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 500; }
    #novatar-gallery .nt-note { margin: 0 0 14px; color: var(--muted-foreground); }
    #novatar-gallery .nt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 12px 8px; }
    #novatar-gallery .nt-tile { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    #novatar-gallery .nt-art { width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; }
    #novatar-gallery .nt-art svg { width: 100%; height: 100%; }
    #novatar-gallery figcaption { display: flex; flex-direction: column; align-items: center; text-align: center; line-height: 1.25; }
    #novatar-gallery .nt-name { font-size: 12px; }
    #novatar-gallery .nt-sub { font-size: 11px; color: var(--muted-foreground); }
    #novatar-gallery hr { margin: 22px 0 16px; }
  </style>
  <h2>avatars engine — 21 variants</h2>
  <p class="nt-note">seed <code>orion</code> · npx novatar orion --engine avatars --variant &lt;id&gt;</p>
  <div class="nt-grid">${avatarsTiles}</div>
  <hr />
  <h2>duo engine — 21 shapes × 22 expressions</h2>
  <p class="nt-note">seed <code>novatar</code> · npx novatar novatar --engine duo --shape &lt;id&gt; --expression &lt;id&gt;</p>
  <div class="nt-grid">${duoTiles}</div>
</div>`

const out =
  '/Users/justincheu/.zcode/v2/visualizations/bba2a8979d96f14351adaf07597ef5dc1159bb2dd7a8bb749c50b0c64d96ab7b/novatar-gallery.html'
writeFileSync(out, fragment)
console.log('gallery written:', out, `(${fragment.length} bytes)`)
