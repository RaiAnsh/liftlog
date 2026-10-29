import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves from /<repo>/; override with BASE_PATH in CI.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    VitePWA({
      // New versions install silently in the background and take over on the next launch.
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-64.png'],
      manifest: {
        id: base,
        name: 'ARLog',
        short_name: 'ARLog',
        description: 'Offline workout tracker with rule-based coaching. Your data stays on your phone.',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'fitness'],
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything, including the ~6 MB of exercise photos, so the whole app works in airplane mode.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,json}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
})
