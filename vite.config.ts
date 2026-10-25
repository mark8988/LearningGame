import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { offlinePlugin } from './scripts/pwa-plugin.mjs';
export default defineConfig({ base: './', plugins: [react(), offlinePlugin()], test: { include: ['src/**/*.test.ts'] }, build: { chunkSizeWarningLimit: 1100, rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] } } } } });
