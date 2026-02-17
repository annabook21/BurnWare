import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Inject at build time so bundle content (and thus filename hash) changes every build.
// Fixes deploys where the same index-XXXX.js was served because the build output was unchanged.
const buildTimestamp = Date.now();

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(String(buildTimestamp)),
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
