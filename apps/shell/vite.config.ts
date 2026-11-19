import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const remote = (name: string, port: number) => ({
    type: 'module' as const,
    name,
    entry:
      env[`VITE_${name.toUpperCase()}_REMOTE_URL`] || `http://localhost:${port}/remoteEntry.js`,
    entryGlobalName: name,
    shareScope: 'default',
  });
  return {
    plugins: [
      react(),
      federation({
        name: 'shell',
        dts: false,
        shareStrategy: 'loaded-first',
        remotes: {
          admin: remote('admin', 3011),
          attendance: remote('attendance', 3001),
          maintenance: remote('maintenance', 3002),
          supervision: remote('supervision', 3003),
          meetings: remote('meetings', 3004),
          hr: remote('hr', 3005),
          exams: remote('exams', 3006),
          correspondence: remote('correspondence', 3007),
          inventory: remote('inventory', 3008),
          'student-affairs': remote('student_affairs', 3009),
          facilities: remote('facilities', 3010),
        },
        shared: {
          'react-router': { singleton: true },
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
