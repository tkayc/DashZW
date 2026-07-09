import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const frontendsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export function createAppViteConfig(appName, port) {
  const appDir = path.join(frontendsRoot, appName);
  return {
    plugins: [react()],
    server: {
      port,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes, req) => {
              if (req.url?.includes('/events')) {
                proxyRes.headers['cache-control'] = 'no-cache';
                proxyRes.headers['x-accel-buffering'] = 'no';
              }
            });
          },
        },
        '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
    resolve: {
      alias: {
        '@': path.join(appDir, 'src'),
        '@location': path.join(frontendsRoot, 'shared/location'),
        '@assets': path.join(frontendsRoot, 'shared/assets'),
        '@shared': path.join(frontendsRoot, 'shared'),
      },
    },
  };
}
