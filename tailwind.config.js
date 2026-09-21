/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // One gray family (cool / slate). Previously the shell used slate while
        // pages used neutral #1A1A1A, so two different blacks sat side by side.
        ink: {
          950: '#FFFFFF',  // contrast against the accent (button label)
          900: '#F6F7F8',  // app canvas
          850: '#FFFFFF',  // sidebar / raised surface
          800: '#FFFFFF',  // card
          700: '#E6E7EA',  // hairline border
          600: '#D2D4D9',  // strong border
          400: '#767A85',  // dim text
          300: '#565A63',  // muted text
          100: '#26282E',  // body text
          50:  '#15171B',  // headings
        },
        // Single accent, taken from the Fluntr marketing site so the admin reads
        // as the same product. Replaces the indigo/cyan/magenta/violet mix.
        // Single accent, under 80% saturation, deliberately not a hue that
        // already carries meaning here: red is error and green is healthy, so
        // the accent stays out of the semantic set.
        brand: {
          DEFAULT: '#0E6E6E',
          soft: '#12898A',
          dim: '#0A5252',
          wash: 'rgba(14,110,110,0.08)',
          line: 'rgba(14,110,110,0.26)',
        },
        // Semantic colours are for state only, never decoration.
        ok:   '#4ADE80',
        warn: '#FBBF24',
        bad:  '#F87171',
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
