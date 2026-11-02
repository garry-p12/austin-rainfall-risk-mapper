import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the built site works from any folder
// (GitHub Pages, a UT web server, or opening dist/ behind any static host).
export default defineConfig({
  plugins: [react()],
  base: './',
  // MapLibre alone is ~800 kB; that is expected for a map app.
  build: { chunkSizeWarningLimit: 1200 },
});
