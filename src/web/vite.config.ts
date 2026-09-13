/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: { proxy: { '/api': env.VITE_DEV_API_URL || 'http://127.0.0.1:8000' } },
    test: {
      environment: 'node',
    },
  };
});
