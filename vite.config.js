import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Vitest transforms .jsx test/imported files itself for its Node test environment, ahead of
  // @vitejs/plugin-react's own Babel transform — without this, esbuild's default JSX handling
  // there falls back to the classic runtime (expecting a `React` identifier in scope) instead of
  // matching the automatic runtime the real browser build already uses. Only affects test runs;
  // the served/built app never takes this path.
  esbuild: {
    jsx: 'automatic',
  },

  resolve: {
    alias: {
      // Every internal import uses this: '@/services/actionStoriesService'.
      // No relative '../../../' imports anywhere in src/.
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // Vitest reads this same file, so the '@' alias and JSX transform match the build.
  test: {
    environment: 'node',
    globals: true,
    // extraction/**/*.test.js covers generation-only tooling (extraction/classifyBlocks.js etc.),
    // which has no JSX and isn't shipped with the app — still worth running under the same runner.
    include: ['src/**/*.test.{js,jsx}', 'extraction/**/*.test.js'],
    passWithNoTests: true,
  },

  build: {
    rollupOptions: {
      output: {
        // recharts pulls in d3's chart-math internals, which is what pushes the main chunk over
        // 500kB — split into its own cacheable chunk rather than inline it, matching the same
        // split the app this merges into already makes for the same library.
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) {
            return 'vendor-recharts'
          }
        },
      },
    },
  },
})
