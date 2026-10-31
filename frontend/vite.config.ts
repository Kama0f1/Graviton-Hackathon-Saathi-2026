import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server:
// - host: true + allowedHosts: true -> reachable from the phone through a cloudflared/ngrok https tunnel
// - /api is proxied to the FastAPI backend, so the phone only needs ONE tunnel (to this dev server)
//   and there are no mixed-content or CORS problems.
const BACKEND = process.env.SAATHI_BACKEND ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
})
