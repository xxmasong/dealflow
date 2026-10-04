/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // The main chunk is MUI + dnd-kit (about 190 kB gzipped); routes are split.
    chunkSizeWarningLimit: 700,
  },
  server: {
    // The API runs separately in development; same-origin /graphql in production.
    proxy: { '/graphql': process.env.API_URL ?? 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
