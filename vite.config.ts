import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    target: 'es2022',
    sourcemap: process.env.VITE_PUBLIC_SOURCEMAP === 'true',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          three: ['three'],
          threeRuntime: ['@react-three/fiber', '@react-three/drei', 'camera-controls'],
          data: ['idb', 'fflate'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
