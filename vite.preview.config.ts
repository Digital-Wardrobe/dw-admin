import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Build config for the design preview only. Relative base so the bundle works
 * from any hosting path, and a single output file so it is easy to publish.
 * The production build (vite.config.ts) is untouched.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    rollupOptions: { input: 'preview.html' },
  },
})
