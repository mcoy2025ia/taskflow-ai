import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Carga manual de variables desde .env.local 
 * Ajustado para leer el archivo correcto que tienes en tu proyecto.
 */
const envPath = resolve(process.cwd(), '.env.local')

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    
    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '') // Quita comillas si existen
    
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  })
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  /* Ejecución en paralelo en local, serial en CI */
  fullyParallel: !process.env.CI,
  /* Falla si olvidaste un .only en el código */
  forbidOnly: !!process.env.CI,
  /* Reintentos en caso de fallo */
  retries: process.env.CI ? 2 : 0,
  /* Workers para velocidad */
  workers: process.env.CI ? 1 : undefined,
  /* Reporte en HTML */
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    /* Recolectar trazas en el primer reintento */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Reutiliza el estado de autenticación guardado */
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  /* Lanza el servidor local antes de empezar los tests */
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})