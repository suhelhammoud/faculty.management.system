import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'inventory',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
      },
      dts: false,
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
  server: {
    port: 3008,
    strictPort: true,
    origin: 'http://localhost:3008',
  },
  preview: {
    port: 3008,
    strictPort: true,
  },
  build: {
    target: 'esnext',
  },
});
