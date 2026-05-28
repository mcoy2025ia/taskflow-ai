import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/actions/task.actions.ts',
        'src/hooks/use-tasks-by-status.ts',
        'src/lib/ai/rag.ts',
        'src/lib/ai/voyage.ts',
        'src/lib/analytics/metrics.ts',
        'src/lib/validations/task.schema.ts',
        'src/lib/validations/auth.schema.ts',
        'src/lib/hmac.ts',
      ],
      exclude: ['src/test/**', '**/*.d.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
