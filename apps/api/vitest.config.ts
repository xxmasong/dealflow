import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // PGlite boots a WASM Postgres per test file; give it room on slow CI runners.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
