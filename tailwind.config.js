/** A colour defined as "r g b" in a CSS variable, with Tailwind's opacity modifier. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Every colour is a CSS variable (src/index.css) so the console reads in light
        // and dark: the same class names, swapped values. One gray family, one accent.
        ink: {
          950: v('ink-950'),  // contrast against the accent (button label)
          900: v('ink-900'),  // app canvas
          850: v('ink-850'),  // sidebar / raised surface
          800: v('ink-800'),  // card
          700: v('ink-700'),  // hairline border
          600: v('ink-600'),  // strong border
          400: v('ink-400'),  // dim text
          300: v('ink-300'),  // muted text
          100: v('ink-100'),  // body text
          50:  v('ink-50'),   // headings
        },
        // Single accent, taken from the Fluntr marketing site. Deliberately not a hue
        // that already carries meaning here: red is error and green is healthy.
        brand: {
          DEFAULT: v('brand'),
          soft: v('brand-soft'),
          dim: v('brand-dim'),
          wash: 'rgb(var(--brand) / 0.08)',
          line: 'rgb(var(--brand) / 0.26)',
        },
        // Semantic colours are for state only, never decoration.
        ok:   v('ok'),
        warn: v('warn'),
        bad:  v('bad'),
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Display sizes carry negative tracking; small labels carry positive.
        'stat': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'label': ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        // Varied radii: tighter inside, softer on containers.
        'card': '14px',
        'inner': '8px',
      },
      boxShadow: {
        // Tinted to the canvas hue rather than pure black at low opacity.
        'card': '0 1px 2px rgba(21,23,27,0.04), 0 1px 3px rgba(21,23,27,0.06)',
        'lift': '0 2px 6px rgba(21,23,27,0.06), 0 12px 32px -12px rgba(21,23,27,0.18)',
      },
      transitionDuration: { DEFAULT: '200ms' },
    },
  },
  plugins: [],
}
