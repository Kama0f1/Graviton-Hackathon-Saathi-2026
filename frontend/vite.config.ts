// PWA config: manifest (installable), custom service worker (src/sw.ts),
// and share_target so files shared from WhatsApp open in Read mode.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // cloudflared tunnel hostnames must be allowed or Vite rejects the request
  server: { host: true, allowedHosts: ['.trycloudflare.com'] },
  preview: { host: true, allowedHosts: ['.trycloudflare.com'] },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // SW off in dev so code changes are never served stale; test install with `npm run build && npm run preview`
      devOptions: { enabled: false, type: 'module' },
      manifest: {
        name: 'Saathi',
        short_name: 'Saathi',
        description: 'Navigate, sort waste and read documents with your camera and voice.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: '/share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'file', accept: ['image/*', 'application/pdf'] }] },
        },
      },
    }),
  ],
});
