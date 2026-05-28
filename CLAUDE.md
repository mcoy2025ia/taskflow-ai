# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto
SaaS de productividad multi-usuario: tablero Kanban colaborativo + agente RAG con tool calling + dashboard de analítica con exportación de informes ejecutivos + importación de tareas desde CSV. Producto completo, no boilerplate.

## Stack exacto
- **Frontend**: Next.js 16.2.4 App Router + TypeScript strict + React 19
- **Auth + DB**: Supabase (`@supabase/ssr`) con RLS en todas las tablas; 10 migraciones en `supabase/migrations/`
- **Embeddings**: Voyage AI `voyage-3-lite` → 512 dimensiones + reranking con `rerank-2-lite` (`src/lib/ai/voyage.ts`)
- **Chat**: Groq `llama-3.3-70b-versatile` con tool calling; fallback a Claude Haiku 4.5 (`ANTHROPIC_API_KEY`)
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
Los tests viven en `src/actions/__tests__/`, `src/hooks/__tests__/`, `src/lib/__tests__/` y `src/lib/ai/__tests__/`. Usan mocks de Supabase vía `makeChain()`. Setup global en `src/test/setup.ts`. Cobertura mínima configurada al 70% (lines/functions/branches/statements) sobre los archivos listados en `vitest.config.ts`.

Para correr un solo archivo: `npx vitest run src/lib/__tests__/hmac.test.ts`

### Tests E2E (Playwright)
Requieren `.env.local` con `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` reales. El proyecto `setup` ejecuta `e2e/auth.setup.ts` primero, guarda auth en `e2e/.auth/user.json`. Specs: `login`, `dashboard`, `chat`, `analytics`, `agent`.

## Estructura crítica
```
middleware.ts              ← RAÍZ (no en src/); /invite/* es ruta pública sin auth; matcher excluye /api/embed y /api/backfill
vercel.json                ← cron /api/cron/insights a las 08:00 UTC
.lighthouserc.js           ← budgets: LCP <2.5s (error), CLS <0.1 (error), TBT <200ms (warn)
public/
  template-tareas.csv     ← plantilla CSV descargable (14 tareas Olist de ejemplo)
scripts/
  seed-embeddings.ts      ← batch embedding Voyage AI, respeta rate limits (21 req/s)
src/
  app/
    (auth)/               ← login, register — sin sidebar
    (dashboard)/          ← board, chat, analytics — con sidebar + topbar
      layout.tsx          ← DashboardShell + sidebar + topbar
      board/
        page.tsx          ← Server Component; InsightBanner + Suspense<BoardTasks>
        loading.tsx       ← skeleton de carga
      analytics/          ← gráficos + exportación PDF (buildAnalyticsPDF lazy)
      chat/               ← verifica ownership de session_id antes de cargarlo
    invite/[token]/       ← página pública; estados: inválida/expirada/aceptada/sin-auth
    api/
      chat/               ← SSE streaming, runtime: nodejs
      chat/confirm/       ← ejecuta tool destructiva confirmada
      embed/              ← requiere HMAC, usa service_role
      report/             ← informe ejecutivo con Groq, runtime: nodejs
      cron/insights/      ← GET protegido por CRON_SECRET (Authorization header)
  actions/
    auth.actions.ts       ← signIn, signUp, signOut (maneja NEXT_REDIRECT de Next.js)
    task.actions.ts       ← CRUD + assignTask/unassignTask + Sentry breadcrumbs
    project.actions.ts    ← getProjects, createProject, seedDemoProject
    invite.actions.ts     ← inviteToProject, acceptInvitation, sendInviteEmail
    comment.actions.ts    ← addComment, getComments, deleteComment
    chat.actions.ts       ← createChatSession, getChatSessions, getChatMessages, saveMessages
    import.actions.ts     ← importTasksCSV: batch insert + embeddings throttled (5 paralelos / 3s)
  components/
    kanban/
      board-dynamic.tsx   ← dynamic(() => import('./board'), { ssr: false })
      board.tsx           ← KanbanBoard; empty state renderiza CsvImport cuando 0 tareas
      task-card.tsx       ← TaskWithAssignees; abre drawer via context; avatar stack
      task-drawer.tsx     ← panel lateral: comentarios, asignados, metadatos
      member-filter-bar.tsx← chips de filtro por miembro del proyecto
      insight-banner.tsx  ← alerta amber dismissable (tareas vencidas / riesgo velocidad)
      board-actions.tsx   ← "Poblar Olist" + "Borrar todo" (Dialog de confirmación)
    analytics/
      csv-import.tsx      ← parser CSV + preview + drop zone (dark MCOY); router.refresh() tras insertar
    chat/
      chat-interface.tsx  ← UI de chat (<120 líneas, solo presentación)
      message-renderer.tsx← MessageContent (citas [N]), ToolActivityList, ConfirmCard, SourceChips
    layout/
      dashboard-shell.tsx ← 'use client'; estado isSidebarOpen; monta OnboardingModal
      sidebar.tsx         ← navegación + ProjectSwitcher
      topbar.tsx          ← tema toggle (suppressHydrationWarning en el botón)
    onboarding/
      onboarding-modal.tsx← 4 pasos; localStorage 'onboarding_done'; seedDemoProject
  contexts/
    active-project.tsx    ← ActiveProjectProvider; localStorage + URL ?project_id=
  hooks/
    use-chat-stream.ts    ← SSE parser, persist sesión, confirm_required handler
    use-voice-input.ts    ← Web Speech API
    use-chat-tts.ts       ← SpeechSynthesisUtterance es-CO rate 1.1
    use-analytics.ts      ← fetch + cálculos de métricas
    use-realtime-tasks.ts ← Supabase Realtime; skips own changes; toast para otros
  lib/
    supabase/
      client.ts           ← createBrowserClient (solo 'use client')
      server.ts           ← createServerClient con cookies() — nuevo en cada request
      get-user.ts         ← React cache() wrapper
    ai/
      voyage.ts           ← generateEmbedding, generateQueryEmbedding, rerank (rerank-2-lite)
      agent.ts            ← loop tool calling 2 turnos SSE; Groq → Haiku fallback; Sentry events
      rag.ts              ← híbrida: intent + vector → top-20 → rerank → top-5;
                            también exporta buildContextBlock, buildSystemPrompt, getProjectSummary
      tools.ts            ← 6 tools: create_task/update_task/move_task/delete_task/search_tasks/search_comments
      chat.ts             ← getChatProvider() → GroqProvider | OllamaProvider
    analytics/
      metrics.ts          ← funciones puras: calculateBurndown, calculateVelocity, detectRisk
      pdf-builder.ts      ← jsPDF sin html2canvas; importado lazily desde analytics/page.tsx
    validations/
      task.schema.ts      ← CreateTaskSchema, UpdateTaskSchema, MoveTaskSchema (Zod)
      auth.schema.ts      ← esquemas de login/registro
    ratelimit.ts          ← Upstash: chat 20/min, report 5/min, embed 100/min
    hmac.ts               ← signRequest(path, body) incluye SHA-256(body); timingSafeEqual
    bot-guard.ts          ← isBot() chequea x-vercel-is-bot: 1; botBlockResponse() 403
    env.ts                ← validación Zod de process.env al boot
  types/
    app.types.ts          ← Task, TaskWithAssignees, KanbanColumn, ProjectMember, ChatMessage
    chat-ui.types.ts      ← ChatUIMessage, Source, ToolActivity, PendingConfirm
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

## Multi-tenancy
- `project_members(project_id, user_id, role)` — roles: owner/editor/viewer
- Funciones SECURITY DEFINER: `is_project_member(uuid)`, `is_project_editor(uuid)` evitan recursión en RLS
- `get_project_member_profiles(project_id)` — solo retorna si el caller es miembro
- Invitaciones: token hex-64, expiran en 7 días, `accept_invitation(token)` hace upsert en `project_members`
- Realtime: canal `project-tasks:{projectId}`; skips cambios propios por `record.user_id === currentUserId`

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
3. Queries de Supabase siempre incluyen `.eq('user_id', user.id)` además del RLS.
4. INSERT en `task_embeddings` solo via `upsert_task_embedding()` con service_role.
5. `createClient()` del servidor es async — siempre `await createClient()`.

## Convenciones de código
- Server Actions retornan `ActionResult<T>`: `{ success: true, data: T } | { success: false, error: string }`
- Errores Zod: usar `.issues[0]?.message` (no `.errors[0]` — Zod v4 cambió el nombre)
- Posición de tareas: espaciado de 1000. Insertar al medio = `Math.round((prev + next) / 2)`
- `triggerEmbedding` usa fire-and-forget (`void fetch(...)`) — no bloquea al usuario
- `useOptimistic` + `useTransition` en Kanban — si `moveTask` falla, revierte automáticamente
- `importTasksCSV`: máximo 500 filas; batch insert; embeddings en chunks de 5 paralelos con delay de 3s para respetar el rate limit de `/api/embed` (100/min)

## Importación CSV
- **Entrada**: tablero vacío → `board.tsx` detecta `optimisticTasks.length === 0` → renderiza `<CsvImport />` en lugar de las 3 columnas
- **Flujo**: descargar `public/template-tareas.csv` → editar → drop o select → parser local con preview de 10 filas → click "Importar" → server action `importTasksCSV()` valida con `RowSchema` (Zod permisivo con `.catch()` para enum) → batch insert → embeddings throttleados → `router.refresh()` repobla el Server Component del board
- **Esquema CSV**: `title` (req, ≤200), `description` (opc, ≤2000), `status` (todo|in_progress|done, default `todo`), `priority` (low|medium|high, default `medium`), `due_date` (YYYY-MM-DD o DD/MM/YYYY)
- **Project scope**: si hay `projectId` activo verifica `project_members` con rol owner/editor; si no hay proyecto activo, las tareas se crean como personales del user

## Variables de entorno requeridas
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
VOYAGE_API_KEY=               # voyage-3-lite (512 dims) + rerank-2-lite
EMBED_INTERNAL_SECRET=        # mínimo 32 chars — openssl rand -hex 32
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHAT_PROVIDER=groq            # 'groq' | 'ollama'
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Opcionales
OLLAMA_BASE_URL=http://localhost:11434  # solo si CHAT_PROVIDER=ollama
OLLAMA_MODEL=llama3.2                  # solo si CHAT_PROVIDER=ollama
RESEND_API_KEY=               # emails de invitación (sin esto, loguea la URL en consola)
ANTHROPIC_API_KEY=            # fallback Claude Haiku 4.5 si Groq cae
AI_GATEWAY_BASE_URL=          # Vercel AI Gateway; cambia base URL y prefija modelo con 'groq/'
VERCEL_OIDC_TOKEN=            # auto-inyectado por Vercel en producción; habilita autenticación OIDC con AI Gateway
CRON_SECRET=                  # protege /api/cron/insights
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

## Errores comunes y solución
- **`cookies() should be awaited`**: `cookies()` es async — siempre `await cookies()`. Aplica a `createClient()` también.
- **`PGRST200` — relationship not found**: FK faltante en la DB (backup antiguo). Verificar con `SELECT conname FROM pg_constraint WHERE conrelid = 'tabla'::regclass AND contype = 'f'`. Agregar el FK faltante y ejecutar `NOTIFY pgrst, 'reload schema'`.
- **`42703` — column does not exist**: columna agregada en una migración posterior al backup. Ejemplo: `project_id` en tasks → `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL`.
- **RLS silencioso**: Supabase retorna array vacío (no error) en SELECT bloqueado. Verificar con service_role.
- **Flash de tema**: el `<script dangerouslySetInnerHTML>` está en `<head>` de `app/layout.tsx`. No moverlo a `<body>` ni a `useEffect` — React 19 / Next.js 16 lanza warning si está en `<body>`.
- **Hydration mismatch en theme toggle**: el botón en `topbar.tsx` tiene `suppressHydrationWarning` porque el servidor no conoce el tema del cliente.
- **HMAC rechazado**: las firmas tienen ventana de 5 minutos. Verificar que `EMBED_INTERNAL_SECRET` coincida entre firmante y verificador.
- **Cookies de auth perdidas en middleware**: `middleware.ts` debe devolver `supabaseResponse` — nunca `NextResponse.next()`.
- **Ollama no responde**: solo cuando `CHAT_PROVIDER=ollama`. Los embeddings usan Voyage AI, no Ollama.

## CI/CD y deploy

| Job | Cuándo | Pasos |
|-----|--------|-------|
| `ci` | push a main/feat/**/fix/**/chore/** o PR → main | lint (0 warnings) → tsc → tests+coverage → build → Lighthouse CI |
| `deploy-production` | merge a `main` (CI verde) | vercel pull → vercel build --prod → vercel deploy --prebuilt --prod |

**Secrets requeridos en GitHub**:
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `VOYAGE_API_KEY`, `EMBED_INTERNAL_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `LHCI_GITHUB_APP_TOKEN`
