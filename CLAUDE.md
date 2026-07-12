# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto
SaaS de productividad multi-usuario: tablero Kanban colaborativo + agente RAG con tool calling + dashboard de analítica con exportación de informes ejecutivos + importación de tareas desde CSV. Producto completo, no boilerplate.

## Stack exacto
- **Frontend**: Next.js 16.2.4 App Router + TypeScript strict + React 19
- **Auth + DB**: Supabase (`@supabase/ssr`) con RLS en todas las tablas; 10 migraciones en `supabase/migrations/`
- **Embeddings**: Voyage AI `voyage-3-lite` → 512 dimensiones + reranking con `rerank-2-lite` (`src/lib/ai/voyage.ts`)
- **Chat**: DeepSeek `deepseek-chat` (OpenAI-compatible) con tool calling; alternativas Groq/Ollama vía `CHAT_PROVIDER`; fallback a Claude Haiku 4.5 (`ANTHROPIC_API_KEY`)
- **UI**: Tailwind CSS v4 + shadcn/ui + `@base-ui/react` + @dnd-kit + Geist font (variable font, sin flash de tema)
- **Analítica**: gráficos DIV-based (`recharts` está instalado pero no se importa en ningún componente); `jspdf` para exportar PDF (sin `html2canvas` — incompatible con oklch de Tailwind v4); `buildAnalyticsPDF` carga lazy con `await import(...)`
- **Rate limiting**: Upstash Redis (`@upstash/ratelimit`) — chat 20/min, report 5/min, embed 100/min
- **Email**: Resend para invitaciones de proyecto; graceful degradation si `RESEND_API_KEY` no está
- **Observabilidad**: `@sentry/nextjs` v10 con eventos custom (`task.created`, `task.deleted`, `agent.tool_called`, `chat.completion` via `addBreadcrumb`)
- **Cron**: `/api/cron/insights` protegido por `CRON_SECRET`; programado en `vercel.json` a las 08:00 UTC

## Comandos disponibles
```bash
npm run dev           # dev server
npm run build         # build de producción
npm run lint          # ESLint (0 warnings)
npm run start         # servidor de producción (requiere build previo)
npx tsc --noEmit      # type-check sin compilar

npm test              # Vitest (una sola pasada)
npm run test:watch    # Vitest en modo watch
npm run test:coverage # Vitest con cobertura (umbrales mínimos: 70% lines/functions/branches/statements)
npm run test:e2e      # Playwright (arranca dev server automáticamente)
npm run test:e2e:ui   # Playwright con interfaz visual

npx supabase db push           # aplicar migraciones (requiere CLI linkeado)
npx supabase gen types typescript --local > src/types/database.types.ts

npx dotenv -e .env.local -- npx tsx scripts/seed-embeddings.ts  # backfill embeddings
```

### Tests unitarios (Vitest)
Los tests viven en `src/actions/__tests__/` (tasks), `src/hooks/__tests__/` (use-tasks-by-status), `src/lib/__tests__/` (hmac), `src/lib/ai/__tests__/` (voyage, rag), `src/lib/analytics/__tests__/` (metrics) y `src/lib/validations/__tests__/` (schemas). Usan mocks de Supabase vía `makeChain()`. Setup global en `src/test/setup.ts`. Cobertura mínima configurada al 70% (lines/functions/branches/statements), y solo se mide sobre los 8 archivos del `include` en `vitest.config.ts` (no sobre todo el repo).

Para correr un solo archivo: `npx vitest run src/lib/__tests__/hmac.test.ts`

### Tests E2E (Playwright)
Requieren `.env.local` con `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` reales. El proyecto `setup` ejecuta `e2e/auth.setup.ts` primero, guarda auth en `e2e/.auth/user.json`. Specs autenticadas: `dashboard`, `chat`, `analytics`, `agent`.

Hay un proyecto Playwright `public` para validar login/guards sin sesion real:
```bash
npx playwright test --project=public
```

Si el setup autenticado falla con `Credenciales invalidas` o se queda en `/login`, revisar primero si el proyecto de Supabase esta pausado. En ese caso hay que restaurarlo desde Supabase Dashboard y esperar a que Auth/Database/Realtime queden activos antes de cambiar codigo, usuarios o secrets.

## Flujo de Contexto Activo (URL + localStorage + React)
Las decisiones de proyecto se sincronizaban por localStorage. **Cambio reciente**: ahora todo se rige por `?project_id=` en la URL:
1. `ActiveProjectProvider` (contexts/active-project.tsx) lee URL al montar y al cambiar; sincroniza localStorage para persistencia de sesion
2. Components suscritos via `useActiveProject()` actualizan automáticamente cuando el URL cambia
3. **Auto-selección**: `project-switcher.tsx` selecciona el proyecto más activo en login; `useEffect` en DashboardShell sincroniza cambios de URL
4. **Beneficio**: el URL es source-of-truth, permitiendo compartir links con `?project_id=` y sincronizar multi-tab
5. **Casos clave**:
   - `/board` sin ?project_id= → usa localStorage (última sesión)
   - `/board?project_id=ABC` → fuerza el proyecto ABC
   - `/chat?project_id=ABC` → agente ve el contexto del proyecto
   - `/analytics?project_id=ABC` → reportes del proyecto específico

## Estructura de Carpetas Crítica
**Root + Configuración**:
```
middleware.ts              ← RAÍZ (no en src/); /invite/* es ruta pública sin auth
vercel.json                ← cron /api/cron/insights a las 08:00 UTC
.lighthouserc.js           ← budgets: LCP <2.5s, CLS <0.1, TBT <200ms
public/template-tareas.csv ← plantilla CSV (14 tareas ejemplo)
```

**App Router & Páginas**:
```
src/app/
  (auth)/                ← login, register — sin sidebar; redirige a /board si hay user
  (dashboard)/layout.tsx ← DashboardShell (side + top bar), ActiveProjectProvider
    board/
      page.tsx           ← Server Component; lee URL ?project_id; Suspense<BoardTasks>
      loading.tsx        ← skeleton
    analytics/           ← gráficos + PDF export (lazy buildAnalyticsPDF)
    chat/                ← verifica ownership de session_id; lee ?project_id de URL
  invite/[token]/        ← público; aceptar invitación sin auth
  api/
    chat/, chat/confirm/ ← SSE streaming + confirmación de tools destructivas
    embed/               ← requiere HMAC; usa service_role para upsert embeddings
    report/              ← informe ejecutivo, rate-limited 5/min
    cron/insights/       ← GET protegido por CRON_SECRET header
```

**Server & Client**:
```
src/
  actions/               ← Server Actions: auth, task CRUD, projects, invites, chat, CSV import
  components/
    kanban/              ← board.tsx (empty → CsvImport), task-card, task-drawer, board-actions ("Borrar todo")
    analytics/           ← csv-import.tsx, charts
    chat/                ← chat-interface.tsx (<120 LOC), message-renderer
    layout/              ← dashboard-shell (state isSidebarOpen), sidebar, topbar, project-switcher
    onboarding/          ← 4-step modal, localStorage 'onboarding_done'
  contexts/
    active-project.tsx   ← URL ?project_id= + localStorage + React Context
  hooks/
    use-chat-stream.ts   ← SSE event parser; maneja confirm_required
    use-tasks-by-status.ts ← agrupa tareas por estado; usado por Kanban
    use-realtime-tasks.ts ← Supabase Realtime; auto-refresh
    use-analytics.ts     ← fetch métricas y dashboards
    use-voice-input.ts   ← Web Speech API
    use-chat-tts.ts      ← SpeechSynthesisUtterance (es-CO, rate 1.1)
  lib/
    supabase/            ← client/server factories, getUser()
    ai/
      voyage.ts          ← embeddings + rerank (rerank-2-lite)
      agent.ts           ← SSE loop 2-turn; DeepSeek/Groq/Ollama + Haiku fallback; Sentry events
      rag.ts             ← hybrid: intent + vector → top-20 → rerank-5; buildSystemPrompt()
      tools.ts           ← 6 tools de agent (create/update/move/delete/search)
      chat.ts            ← getChatProvider() (DeepSeek | Groq | Ollama)
    analytics/           ← metrics.ts (burndown, velocity), pdf-builder.ts (jsPDF)
    validations/         ← Zod schemas para tasks + auth
    ratelimit.ts         ← Upstash limits
    hmac.ts              ← signRequest/verifyRequest con SHA-256
    bot-guard.ts         ← isBot, botBlockResponse
    env.ts               ← validación al boot
  types/                 ← app.types.ts, chat-ui.types.ts
```

## Agente: flujo SSE completo
`api/chat/route.ts` → `runAgent()` emite estos eventos — el cliente debe manejar todos:
```ts
{ type: 'token',           content: string }              // fragmento LLM
{ type: 'tool_call',       tool: string, args: object }   // antes de ejecutar
{ type: 'tool_result',     tool: string, result: string } // después de ejecutar
{ type: 'confirm_required', tool: string, args: object, task_title: string|null, confirm_id: string }
{ type: 'sources',         sources: TaskSource[] }        // contexto RAG usado
{ type: 'board_update' }                                  // recargar board
{ type: 'error',           message: string }              // fallo del stream
```

El loop tiene 3 caminos:
1. **Sin tool calls** (turno 1): el LLM responde directamente → stream token → emit sources → cerrar
2. **Con tool calls no destructivas**: ejecutar en paralelo → turno 2 streaming → emit sources + board_update
3. **Con tool destructiva** (`delete_task`): emit `confirm_required` → cerrar; el cliente POST a `/api/chat/confirm`

`DESTRUCTIVE_TOOLS = new Set(['delete_task'])`. Al confirmar, POST a `/api/chat/confirm` con `{ tool, args }`.

## Arquitectura RAG
`searchTasksByQuery` en `rag.ts`:
1. `detectStructuralIntent` — regex status/priority en español e inglés
2. Estrategia dual:
   - Con intención → SQL directo + vector en `Promise.all`, fusión deduplicada
   - Sin intención → solo vector via RPC `search_tasks_by_embedding`
3. Candidatos: top-20 → `rerank(query, docs, 5)` con `rerank-2-lite` → top-5 al LLM
4. Fallback graceful si rerank falla (usa top candidatos sin reranking)
5. Scope: si hay `projectId`, tanto SQL directo como resultados vectoriales se filtran al proyecto activo; sin `projectId`, se usan tareas personales (`project_id IS NULL`).

## Multi-tenancy
- `project_members(project_id, user_id, role)` — roles: owner/editor/viewer
- Funciones SECURITY DEFINER: `is_project_member(uuid)`, `is_project_editor(uuid)` evitan recursión en RLS
- `get_project_member_profiles(project_id)` — solo retorna si el caller es miembro
- Invitaciones: token hex-64, expiran en 7 días, `accept_invitation(token)` hace upsert en `project_members`
- Realtime: canal `project-tasks:{projectId}`; skips cambios propios por `record.user_id === currentUserId`
- Server Actions y tools del agente deben respetar scope: proyectos compartidos se validan por `project_members` owner/editor; tareas personales se filtran por `user_id` + `project_id IS NULL`.

## Funciones SQL críticas
Todas en `supabase/migrations/`, todas `SECURITY DEFINER`:
- `search_tasks_by_embedding(halfvec(512), threshold, count, p_user_id)` — incluye tareas de proyectos compartidos
- `upsert_task_embedding(task_id, user_id, halfvec(512), content_hash)` — solo service_role; skip si hash igual
- `is_project_member(uuid)` / `is_project_editor(uuid)` — helpers para RLS sin recursión
- `get_project_member_profiles(uuid)` — join members + profiles, requiere ser miembro
- `get_invitation_by_token(text)` / `accept_invitation(text)` — gestión de invitaciones

## Reglas de seguridad — nunca romper
1. `SUPABASE_SERVICE_ROLE_KEY` solo en `api/embed` y tests. Jamás en cliente.
2. Toda Server Action valida con Zod `.safeParse()` antes de cualquier query.
3. Queries personales incluyen `.eq('user_id', user.id)` y `.is('project_id', null)`; queries de proyecto compartido validan membresia/rol y filtran por `.eq('project_id', projectId)`.
4. INSERT en `task_embeddings` solo via `upsert_task_embedding()` con service_role.
5. `createClient()` del servidor es async — siempre `await createClient()`.
6. **Cuenta demo/invitado** (`user.email === env.DEMO_EMAIL`) nunca debe poder ejecutar acciones destructivas irreversibles (ej. `deleteAllTasks`). El check va en dos capas: UI (oculta/redirige el botón, ver `board-actions.tsx`) **y** Server Action (rechaza explícitamente aunque se invoque directo, ver `project.actions.ts`). Al agregar una nueva acción destructiva, replicar ambas capas.

## Server vs Client Components
- **Regla general**: páginas son Server Components (`page.tsx`) a menos que necesiten interactividad; luego se dividen
- **board/page.tsx**: Server Component, carga tareas del proyecto con `readTasks()`, wrappea con `Suspense<BoardTasks>` que es dinamically imported (`ssr: false`)
- **chat/page.tsx**: Server Component, valida ownership de `session_id`, carga historial con `getChatMessages()`; `ChatInterface` es `'use client'`
- **analytics/page.tsx**: Server Component, carga métricas; componentes gráficos son `'use client'`; lazy importa `buildAnalyticsPDF` para no bloquer el server
- **Kanban (board.tsx)**: `'use client'` porque necesita drag-drop, optimistic updates, realtime listening; usa `useOptimistic` + `useTransition` para `moveTask`
- **Sidebar + Topbar**: `'use client'` para state (sidebar toggle), tema, project-switcher interactivo

## Convenciones de código
- Server Actions retornan `ActionResult<T>`: `{ success: true, data: T } | { success: false, error: string }`
- Errores Zod: usar `.issues[0]?.message` (no `.errors[0]` — Zod v4 cambió el nombre)
- **Posición de tareas**: espaciado de 1000. Insertar entre dos tareas = `Math.round((prev + next) / 2)`; así rearranges siempre encuentra espacio
- **Embeddings de tareas**: al crear/actualizar, `triggerEmbedding()` hace fire-and-forget con `void fetch(...)` — no bloquea el usuario; el `/api/embed` se ejecuta async
- **Kanban optimista**: `useOptimistic` mantiene UI sync mientras `moveTask` vuela al servidor; si falla, React revierte automáticamente
- **CSV import**: máx 500 filas; batch insert sin embeddings primero, luego embeddings en chunks de 5 paralelos (delay 3s entre chunks) para respetar `/api/embed` (100/min)
- **Fechas inteligentes**: `parseSmartDate()` en `task.schema.ts` maneja DD/MM/YYYY, YYYY-MM-DD, y fechas relativas (mañana, próx. lunes). Siempre retorna ISO string
- **Chat SSE**: el cliente parsea eventos línea por línea; tipos en `chat-ui.types.ts`; confirmar tool destructiva requiere POST a `/api/chat/confirm`

## Onboarding
- **Trigger**: primer acceso después de login → `onboarding-modal.tsx` renderiza modal 4-paso si `localStorage['onboarding_done']` no existe
- **Pasos**: bienvenida → crear proyecto demo (`seedDemoProject`) → importar tareas Olist de template → invitar miembro (mail optional)
- **Persistencia**: al completar, guarda `onboarding_done = true` en localStorage; el modal nunca reaparece en ese navegador
- **Skip**: hay botón "Saltar" en cada paso; completa y guarda el flag igual
- **Demo project**: al aceptar, ejecuta `seedDemoProject()` que crea un proyecto con 14 tareas de ejemplo + embeddings

## Importación CSV
- **Entrada**: tablero vacío → `board.tsx` detecta `optimisticTasks.length === 0` → renderiza `<CsvImport />` en lugar de las 3 columnas Kanban
- **Flujo**: descargar `public/template-tareas.csv` → editar → drag-drop o select file → parser local con preview de 10 filas → click "Importar" → server action `importTasksCSV()` valida con `RowSchema` (Zod permisivo con `.catch()` para enum) → batch insert → embeddings throttleados (chunks de 5 + delay 3s) → `router.refresh()` repobla el Server Component
- **Esquema CSV**: `title` (req, ≤200), `description` (opc, ≤2000), `status` (todo|in_progress|done, def `todo`), `priority` (low|medium|high, def `medium`), `due_date` (YYYY-MM-DD o DD/MM/YYYY; parseSmartDate soporta también DD/MM/YYYY)
- **Project scope**: si `projectId` activo verifica `project_members` rol owner/editor; si no, tareas se crean como personales del user
- **Generar con IA**: botón abre un `Dialog` (no genera directo) con Empresa/Proyecto-Área (prefill desde `projects.company`/`department`) + chips de miembros reales del proyecto (`ProjectMember[]`) + textarea editable con las instrucciones (`DEFAULT_GENERATE_TASKS_PROMPT` en `src/lib/ai/generate-tasks-prompt.ts` — módulo separado porque `import.actions.ts` tiene `'use server'` y solo puede exportar funciones async). El prompt final = bloque de contexto + instrucciones, visible en un `<details>` colapsable antes de confirmar. `generateTasksCSV(customPrompt?)` valida el prompt con Zod (`max 4000`) antes de llamar a DeepSeek

## URL Parameters (Query Strings)
```
?project_id=<uuid>  ← fuerza el proyecto en board, chat, analytics; read-only por defecto
                      si no existe o el user no es miembro, se ignora
?session_id=<uuid>  ← en chat/page, valida que el user sea propietario antes de cargar historial
```

## Variables de entorno requeridas
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
VOYAGE_API_KEY=               # voyage-3-lite (512 dims) + rerank-2-lite
EMBED_INTERNAL_SECRET=        # mínimo 32 chars — openssl rand -hex 32
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHAT_PROVIDER=deepseek        # 'deepseek' | 'groq' | 'ollama'
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Opcionales
GROQ_API_KEY=                 # solo si CHAT_PROVIDER=groq
OLLAMA_BASE_URL=http://localhost:11434  # solo si CHAT_PROVIDER=ollama
OLLAMA_MODEL=llama3.2                  # solo si CHAT_PROVIDER=ollama
RESEND_API_KEY=               # emails de invitación (sin esto, loguea la URL en consola)
ANTHROPIC_API_KEY=            # fallback Claude Haiku 4.5 si DeepSeek/Groq caen
AI_GATEWAY_BASE_URL=          # Vercel AI Gateway; cambia base URL y prefija modelo con 'deepseek/' o 'groq/'
VERCEL_OIDC_TOKEN=            # auto-inyectado por Vercel en producción; habilita autenticación OIDC con AI Gateway
CRON_SECRET=                  # protege /api/cron/insights
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

## Patrones comunes
### Actualizar proyecto desde URL
Cuando el usuario cambia ?project_id= en el URL:
1. `ActiveProjectProvider` detecta cambio en `useEffect`
2. Actualiza contexto → components suscritos con `useActiveProject()` se re-renderizan
3. Server Components NO reciben el contexto directamente; pasan `projectId` como URL param o prop desde cliente
4. **Dashboard server**: `board/page.tsx` lee `?project_id=` de `searchParams` (Next.js 16)
5. **API routes**: leen `?project_id=` de `request.nextUrl.searchParams`

### Confirmar tools destructivas
1. Agent emite `{ type: 'confirm_required', tool, args, confirm_id }`
2. UI renderiza `<ConfirmCard>` que bloqueado hasta confirmación
3. User hace click → POST a `/api/chat/confirm` con `{ tool, args, confirm_id }`
4. Backend ejecuta la tool confirmada; retorna resultado
5. Cliente recibe respuesta normal (tipo `tool_result`)

## Errores comunes y solución
- **Login/E2E con `Credenciales invalidas` aunque el usuario sea correcto**: revisar si el proyecto de Supabase esta pausado. Restaurar en Supabase Dashboard, esperar a que Auth/Database/Realtime estén activos, verificar `.env.local` y correr `npm run test:e2e`.
- **`cookies() should be awaited`**: `cookies()` es async — siempre `await cookies()`. Aplica a `createClient()` del servidor también (es async en Next.js 16).
- **`PGRST200` — relationship not found**: FK faltante (backup antiguo). Verificar con `SELECT conname FROM pg_constraint WHERE conrelid = 'tabla'::regclass AND contype = 'f'`. Agregar el FK y ejecutar `NOTIFY pgrst, 'reload schema'`.
- **`42703` — column does not exist**: columna agregada en migración posterior. Ejemplo: `project_id` en tasks → `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL`.
- **RLS silencioso**: Supabase retorna array vacío (no error) en SELECT bloqueado. Verificar con service_role si la fila existe.
- **Flash de tema**: el `<script dangerouslySetInnerHTML>` está en `<head>` de `app/layout.tsx`. No moverlo a `<body>` — React 19 lanza warning.
- **Hydration mismatch en topbar**: el botón tema tiene `suppressHydrationWarning` porque servidor no sabe el tema del cliente.
- **HMAC rechazado**: las firmas son válidas 5 minutos. Verificar `EMBED_INTERNAL_SECRET` coincida entre firmante y verificador; revisar relojes.
- **Cookies auth perdidas en middleware**: `middleware.ts` DEBE devolver `supabaseResponse` — nunca `NextResponse.next()`.
- **"This page couldn't load" intermitente (típicamente tras inactividad)**: Supabase free-tier se pausa y tarda en despertar; sin timeout, `supabase.auth.getUser()` en `middleware.ts` cuelga la navegación indefinidamente. Mitigado con `Promise.race` (5s) que trata timeout como no-autenticado y redirige a `/login` en vez de colgar. No evita que Supabase se pause — solo evita que el navegador se quede sin respuesta.
- **Ollama no responde**: solo cuando `CHAT_PROVIDER=ollama`. Los embeddings usan Voyage AI, no Ollama; el chat puede caer a Claude Haiku con `ANTHROPIC_API_KEY`.
- **Project no sincroniza entre tabs**: `ActiveProjectProvider` usa `storage` event listener. Si bug, revisar que `useEffect` tenga dependencia `[]` (una sola vez al montar).

## CI/CD y deploy

| Job | Cuándo | Pasos |
|-----|--------|-------|
| `ci` | push a main/feat/**/fix/**/chore/** o PR → main | lint (0 warnings) → tsc → tests+coverage → build → Lighthouse CI |
| `deploy-production` | merge a `main` (CI verde) | vercel pull → vercel build --prod → vercel deploy --prebuilt --prod |

**Secrets requeridos en GitHub**:
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`, `EMBED_INTERNAL_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `LHCI_GITHUB_APP_TOKEN`
