/*
 * Chart colours.
 *
 * recharts takes literal values, not Tailwind classes, so the palette is read
 * from the same CSS variables as the theme (src/index.css): charts follow light
 * and dark mode without re-rendering.
 */
const c = (name: string) => `rgb(var(--${name}))`;

/** One accent stepped by lightness: parts of one whole (a pie, a share). */
export const SERIES = [c('s1'), c('s2'), c('s3'), c('s4')];

/** Distinct categories (providers, features), accent first. */
export const CATS = [c('c1'), c('c2'), c('c3'), c('c4'), c('c5'), c('c6'), c('c7'), c('c8')];

/** Axis, grid and tooltip chrome. */
export const CHART = {
  grid: 'rgb(var(--ink-700))',
  axis: 'rgb(var(--ink-400))',
  text: 'rgb(var(--ink-300))',
  brand: c('brand'),
  ok: c('ok'),
  warn: c('warn'),
  bad: c('bad'),
};

/** A colour per key that stays the same everywhere it's drawn (a provider is always the same colour). */
export function colourFor(key: string, keys: string[]) {
  const i = keys.indexOf(key);
  return key === 'other' ? CATS[7] : CATS[(i < 0 ? 0 : i) % 7];
}
