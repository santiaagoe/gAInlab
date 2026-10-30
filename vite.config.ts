/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// Relative base so the app works on GitHub Pages under any repo path.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'gAInlab',
        short_name: 'gAInlab',
        description: 'Tu próximo entrenamiento, ya calculado.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1322',
        theme_color: '#0e1322',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/globals.d.ts'],
      reporter: ['text-summary', 'text'],
      // CI fails if coverage drops below today's level. The engine holds the rules, so it has the higher bar.
      thresholds: {
        lines: 45,
        branches: 40,
        'src/engine/**': { lines: 90, statements: 90, branches: 85, functions: 90 },
        'src/persistence.ts': { lines: 85, branches: 75 },
      },
    },
  },
})
