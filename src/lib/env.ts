import { z } from 'zod'

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL:  z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // LLM
  GROQ_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  CHAT_PROVIDER: z.enum(['deepseek', 'groq', 'ollama']).default('deepseek'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2'),

  // Embeddings
  VOYAGE_API_KEY: z.string().min(1),

  // Seguridad
  EMBED_INTERNAL_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Rate limiting (opcional — sin Upstash el rate limit está desactivado)
  UPSTASH_REDIS_REST_URL:   z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Cuenta demo (fallback si Anonymous Sign-Ins no está habilitado en Supabase)
  DEMO_EMAIL:    z.string().email().optional(),
  DEMO_PASSWORD: z.string().min(1).optional(),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(
      `❌ Variables de entorno inválidas o faltantes:\n${missing.join('\n')}\n\nCopia .env.example a .env.local y rellena los valores.`
    )
  }
  return result.data
}

// Se valida una sola vez al importar el módulo (en server startup)
export const env = validateEnv()
