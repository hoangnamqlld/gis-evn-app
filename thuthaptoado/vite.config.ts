// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'PowerMind - Thu Thập Lưới Điện',
        short_name: 'PowerMind',
        description: 'Thu thập toạ độ thiết bị EVNHCMC',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/app/',
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        // Cache basemap tiles & backend /api/grid... responses offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-osm',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-esri',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'leaflet-assets', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /\/api\/grid.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-grid',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/api\/customers\/search.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-search',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // Static data tiles — cache mạnh, invalidate bằng manifest version
          {
            urlPattern: /\/data\/tiles\/.*\.geojson\.gz/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-data',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /\/data\/search\.json\.gz/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-data',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            // Manifest luôn check network trước để phát hiện update
            urlPattern: /\/data\/manifest\.json.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'tiles-manifest', networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
  base: '/', // Cloudflare Pages ở root domain — absolute path cho SPA deep links
  server: {
    port: 5173,
    open: true,
    hmr: { overlay: true },
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet:  ['leaflet', 'leaflet.markercluster', 'react-leaflet'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          charts:   ['recharts'],
          ocr:      ['tesseract.js'],
          xlsx:     ['xlsx'],
          qr:       ['jsqr', 'qrcode'],
        },
      },
    },
  },
});
