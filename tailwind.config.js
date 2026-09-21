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
          950: '#080B12',  // page background
          900: '#0B0F19',  // app canvas
          850: '#0E1320',  // raised surface
          800: '#131A2A',  // card
          700: '#1E293B',  // border
          600: '#334155',  // strong border
          400: '#64748B',  // dim text
          300: '#94A3B8',  // muted text
          100: '#E2E8F0',  // body text
          50:  '#F8FAFC',  // headings
        },
        // Single accent, taken from the Fluntr marketing site so the admin reads
        // as the same product. Replaces the indigo/cyan/magenta/violet mix.
        brand: {
          DEFAULT: '#C9A84C',
          soft:    '#E3C877',
          dim:     '#8A7231',
          wash:    'rgba(201,168,76,0.10)',
          line:    'rgba(201,168,76,0.28)',
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
        'card': '0 1px 2px rgba(5,8,14,0.6), 0 8px 24px -12px rgba(5,8,14,0.8)',
        'lift': '0 2px 4px rgba(5,8,14,0.6), 0 16px 40px -16px rgba(5,8,14,0.9)',
      },
      transitionDuration: { DEFAULT: '200ms' },
    },
  },
  plugins: [],
}
