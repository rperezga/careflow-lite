import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, proxy API calls to the backend so there is no CORS to configure.
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      // WebSocket hub for live updates.
      '/ws': { target: 'ws://127.0.0.1:4000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
