import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    // Network-bound setup hooks (signInAs creates/signs in a Supabase user) can
    // exceed the 10s default under auth latency/throttling; give them headroom.
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
