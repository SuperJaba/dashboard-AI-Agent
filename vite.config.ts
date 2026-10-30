import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any, _req: any, res: any) => {
            if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED') {
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backend API starting up, please retry', code: err.code }));
              }
              return;
            }
            console.error('Vite API Proxy Error:', err?.message);
          });
        }
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any, _req: any, res: any) => {
            if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED') {
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end();
              }
              return;
            }
            console.error('Vite Socket Proxy Error:', err?.message);
          });
        }
      }
    },
    watch: {
      ignored: ['**/.start_agent.sh', '**/.ai_tasks.md', '**/*.log', '**/coverage/**']
    }
  },
  test: {
    pool: 'forks',
    fileParallelism: false,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['src/backend/**', 'node'],
      ['server.test.js', 'node'],
      ['src/local-agent-worker.test.js', 'node'],
    ],
    globals: true,
    setupFiles: './src/setupTests.ts',
    // exclude noise & generated placeholders
    exclude: ['**/node_modules/**', '**/playwright/**', '**/tests/**', '**/modernized/**', '**/__tests__/*.generated.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: ['src/**/*.d.ts', '**/*.generated.test.ts']
    },
    testTimeout: 30_000
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xterm')) {
              return 'vendor-xterm';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-i18next') || id.includes('i18next')) {
              return 'vendor-react';
            }
            return 'vendor-common';
          }
        }
      }
    }
  }
})

