# TaskFlow AI

[![CI/CD](https://github.com/mcoy2025ia/taskflow-ai/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/mcoy2025ia/taskflow-ai/actions/workflows/ci-cd.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-RLS-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

SaaS de productividad multi-usuario con tablero Kanban colaborativo, agente de IA con tool calling, búsqueda semántica híbrida con reranking, analítica de proyecto y exportación de informes ejecutivos en PDF.

## Features

- **Kanban colaborativo** — columnas Todo / In Progress / Done con drag-and-drop optimista (@dnd-kit), asignación de miembros por tarea y filtro por usuario
- **Agente RAG con tool calling** — crea, actualiza, mueve y elimina tareas en lenguaje natural; confirmación obligatoria para acciones destructivas
- **Búsqueda semántica híbrida** — Voyage AI `voyage-3-lite` (pgvector 512 dims) + reranking con `rerank-2-lite` + detección de intención estructural
- **Memoria conversacional** — sesiones de chat persistidas en DB, historial cargado por `session_id` en URL
- **Modo voz** — dictado con Web Speech API + TTS de respuesta en `es-CO`; el LLM ajusta el formato automáticamente
- **Streaming SSE** — respuestas token a token (Groq `llama-3.3-70b-versatile`); fallback a Claude Haiku 4.5 si Groq cae
- **Analítica de proyecto** — KPIs, burndown, velocidad, progreso por fase, análisis de riesgo; exportación PDF generado por LLM con jsPDF
- **Importación de tareas desde CSV** — empty state del tablero ofrece importador con drop zone, preview, validación Zod permisiva y plantilla descargable (`public/template-tareas.csv`); embeddings se generan throttleados en background respetando el rate limit de Voyage
- **Multi-tenancy** — proyectos, roles (owner/editor/viewer), invitaciones por email con tokens, sync en tiempo real via Supabase Realtime
- **Comentarios en tareas** — thread por tarea, el agente puede buscar en comentarios via `search_comments` tool
- **Onboarding interactivo** — tour de 4 pasos + proyecto demo pre-poblado con 10 tareas
- **Sugerencias proactivas** — banner de alerta en el board cuando hay tareas vencidas o riesgo de velocidad
- **Auth completa** — registro, login, sesiones (Supabase Auth + RLS en todas las tablas)
- **Seguridad** — rate limiting (Upstash), HMAC en `/api/embed`, headers CSP/HSTS/X-Frame-Options, Vercel BotID
- **Observabilidad** — Sentry con eventos custom (`task.created`, `agent.tool_called`, `chat.completion`)
- **Dark/light mode** — sin flash en hidratación (script inline en `<head>`)

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 App Router + TypeScript strict + React 19 |
| Auth & DB | Supabase (PostgreSQL + RLS + pgvector `halfvec(512)`) |
| Embeddings | Voyage AI `voyage-3-lite` (512 dims) + `rerank-2-lite` |
| Chat LLM | Groq `llama-3.3-70b-versatile` + Claude Haiku 4.5 (fallback) |
| UI | Tailwind CSS v4 + shadcn/ui + @dnd-kit + Geist font |
| PDF | jsPDF (vectorial, sin html2canvas) |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) |
| Email | Resend (invitaciones de proyecto) |
| Observabilidad | Sentry `@sentry/nextjs` v10 |
| Tests | Vitest (82% cobertura) + Playwright E2E (6 specs) |
| CI/CD | GitHub Actions → Vercel (Lighthouse CI incluido) |
| Runtime | Node.js 24 (Vercel Fluid Compute) |

## Requisitos previos

- Node.js 24+
- Proyecto en [Supabase](https://supabase.com/) con las 10 migraciones aplicadas
- API key de [Voyage AI](https://www.voyageai.com/) para embeddings
- API key de [Groq](https://console.groq.com/) para chat

## Instalación local

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/mcoy2025ia/taskflow-ai.git
cd taskflow-ai
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 3. Aplicar migraciones (en orden, vía Supabase Dashboard SQL Editor)
#    supabase/migrations/001_profiles.sql
#    supabase/migrations/002_tasks.sql
#    supabase/migrations/003_embeddings.sql
#    supabase/migrations/004_rls_policies.sql
#    supabase/migrations/005_projects.sql
#    supabase/migrations/006_chat_sessions.sql
#    supabase/migrations/007_collaboration.sql
#    supabase/migrations/008_invitations.sql
#    supabase/migrations/009_profiles_collab.sql
#    supabase/migrations/010_realtime.sql
#
#    O con CLI (si tienes el proyecto linkeado):
#    npx supabase db push

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Ver `.env.example` para la lista completa con comentarios. Las obligatorias:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

VOYAGE_API_KEY=<voyage-api-key>
GROQ_API_KEY=<groq-api-key>
CHAT_PROVIDER=groq

EMBED_INTERNAL_SECRET=<min-32-random-chars>   # openssl rand -hex 32
NEXT_PUBLIC_APP_URL=http://localhost:3000

UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
```

Opcionales (funcionalidad extra):

```env
RESEND_API_KEY=<key>            # emails de invitación
ANTHROPIC_API_KEY=<key>         # fallback Claude Haiku si Groq cae
CRON_SECRET=<secret>            # protege /api/cron/insights
NEXT_PUBLIC_SENTRY_DSN=<dsn>    # observabilidad
```

## Scripts

```bash
npm run dev           # Servidor de desarrollo
npm run build         # Build de producción
npm run lint          # ESLint (0 warnings)
npx tsc --noEmit      # Type-check sin compilar

npm test              # Vitest (una pasada)
npm run test:watch    # Vitest en modo watch
npm run test:coverage # Vitest con cobertura (~82%)
npm run test:e2e      # Playwright E2E
npm run test:e2e:ui   # Playwright con interfaz visual

# Correr un solo archivo:
npx vitest run src/actions/__tests__/tasks.test.ts
npx playwright test e2e/agent.spec.ts

# Backfill embeddings (si las tareas ya existen pero task_embeddings está vacía):
npx dotenv -e .env.local -- npx tsx scripts/seed-embeddings.ts
```

## Arquitectura del agente (RAG + tool calling)

El asistente combina RAG y tool calling en un loop de 2 turnos:

**Turno 1** — detección de intención + tools:
1. **Búsqueda híbrida** — intención estructural (regex status/priority) + semántica (pgvector) en paralelo; resultados fusionados y re-rankeados con Voyage `rerank-2-lite`
2. **Tool calling** — Groq detecta si la query requiere acción (crear/mover/eliminar tarea, buscar comentarios); acciones destructivas emiten `confirm_required` y pausan hasta confirmación del usuario

**Turno 2** — respuesta final en streaming SSE con los resultados de las tools inyectados como contexto.

Fallback: si Groq no responde, se activa Claude Haiku 4.5 via Anthropic API (solo texto, sin tool calling).

## Migraciones y base de datos

Todas las migraciones usan `CREATE IF NOT EXISTS` y son idempotentes. Si restauras un backup antiguo, es posible que falten columnas o FK constraints. Problemas comunes:

```sql
-- FK faltante en task_assignments:
ALTER TABLE public.task_assignments
  ADD CONSTRAINT task_assignments_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Columna project_id faltante en tasks:
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES public.projects(id) ON DELETE SET NULL;

-- Recargar schema cache de PostgREST tras cambios:
NOTIFY pgrst, 'reload schema';
```

## Deploy

El pipeline CI/CD despliega automáticamente a Vercel en cada push a `main`:
lint → tsc → tests + cobertura → build → Lighthouse CI → deploy.

Para deploy manual:

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel --prod
```

## Licencia

MIT
