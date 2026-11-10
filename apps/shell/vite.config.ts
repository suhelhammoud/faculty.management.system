import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const adminEntry = env.VITE_ADMIN_REMOTE_URL || 'http://localhost:3011/remoteEntry.js';
  return {
  plugins: [
    react(),
    federation({
      name: 'shell',
      dts: false,
      remotes: {
        admin: { type: 'module', name: 'admin', entry: adminEntry, entryGlobalName: 'admin', shareScope: 'default' },
        attendance: {
          type: 'module',
          name: 'attendance',
          entry: 'http://localhost:3001/remoteEntry.js',
          entryGlobalName: 'attendance',
          shareScope: 'default',
        },
        maintenance: {
          type: 'module',
          name: 'maintenance',
          entry: 'http://localhost:3002/remoteEntry.js',
          entryGlobalName: 'maintenance',
          shareScope: 'default',
        },
        supervision: {
          type: 'module',
          name: 'supervision',
          entry: 'http://localhost:3003/remoteEntry.js',
          entryGlobalName: 'supervision',
          shareScope: 'default',
        },
        meetings: {
          type: 'module',
          name: 'meetings',
          entry: 'http://localhost:3004/remoteEntry.js',
          entryGlobalName: 'meetings',
          shareScope: 'default',
        },
        hr: {
          type: 'module',
          name: 'hr',
          entry: 'http://localhost:3005/remoteEntry.js',
          entryGlobalName: 'hr',
          shareScope: 'default',
        },
        exams: {
          type: 'module',
          name: 'exams',
          entry: 'http://localhost:3006/remoteEntry.js',
          entryGlobalName: 'exams',
          shareScope: 'default',
        },
        correspondence: {
          type: 'module',
          name: 'correspondence',
          entry: 'http://localhost:3007/remoteEntry.js',
          entryGlobalName: 'correspondence',
          shareScope: 'default',
        },
        inventory: {
          type: 'module',
          name: 'inventory',
          entry: 'http://localhost:3008/remoteEntry.js',
          entryGlobalName: 'inventory',
          shareScope: 'default',
        },
        'student-affairs': {
          type: 'module',
          name: 'student_affairs',
          entry: 'http://localhost:3009/remoteEntry.js',
          entryGlobalName: 'student_affairs',
          shareScope: 'default',
        },
        facilities: {
          type: 'module',
          name: 'facilities',
          entry: 'http://localhost:3010/remoteEntry.js',
          entryGlobalName: 'facilities',
          shareScope: 'default',
        },
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
    port: 3000,
    strictPort: true,
  },
  };
});
