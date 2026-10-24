import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: './', plugins: [react()], test: { include: ['src/**/*.test.ts'] }, build: { chunkSizeWarningLimit: 1100, rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] } } } } });
