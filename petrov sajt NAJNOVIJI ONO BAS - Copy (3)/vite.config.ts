import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PocketBase server (koristi se samo za dev proxy da bi se izbegao CORS lokalno)
const POCKETBASE_TARGET = 'https://ace-barberstudio.online';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // Sve /api zahteve (uključujući realtime) prosleđuje na PocketBase server.
      // Pošto browser priča sa localhost-om, nema CORS problema.
      '/api': {
        target: POCKETBASE_TARGET,
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
});
