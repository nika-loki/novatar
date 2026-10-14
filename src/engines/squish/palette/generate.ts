import { generatePalette } from '../../../palette';
import { paletteSeed, seededRandom } from "../core/rng";

const paletteCache = new Map<string, string[]>();
const PALETTE_CACHE_LIMIT = 256;

// Same validation contract as the avatars engine (see create-avatar.ts).
const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

/**
 * Resolves the palette for a seed. When `override` is provided it must be
 * exactly 5 hexadecimal colors and is used verbatim (novatar extension —
 * upstream squish is seeded-only). Overrides bypass the cache.
 */
export function paletteFor(seed: string, override?: readonly string[]) {
  if (override !== undefined) {
    if (
      !Array.isArray(override) ||
      override.length !== 5 ||
      override.some((color) => !HEX_COLOR.test(color))
    ) {
      throw new TypeError('colors must contain exactly 5 hexadecimal colors.');
    }
    return [...override];
  }
  const cached = paletteCache.get(seed);
  if (cached) return cached;
  const colors = [...generatePalette(seed, { mode: "presets" }).colors].slice(
    0,
    5,
  );
  if (paletteCache.size >= PALETTE_CACHE_LIMIT) {
    const oldest = paletteCache.keys().next().value;
    if (oldest !== undefined) paletteCache.delete(oldest);
  }
  paletteCache.set(seed, colors);
  return colors;
}

export function solidIndexFor(seed: string) {
  const colors = paletteFor(seed);
  return Math.min(
    colors.length - 1,
    Math.floor(seededRandom(paletteSeed(seed))() * colors.length),
  );
}

export function solidColorFor(seed: string) {
  const colors = paletteFor(seed);
  return colors[solidIndexFor(seed)] ?? "#6b5cff";
}

export function colorsFor(seed: string, override?: readonly string[]) {
  const colors = paletteFor(seed, override);
  return {
    body: colors[solidIndexFor(seed)] ?? "#6b5cff",
    eye: "#fff",
    palette: colors,
  };
}

export const avatarPalette = (seed = "avatar") => paletteFor(seed);
