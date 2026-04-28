# TaskFlow AI

[![CI/CD](https://github.com/mcoy2025ia/taskflow-ai/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/mcoy2025ia/taskflow-ai/actions/workflows/ci-cd.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-RLS-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

SaaS de productividad con tablero Kanban drag-and-drop, asistente de IA RAG con búsqueda semántica híbrida, analítica de proyecto y exportación de informes ejecutivos en PDF.

## Features

- **Kanban board** — columnas Todo / In Progress / Done con drag-and-drop optimista (@dnd-kit)
- **Asistente RAG híbrido** — combina búsqueda semántica (pgvector + Voyage AI) con detección de intención estructural (estado, prioridad) para respuestas más precisas
- **Modo voz** — dictado por voz con Web Speech API; el asistente responde en formato conversacional sin markdown
- **Streaming SSE** — respuestas del LLM token a token (Groq `llama-3.3-70b-versatile` o Ollama)
- **Analítica de proyecto** — KPIs, burndown, velocidad de ejecución, progreso por fase y análisis de riesgo de entrega
- **Exportar PDF** — informe ejecutivo generado por LLM + tablero vectorial ensamblado con jsPDF, descarga automática
- **Auth completa** — registro, login, sesiones persistentes (Supabase Auth + RLS)
- **Dark/light mode** — sin flash en hidratación

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 App Router + TypeScript strict |
| Auth & DB | Supabase (PostgreSQL + RLS + pgvector) |
| Embeddings | Voyage AI `voyage-3-lite` (512 dims) |
| Chat LLM | Groq `llama-3.3-70b-versatile` / Ollama |
| UI | Tailwind CSS v4 + shadcn/ui + @dnd-kit |
| PDF | jsPDF (vectorial, sin html2canvas) |
| Tests | Vitest + Playwright |
| Deploy | Vercel (CI/CD automático vía GitHub Actions) |

## Requisitos previos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com/) con las migraciones aplicadas
- API key de [Voyage AI](https://www.voyageai.com/) para embeddings
- API key de [Groq](https://console.groq.com/) (o Ollama como chat provider)

## Instalación local

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/mcoy2025ia/taskflow-ai.git
cd taskflow-ai
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 3. Aplicar migraciones de base de datos
#    IMPORTANTE: verificar halfvec(512) en 003_embeddings.sql y 004_rls_policies.sql
#    Las migraciones del repo declaran halfvec(1024) — corregir antes de aplicar
npx supabase db push

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

VOYAGE_API_KEY=<voyage-api-key>
EMBED_PROVIDER=voyage
EMBED_MODEL=voyage-3-lite

GROQ_API_KEY=<groq-api-key>
CHAT_PROVIDER=groq            # 'groq' | 'ollama'

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

EMBED_INTERNAL_SECRET=<min-32-random-chars>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run lint         # ESLint
npx tsc --noEmit     # Type-check sin compilar

npm test             # Vitest (una pasada)
npm run test:watch   # Vitest en modo watch
npm run test:coverage # Vitest con cobertura
npm run test:e2e     # Playwright E2E (arranca dev server)
npm run test:e2e:ui  # Playwright con interfaz visual

npx vitest run src/actions/__tests__/tasks.test.ts  # Un solo archivo
npx playwright test e2e/login.spec.ts               # Un solo test E2E
```

## Arquitectura RAG

El asistente combina dos estrategias de búsqueda en paralelo:

1. **Estructural** — detecta intención en la query (ej. "en progreso", "urgente") y filtra directamente por `status`/`priority` vía SQL
2. **Semántica** — genera un embedding con Voyage AI y busca por similitud coseno en pgvector (`search_tasks_by_embedding`)

Los resultados se fusionan deduplicados, priorizando los matches estructurales (similitud = 1.0). El contexto resultante se inyecta en el system prompt junto con un resumen global del proyecto (total, completadas, días restantes, velocidad requerida).

## Advertencia: dimensiones de embeddings

Las migraciones SQL declaran `halfvec(1024)` (diseño original), pero el código usa `voyage-3-lite` que genera vectores de **512 dimensiones**. Antes de `supabase db push` en un entorno nuevo, cambiar `halfvec(1024)` → `halfvec(512)` en `supabase/migrations/003_embeddings.sql` y `004_rls_policies.sql`, incluyendo las firmas de las funciones SQL.

## Backfill de embeddings

Si las tareas ya existen pero `task_embeddings` está vacía, ejecutar:

```bash
npm install -D tsx
npx dotenv -e .env.local -- npx tsx scripts/seed-embeddings.ts
```

## Deploy

El pipeline CI/CD despliega automáticamente a Vercel en cada push a `main` (lint → tsc → tests → build → deploy).

Para deploy manual:

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

## Licencia

MIT
