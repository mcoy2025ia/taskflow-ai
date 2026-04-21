# TaskFlow AI

[![CI/CD](https://github.com/mcoy2025ia/taskflow-v3/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/mcoy2025ia/taskflow-v3/actions/workflows/ci-cd.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-RLS-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

SaaS de productividad con tablero Kanban drag-and-drop y asistente de IA RAG que responde preguntas en lenguaje natural sobre tus tareas.

## Features

- **Kanban board** — columnas Todo / In Progress / Done con drag-and-drop optimista (@dnd-kit)
- **RAG assistant** — chat en lenguaje natural que busca tareas relevantes por similitud semántica (pgvector + Ollama `nomic-embed-text`)
- **Streaming SSE** — respuestas del LLM token a token (Groq `llama-3.3-70b-versatile` o Ollama)
- **Auth completa** — registro, login, sesiones persistentes (Supabase Auth + RLS)
- **Dark/light mode** — sin flash en hidratación

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 App Router + TypeScript strict |
| Auth & DB | Supabase (PostgreSQL + RLS + pgvector) |
| Embeddings | Ollama `nomic-embed-text` (768 dims) |
| Chat LLM | Groq `llama-3.3-70b-versatile` / Ollama |
| UI | Tailwind CSS v4 + shadcn/ui + @dnd-kit |
| Tests | Vitest + Playwright |
| Deploy | Vercel |

## Requisitos previos

- Node.js 20+
- [Ollama](https://ollama.com/) corriendo localmente con `nomic-embed-text` descargado
- Proyecto en [Supabase](https://supabase.com/) con las migraciones aplicadas
- API key de [Groq](https://console.groq.com/) (o Ollama como chat provider)

## Instalación local

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/mcoy2025ia/taskflow-v3.git
cd taskflow-v3
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 3. Descargar el modelo de embeddings
ollama pull nomic-embed-text

# 4. Aplicar migraciones de base de datos
#    IMPORTANTE: verificar halfvec(768) en 003_embeddings.sql y 004_rls_policies.sql
npx supabase db push

# 5. Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

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
npm test             # Vitest (una pasada)
npm run test:watch   # Vitest en modo watch
npm run test:e2e     # Playwright E2E (arranca dev server)
npx tsc --noEmit     # Type-check sin compilar
```

## Advertencia: dimensiones de embeddings

Las migraciones SQL declaran `halfvec(1024)` (diseño original para Voyage AI), pero el código genera vectores de **768 dimensiones** con `nomic-embed-text`. Antes de `supabase db push` en un entorno nuevo, cambiar `halfvec(1024)` → `halfvec(768)` en `supabase/migrations/003_embeddings.sql` y `004_rls_policies.sql`.

## Deploy

El pipeline CI/CD despliega automáticamente a Vercel cuando se hace push a `main`. Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para el flujo de trabajo.

Para deploy manual:

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login y vincular proyecto
vercel login
vercel link

# Deploy a producción
vercel --prod
```

## Licencia

MIT
