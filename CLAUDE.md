# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto
SaaS de productividad: tablero Kanban + asistente RAG con lenguaje natural.
MVP funcional construido en 4 fases. No es un boilerplate genérico.

## Stack exacto
- **Frontend**: Next.js 15 App Router + TypeScript strict
- **Auth + DB**: Supabase (`@supabase/ssr`) con RLS en todas las tablas
- **Embeddings**: Voyage AI `voyage-3-lite` → 512 dimensiones (archivo `src/lib/ai/voyage.ts`)
- **Chat**: Groq `llama-3.3-70b-versatile` / Ollama (intercambiable via `CHAT_PROVIDER`)
- **UI**: Tailwind CSS v4 + shadcn/ui + @dnd-kit

## Comandos disponibles
```bash
npm run dev           # dev server
npm run build         # build de producción
npm run lint          # ESLint
npm run start         # servidor de producción (requiere build previo)
npx tsc --noEmit      # type-check sin compilar

npm test              # Vitest (una sola pasada)
npm run test:watch    # Vitest en modo watch
npm run test:coverage # Vitest con cobertura
npm run test:e2e      # Playwright (arranca dev server automáticamente)
npm run test:e2e:ui   # Playwright con interfaz visual

npx supabase db push           # aplicar migraciones
npx supabase gen types typescript --local > src/types/database.types.ts
```

### Tests unitarios (Vitest)
Los tests viven en `src/actions/__tests__/tasks.test.ts`. Usan mocks de Supabase vía `makeChain()` — un builder que crea cadenas de query fluentes y awaitable. Para agregar tests de nuevas Server Actions, replicar ese patrón.

Para correr un solo archivo: `npx vitest run src/actions/__tests__/tasks.test.ts`

### Tests E2E (Playwright)
Requieren `.env.local` con credenciales reales. El proyecto `setup` ejecuta `e2e/auth.setup.ts` primero, guarda el estado de auth en `e2e/.auth/user.json`, y los tests de Chromium lo reutilizan. Para correr un solo test: `npx playwright test e2e/login.spec.ts`.

## Estructura crítica
```
middleware.ts           ← en la RAÍZ del proyecto (no en src/)
src/
  app/
    (auth)/             ← login, register — sin sidebar
    (dashboard)/        ← board, chat — con sidebar + topbar
    api/
      chat/             ← streaming SSE, runtime: nodejs (no edge)
      embed/            ← requiere HMAC, usa service_role; excluida de middleware auth (junto con api/backfill)
  actions/              ← "use server", siempre validar con Zod antes de tocar Supabase
  components/
    kanban/
      board-dynamic.tsx ← dynamic(() => import('./board'), { ssr: false }) — evita errores de hidratación con @dnd-kit
      board.tsx         ← KanbanBoard con DnDContext, useOptimistic, useTransition
  lib/
    supabase/
      client.ts         ← createBrowserClient (solo en 'use client')
      server.ts         ← createServerClient con cookies() — nuevo en cada request
      get-user.ts       ← helper usado en page-level para obtener el usuario autenticado
    ai/
      voyage.ts         ← generateEmbedding / generateQueryEmbedding — usa Voyage AI voyage-3-lite (512 dims)
      chat.ts           ← getChatProvider() → GroqProvider | OllamaProvider (seleccionado por CHAT_PROVIDER)
      rag.ts            ← searchTasksByQuery (threshold 0.65, limit 5) → buildContextBlock → buildSystemPrompt
    hmac.ts             ← verifyHmacRequest / signRequest (protege api/embed)
  types/app.types.ts    ← Task, KanbanColumn, ChatMessage (tipos de dominio, no de DB)
```

## Reglas de seguridad — nunca romper
1. `SUPABASE_SERVICE_ROLE_KEY` solo en `api/embed` y tests. Jamás en cliente.
2. Toda Server Action valida con Zod `.safeParse()` antes de cualquier query.
3. Queries de Supabase siempre incluyen `.eq('user_id', user.id)` además del RLS.
4. INSERT en `task_embeddings` solo via `upsert_task_embedding()` con service_role.
5. `createClient()` del servidor es async — siempre `await createClient()`.

## Convenciones de código
- Server Actions retornan `ActionResult<T>`: `{ success: true, data: T } | { success: false, error: string }`
- Posición de tareas: espaciado de 1000 (1000, 2000...). Insertar al medio = `Math.round((prev + next) / 2)`.
- Embeddings: verificar `content_hash` antes de llamar al modelo. Si es igual, skip.
- `triggerEmbedding` en task.actions.ts usa fire-and-forget (`void fetch(...)`) — no bloquea la respuesta del usuario.
- Los componentes Kanban usan `useOptimistic` + `useTransition` — no usar `useState` para el estado del drag. Si `moveTask` falla, `useOptimistic` revierte automáticamente.

## Flujo de datos del chat (SSE)
`api/chat/route.ts` emite eventos SSE con este esquema — el cliente debe manejar los tres tipos:
```ts
{ type: 'token',   content: string }          // fragmento de texto del LLM
{ type: 'sources', sources: TaskSource[] }    // al final del stream, tareas usadas como contexto
{ type: 'error',   message: string }          // si el stream se interrumpe
```
El parse difiere según proveedor: Ollama envía JSON por línea; Groq usa el formato SSE `data: {...}` de OpenAI.

## Funciones SQL críticas (migrations/004)
Dos funciones `SECURITY DEFINER` en Supabase — no modificar sin entender sus implicaciones de seguridad.
Las migraciones en repo declaran `halfvec(1024)` pero **deben corregirse a `halfvec(512)`** antes de `supabase db push` (ver advertencia de dimensiones abajo):
- `search_tasks_by_embedding(query_embedding halfvec(512), match_threshold, match_count)` — accesible para `authenticated`; filtra por `auth.uid()` internamente.
- `upsert_task_embedding(p_task_id, p_user_id, p_embedding halfvec(512), p_content_hash)` — solo `service_role`; hace upsert condicional (solo si `content_hash` cambió).

## Variables de entorno requeridas
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
VOYAGE_API_KEY=               # requerida para embeddings (voyage-3-lite)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
CHAT_PROVIDER=groq            # 'groq' | 'ollama'
EMBED_INTERNAL_SECRET=        # mínimo 32 chars aleatorios
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Advertencia: mismatch de dimensiones
Las migraciones SQL (`003_embeddings.sql` y `004_rls_policies.sql`) declaran `halfvec(1024)` (diseñadas para `voyage-3.5`), pero `voyage.ts` usa `voyage-3-lite` que genera vectores de **512 dimensiones**. Antes de ejecutar `supabase db push` en un entorno nuevo, cambiar `halfvec(1024)` → `halfvec(512)` en ambos archivos de migración y en las firmas de las funciones SQL.

> Nota: el `README.md` menciona `nomic-embed-text` (768 dims) — esa información está desactualizada. El código real usa Voyage AI voyage-3-lite (512 dims).

## Errores comunes y solución
- **`cookies() should be awaited`**: en Next.js 15, `cookies()` es async. Usar `await cookies()`.
- **RLS silencioso**: Supabase no lanza error en SELECT bloqueado — retorna array vacío. Verificar con service_role.
- **Ollama no responde**: solo aplica cuando `CHAT_PROVIDER=ollama`. Verificar que `ollama serve` esté corriendo y que el modelo de chat esté descargado. El runtime de `api/chat` debe ser `nodejs`, no `edge`. Los embeddings usan Voyage AI, no Ollama.
- **Flash de tema**: el script inline en `app/layout.tsx` lo previene. No mover a useEffect.
- **HMAC rechazado**: las firmas tienen ventana de 5 minutos. Verificar que `EMBED_INTERNAL_SECRET` coincida entre el proceso que firma y el que verifica.
- **Cookies de auth perdidas en middleware**: `middleware.ts` debe devolver `supabaseResponse` (no `NextResponse.next()`); de lo contrario, Supabase no puede refrescar la sesión.


## CI/CD y deploy

El pipeline está en `.github/workflows/ci-cd.yml` y corre en cada push:

| Job | Cuándo | Pasos |
|-----|--------|-------|
| `ci` | todo push / PR → main | lint (0 warnings) → tsc → tests+coverage → build |
| `deploy-production` | merge a `main` (CI verde) | vercel pull → vercel build --prod → vercel deploy --prebuilt --prod |

**Secrets requeridos en GitHub** (Settings → Secrets → Actions):
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `EMBED_INTERNAL_SECRET`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`

**Deploy manual** (requiere `npm i -g vercel` y `vercel login`):
```bash
vercel link                        # vincular proyecto (una sola vez)
vercel env pull .env.local         # sincronizar variables desde Vercel
vercel --prod                      # deploy a producción
```

