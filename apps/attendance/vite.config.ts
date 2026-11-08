import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'attendance',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
      },
      shared: {
        react: {
          singleton: true,
        },
        'react-dom': {
          singleton: true,
        },
      },
    }),
  ],
  server: {
    port: 3001,
    strictPort: true,
    origin: 'http://localhost:3001',
  },
  preview: {
    port: 3001,
    strictPort: true,
  },
  build: {
    target: 'esnext',
  },
});