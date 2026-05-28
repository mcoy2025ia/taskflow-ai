# TaskFlow — Roadmap a 10/10

> Estado actual: **9.7/10** · Objetivo: **10/10** · Última actualización: 2026-05-27

## Principios guía

1. **Atacar deuda primero** — la deuda visible (en CLAUDE.md) cuenta como bug.
2. **Convertir RAG en agente real** — el wow factor que mueve la aguja de 7 → 9.
3. **Profesionalizar antes de extender** — tests, observabilidad, headers, rate limit.
4. **Multi-tenant al final** — sólo si el resto está sólido.
5. **Un PR por subtarea** — pequeños, mergeables, revertibles.
6. **Nada de feature creep** — si no está aquí, no se hace en este ciclo.

---

## SPRINT 1 — Cerrar deuda crítica ✅

> Goal: eliminar todo lo que ya está roto o marcado como "debe corregirse".

### 1.1 Corregir dimensiones `halfvec(512)` ✅
- [x] `supabase/migrations/003_embeddings.sql`: `halfvec(1024)` → `halfvec(512)`
- [x] `supabase/migrations/004_rls_policies.sql`: `halfvec(1024)` → `halfvec(512)`
- [x] Eliminar la sección **"Advertencia: mismatch de dimensiones"** del CLAUDE.md
- [ ] `npx supabase db push` sin errores _(pendiente: aplicar vía Dashboard SQL)_
- [ ] Confirmar que `scripts/seed-embeddings.ts` regenera todo sin fallos _(validación manual)_

### 1.2 Eliminar `html2canvas` (bloat ~1MB) ✅
- [x] Quitar de `package.json` deps
- [x] Confirmar que `analytics/page.tsx` no lo importa
- [ ] `npm ci` y verificar bundle size con `next build` _(validación manual)_

### 1.3 HMAC firmando el body ✅
- [x] `src/lib/hmac.ts`: `signRequest(path, body)` incluye `SHA-256(body)`
- [x] `verifyHmacRequest` usa `timingSafeEqual`
- [x] `triggerEmbedding` pasa el body al firmar
- [x] Test unitario: payload modificado → rejectado (`hmac.test.ts`)
- [x] Test unitario: timestamp expirado → rejectado (`hmac.test.ts`)

### 1.4 Rate limiting con Upstash ✅
- [x] `@upstash/ratelimit @upstash/redis` instalados
- [x] `src/lib/ratelimit.ts` con 3 limiters (chat 20/min, report 5/min, embed 100/min)
- [x] Integrado en `/api/chat`, `/api/report`, `/api/embed`
- [x] Headers `X-RateLimit-*` devueltos
- [x] `.env.example` incluye `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`

### 1.5 Headers de seguridad ✅
- [x] `next.config.ts` con CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [ ] Validar con securityheaders.com → A+ _(validación manual en producción)_

### 1.6 Validación de env vars al boot ✅
- [x] `.env.example` completo con todas las vars (incluyendo Sentry, Resend, Anthropic, Cron, LHCI)
- [x] `src/lib/env.ts` con schema Zod
- [x] Usos críticos de `process.env.X!` reemplazados por `env.X`

### 1.7 Mover proyecto a la DB ✅
- [x] Migración `005_projects.sql` — tablas `projects` y `project_phases`
- [x] Backfill y RLS
- [x] `getProjectSummary`, `analytics/page.tsx`, `api/report/route.ts` leen desde DB

---

## SPRINT 2 — Agente con tool calling ✅

> Goal: transformar el RAG read-only en un agente que **actúa** sobre las tareas.

### 2.1 Tool calling con Groq ✅
- [x] `src/lib/ai/tools.ts` — 6 tools con JSON schema + executor (`search_comments` incluido)
- [x] `src/lib/ai/agent.ts` — loop de tool execution con SSE
- [x] `api/chat/route.ts` usa el agente
- [x] UI: indicador visual de tool activity (spinner → ✓)

### 2.2 Confirmación visual para acciones destructivas ✅
- [x] Evento SSE `confirm_required` con `tool`, `args`, `task_title`, `confirm_id`
- [x] `delete_task` interceptado antes de ejecutar — agente emite confirm y retorna
- [x] `ConfirmCard` en `message-renderer.tsx` con "Eliminar / Cancelar"
- [x] Confirmación → POST a `/api/chat/confirm` → ejecuta tool + respuesta de Groq

### 2.3 Memoria conversacional persistente ✅
- [x] Migración `006_chat_sessions.sql` — tablas `chat_sessions` y `chat_messages`
- [x] `chat.actions.ts` — `createChatSession`, `getChatSessions`, `getChatMessages`, `saveMessages`
- [x] `use-chat-stream.ts` — persiste sesión, actualiza URL `?session_id=`, carga historial
- [x] `chat/page.tsx` — verifica ownership del `session_id` antes de cargarlo
- [ ] Sidebar con lista de sesiones recientes _(nice-to-have, no bloqueante)_

### 2.4 Citaciones inline clickeables ✅
- [x] System prompt instruye a citar como `[1]`, `[2]`
- [x] `MessageContent` parsea `[N]` → `<button>` con scroll al source chip
- [x] `SourceChips` con highlight animado al hacer clic en citación

### 2.5 Voyage Rerank ✅
- [x] `voyage.ts` — `rerank(query, candidates)` con modelo `rerank-2-lite`
- [x] `rag.ts` — top-20 → rerank → top-5 al LLM; fallback graceful si rerank falla

### 2.6 TTS en voice mode ✅
- [x] `use-chat-tts.ts` — `SpeechSynthesisUtterance` con voz `es-CO`, rate 1.1
- [x] Botón para detener la lectura en el chat UI

**Acceptance Sprint 2** ✅:
- [x] "Crea una tarea de alta prioridad para revisar el dashboard" → aparece en el board
- [x] Reload de página → historial de chat se mantiene (via `session_id`)
- [x] Voice mode habla la respuesta

---

## SPRINT 3 — Calidad de código y tests ✅

> Goal: pasar de 20% a 70% de cobertura, refactorizar archivos monstruo.

### 3.1 Refactor `chat-interface.tsx` ✅
- [x] `src/hooks/use-chat-stream.ts` — manejo del SSE + persistencia
- [x] `src/hooks/use-voice-input.ts` — Web Speech API
- [x] `src/hooks/use-chat-tts.ts` — TTS
- [x] `chat-interface.tsx` < 120 líneas (111 líneas)

### 3.2 Refactor `analytics/page.tsx` ✅
- [x] `src/hooks/use-analytics.ts` — fetch + cálculos
- [x] `src/lib/analytics/metrics.ts` — funciones puras (`calculateBurndown`, `calculateVelocity`, `detectRisk`)
- [x] `src/lib/analytics/pdf-builder.ts` — generación de PDF con jsPDF
- [x] `analytics/page.tsx` < 130 líneas (solo composición)

### 3.3 Tests unitarios — meta 70% ✅ (82% statements, 73% branches)
- [x] `src/lib/ai/__tests__/rag.test.ts` — buildContextBlock, buildSystemPrompt, searchTasksByQuery, rerank fallback
- [x] `src/lib/ai/__tests__/voyage.test.ts` — mock fetch, embedding, rerank
- [x] `src/lib/__tests__/hmac.test.ts` — sign/verify, tampering, timestamp expirado (12 tests)
- [x] `src/actions/__tests__/tasks.test.ts` — createTask, moveTask, updateTask, deleteTask
- [x] `src/hooks/__tests__/use-tasks-by-status.test.ts` — filtrado, orden, memoización
- [x] `src/lib/validations/__tests__/schemas.test.ts`
- [x] Cobertura total: **82% statements / 73% branches / 86% lines** (supera meta de 70%)

### 3.4 E2E con Playwright ✅
- [x] `e2e/auth.setup.ts` — setup de autenticación compartido
- [x] `e2e/login.spec.ts` — flujo de login
- [x] `e2e/dashboard.spec.ts` — tablero Kanban (columnas, crear tarea, diálogo)
- [x] `e2e/chat.spec.ts` — asistente RAG, streaming, session_id en URL
- [x] `e2e/analytics.spec.ts` — dashboard de analítica
- [x] `e2e/agent.spec.ts` — tool calling: crear tarea via chat, confirmación de eliminación

### 3.5 Observabilidad (Sentry) ✅
- [x] `@sentry/nextjs` v10 instalado y configurado (`sentry.client/server/edge.config.ts`)
- [x] `global-error.tsx` captura errores de React
- [x] Eventos custom: `task.created`, `task.deleted`, `agent.tool_called`, `chat.completion`
- [ ] Logger estructurado con `pino` _(no prioritario — Sentry ya cubre observabilidad)_
- [ ] Dashboard de latencia en Sentry _(requiere tráfico real en producción)_

**Acceptance Sprint 3** ✅:
- [x] `npm run test:coverage` — 82% statements, 73% branches
- [x] E2E specs cubren las 5 rutas críticas (auth, board, chat, analytics, agent)
- [x] Sentry recibe eventos custom (`addBreadcrumb` en task y agent)

---

## SPRINT 4 — Multi-tenancy y colaboración ✅

> Goal: convertir TaskFlow de "single user app" a "SaaS de equipos".

### 4.1 Schema colaborativo ✅
- [x] `007_collaboration.sql` — `project_members`, `task_assignments`, `comments`, `activity_log`
- [x] Funciones SECURITY DEFINER: `is_project_member()`, `is_project_editor()`
- [x] RLS extendido en `tasks`, `projects`, `project_phases`
- [x] `search_tasks_by_embedding` actualizada para proyectos compartidos
- [x] Backfill: todos los owners existentes insertados en `project_members`
- [ ] Aplicar migración al remoto _(pendiente: `npx supabase db push` o Dashboard SQL)_

### 4.2 Selector de proyecto ✅
- [x] `<ProjectSwitcher />` en sidebar
- [x] `ActiveProjectProvider` — persiste en `localStorage` + URL `?project_id=`
- [x] `getProjects()` — fusiona proyectos propios + membresías con rol

### 4.3 Invitaciones por email ✅
- [x] `008_invitations.sql` — `pending_invitations` + `get_invitation_by_token()` + `accept_invitation()`
- [x] `inviteToProject()` — genera token hex-64, inserta, envía email via Resend
- [x] `src/app/invite/[token]/page.tsx` — estados: inválida, expirada, ya aceptada, sin auth, con email diferente
- [x] `/invite/*` excluido del middleware de auth

### 4.4 Asignación de tareas ✅
- [x] Avatar stack en `TaskCard` (hasta 3 avatares + overflow)
- [x] Dropdown de asignación en `TaskCard` con toggle optimista
- [x] `MemberFilterBar` — filtro "Todos" / por miembro
- [x] `TaskDrawer` — comentarios, asignados, prioridad, estado

### 4.5 Realtime sync ✅
- [x] `010_realtime.sql` — `tasks` y `task_assignments` en `supabase_realtime`
- [x] `use-realtime-tasks.ts` — canal Supabase Realtime, toast para cambios de otros usuarios
- [x] Omite propios cambios (`record.user_id === currentUserId`)

### 4.6 Comentarios y actividad ✅
- [x] `comment.actions.ts` — `addComment`, `getComments`, `deleteComment`
- [x] `TaskDrawer` — thread de comentarios con autor, timestamp, delete propio
- [x] `search_comments` tool en el agente

**Acceptance Sprint 4** — pendiente validación con datos reales (requiere migraciones aplicadas):
- [ ] 2 usuarios en navegadores distintos ven cambios en <2s _(requiere 007+010 en remoto)_
- [ ] Invitación por email funciona end-to-end _(requiere 008 en remoto + RESEND_API_KEY)_
- [ ] RLS bloquea acceso cross-user _(requiere 007 en remoto)_

---

## SPRINT 5 — Polish y producción ✅

> Goal: detalles que separan un MVP funcional de un producto pulido.

### 5.1 Vercel AI Gateway ✅
- [x] `agent.ts` usa `AI_GATEWAY_BASE_URL` como proxy opcional para Groq
- [x] Fallback: Groq falla → Claude Haiku 4.5 (`callClaudeHaikuStream` + `pipeAnthropicStream`)
- [x] `groqHeaders()` soporta `VERCEL_OIDC_TOKEN` para auth del gateway

### 5.2 Vercel BotID ✅
- [x] `src/lib/bot-guard.ts` — `isBot()` chequea `x-vercel-is-bot: 1`
- [x] Integrado en `/api/chat` y `/api/report` — 403 para bots

### 5.3 Node 24 LTS ✅
- [x] `ci-cd.yml` — `node-version: 24` en todos los jobs
- [x] `package.json` — `"engines": { "node": ">=24" }`

### 5.4 Performance budgets ✅
- [x] `next/font` con Geist (variable font, `display: swap`, `preload`)
- [x] `buildAnalyticsPDF` (jsPDF ~150KB) carga lazy con `await import(...)` dentro de `handleExportPDF`
- [x] `.lighthouserc.js` — LCP <2.5s (error), CLS <0.1 (error), TBT <200ms (warn)
- [x] Lighthouse CI en `.github/workflows/ci-cd.yml`

### 5.5 Onboarding interactivo ✅
- [x] `<OnboardingModal>` — 4 pasos (Welcome → Board → Chat → Analytics), localStorage flag
- [x] `seedDemoProject()` — crea proyecto demo con 10 tareas spread en todos los estados
- [x] Montado en `DashboardShell`

### 5.6 Sugerencias proactivas ✅
- [x] `/api/cron/insights` — protegido por `CRON_SECRET`, evalúa tareas vencidas por proyecto
- [x] `<InsightBanner>` — alerta amber dismissable en board cuando hay vencidas o riesgo de velocidad
- [x] `vercel.json` — cron diario a las 08:00 UTC

**Acceptance Sprint 5**:
- [ ] PageSpeed Insights: ≥90 _(validación manual en producción)_
- [ ] Vercel AI Gateway mostrando tráfico _(requiere `AI_GATEWAY_BASE_URL` configurada)_
- [x] Nuevo user pasa el tour y crea su primera tarea sin instrucción externa

---

## SPRINT 6 — Importación CSV y empty state premium ✅

> Goal: que un equipo nuevo pueda poblar su backlog en segundos sin teclear tarea por tarea, y que el tablero vacío deje de ser una pantalla muerta.

### 6.1 Server action de importación ✅
- [x] `src/actions/import.actions.ts` — `importTasksCSV(projectId, rawRows)`
- [x] `RowSchema` Zod permisivo: `.catch('todo')` y `.catch('medium')` para que valores raros aterricen en defaults sin abortar
- [x] Acepta fechas `YYYY-MM-DD` y `DD/MM/YYYY`
- [x] Membership check: si hay `projectId`, valida rol `owner` o `editor` antes de insertar
- [x] Batch insert (`.insert(payload).select(...)`) — una sola query para todas las filas válidas
- [x] Hard limit: 500 filas por importación

### 6.2 Embeddings throttleados ✅
- [x] Loop reemplazado por batches de 5 paralelos con `Promise.allSettled`
- [x] Delay de 3s entre batches → ratio sostenido ≈ 100 req/min (justo bajo el rate limit del endpoint)
- [x] Fire-and-forget intacto: la response al usuario llega sin esperar

### 6.3 UI del importador ✅
- [x] `src/components/analytics/csv-import.tsx` — diseño dark MCOY (DM Sans, gradientes azules)
- [x] Tabla con la estructura esperada (campo, tipo, ejemplo, notas, opcional/requerido)
- [x] Plantilla descargable embebida en el componente + servida en `public/template-tareas.csv`
- [x] Drop zone con drag & drop + file picker
- [x] Parser CSV in-browser que soporta BOM, `\r\n` y campos quoted con comas
- [x] Preview de las primeras 10 filas con badges de status/priority
- [x] Estado machine: `idle → parsed → importing → done | error`
- [x] `router.refresh()` al completar inserción → Server Component del board carga las nuevas tareas

### 6.4 Empty state del tablero ✅
- [x] `board.tsx` detecta `optimisticTasks.length === 0` y renderiza `<CsvImport />` en lugar de las 3 columnas vacías
- [x] `MemberFilterBar` queda oculto en empty state (no aplica sin tareas)
- [x] Tras importar → router.refresh → empty state desaparece automáticamente

**Acceptance Sprint 6** ✅:
- [x] Borrar todo + subir el template descargado pobla el tablero en < 2s percibidos
- [x] Importar 500 filas no rompe el rate limit de Voyage (visible en logs)
- [x] CSV inválido (sin columna `title`) muestra error claro y NO llama al server action

---

## Métricas de éxito — estado actual

| Métrica | Antes | Objetivo | Actual |
|---------|-------|----------|--------|
| Cobertura tests (statements) | 20% | ≥70% | **82%** ✅ |
| Cobertura tests (branches) | 20% | ≥70% | **73%** ✅ |
| E2E specs | 1/5 | 5/5 | **6/6** ✅ |
| Tools del agente | 0 | 5 | **6** ✅ |
| Multi-user | no | sí | **sí** (pendiente migraciones en remoto) |
| Headers de seguridad | F | A+ | configurados (validar en prod) |
| Observabilidad | console.log | Sentry | **Sentry + eventos custom** ✅ |
| Deuda visible en CLAUDE.md | 3 items | 0 | **0** ✅ |
| LCP budget configurado | no | sí | **sí** (.lighthouserc.js) ✅ |
| Onboarding | no | sí | **sí** ✅ |
| Importación bulk de tareas | no | sí | **sí** (CSV con throttling) ✅ |

---

## Pendientes finales (solo requieren tu acción)

### Aplicar migraciones al remoto de Supabase
```
Orden: 006 → 007 → 008 → 009 → 010
Método: Supabase Dashboard → SQL Editor → pegar y ejecutar cada archivo
```
Esto activa: memoria del chat, colaboración multi-user, invitaciones, realtime sync.

### Variables de entorno a configurar en Vercel / GitHub Secrets
```
CRON_SECRET          → openssl rand -hex 32
ANTHROPIC_API_KEY    → opcional (fallback Haiku)
RESEND_API_KEY       → opcional (emails de invitación)
AI_GATEWAY_BASE_URL  → opcional (Vercel AI Gateway)
LHCI_GITHUB_APP_TOKEN→ para que Lighthouse CI comente en PRs
```

### Validaciones manuales en producción
- securityheaders.com → esperado A+
- PageSpeed Insights → esperado ≥90 mobile y desktop

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Migraciones rompen data de prod | Alta | Ejecutar en orden, todas usan `create if not exists` y `on conflict do nothing` |
| Tool calling genera acciones no deseadas | Resuelta | ConfirmCard en delete_task — validado en e2e/agent.spec.ts |
| Rate limiting afecta UX legítima | Baja | Thresholds generosos + headers informativos |
| Sentry agrega latencia al chat | Baja | `addBreadcrumb` es síncrono en memoria — no hace fetch |

---

## Qué NO está en este roadmap

- Mobile app nativa (la web ya es responsive)
- Notificaciones push
- Integraciones Slack/GitHub/Linear
- Pricing / Stripe / billing
- Webhooks públicos para terceros
- Internationalization (i18n) — el target es es-CO

---

## Backlog post-10

- [ ] Sidebar con lista de sesiones de chat recientes + botón "Nueva conversación"
- [ ] Logger estructurado con `pino` para logs de Vercel
- [ ] Dashboard de latencia Voyage/Groq en Sentry
- [ ] Activity feed en sidebar del proyecto (últimos 20 eventos)
- [ ] A/B test de calidad de respuestas pre/post Voyage Rerank
