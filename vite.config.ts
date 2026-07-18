import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// VocalDNA is local-first: this config produces a static build that runs
// entirely from the filesystem/localhost with no calls to any external
// service. The PWA plugin adds a manifest + service worker so it can be
// installed to an iPad home screen and used offline after the first load.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'VocalDNA',
        short_name: 'VocalDNA',
        description: 'Local-first vocal repertoire manager',
        theme_color: '#14161a',
        background_color: '#14161a',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
});
