import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (err?.code === 'ECONNRESET') return;
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
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // exclude noise, generated placeholders, and the standalone Jest suite
    // under modernized/ (characterization tests for a not-yet-created
    // authRouter.ts rewrite; run via Jest per modernized/test-README.md, not Vitest)
    exclude: ['**/node_modules/**', '**/playwright/**', '**/tests/**', '**/__tests__/*.generated.test.ts', '**/modernized/**'],
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
    chunkSizeWarningLimit: 1000
  }
})

