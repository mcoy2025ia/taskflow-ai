# TaskFlow v3 — Documentación técnica completa

---

## 1. Qué es TaskFlow

TaskFlow v3 es un SaaS de productividad colaborativa que combina cuatro módulos en una sola aplicación web:

1. **Tablero Kanban colaborativo** — gestión visual de tareas con drag & drop, asignación de miembros, comentarios y sincronización en tiempo real entre múltiples usuarios.
2. **Agente de IA con RAG y tool calling** — asistente conversacional que no solo responde preguntas sobre las tareas sino que las crea, mueve, actualiza y elimina directamente desde el chat, usando recuperación semántica para entender el contexto del proyecto.
3. **Dashboard de analítica con exportación de PDF** — métricas de velocidad, burndown chart, progreso por fases del proyecto e informe ejecutivo generado por IA.
4. **Importación bulk de tareas desde CSV** — cuando el tablero está vacío (cuenta nueva o tras "Borrar todo"), se muestra un importador con plantilla descargable, parser local con preview, validación permisiva y embeddings throttleados en background.

El producto está orientado a equipos de desarrollo de software que trabajan sobre proyectos con fases definidas y fechas de entrega.

---

## 2. Stack tecnológico

| Capa | Tecnología | Rol |
|---|---|---|
| Framework | Next.js 16.2.4 (App Router) | SSR, Server Actions, SSE streaming, API routes |
| Lenguaje | TypeScript strict | Tipado completo incluyendo DB types |
| Runtime | Node.js 24 LTS | Todos los API routes usan `runtime: 'nodejs'` |
| UI | Base UI + Tailwind CSS v4 | Componentes accesibles sin clases de Radix |
| Fuente | Geist (variable font) | Cargada con `next/font`, sin FOUC |
| Base de datos | Supabase (PostgreSQL) | Auth, DB, Realtime, Storage |
| Cliente Supabase | `@supabase/ssr` | Cookies-based auth, SSR-compatible |
| LLM principal | Groq `llama-3.3-70b-versatile` | Tool calling + streaming en chat y report |
| LLM fallback | Claude Haiku 4.5 | Se activa si Groq falla |
| Embeddings | Voyage AI `voyage-3-lite` (512 dims) | Generados en `/api/embed` |
| Reranking | Voyage AI `rerank-2-lite` | Post-retrieval, top-20 → top-5 |
| Rate limiting | Upstash Redis | Chat 20/min, report 5/min, embed 100/min |
| Email | Resend | Invitaciones de proyecto |
| Observabilidad | Sentry v10 | Errores + eventos custom |
| CI/CD | GitHub Actions + Vercel CLI | Lint → tsc → test → build → deploy |
| Tests unitarios | Vitest + jsdom | 82% statements, 73% branches |
| Tests E2E | Playwright | 6 specs: auth, board, chat, analytics, agent |
| PDF | jsPDF (sin html2canvas) | Compatible con Tailwind v4 + oklch colors |

---

## 3. Arquitectura general

### Rutas de la aplicación

```
/                      → redirige a /board (auth requerida)
/(auth)/login          → formulario de login
/(auth)/register       → formulario de registro
/(dashboard)/board     → tablero Kanban
/(dashboard)/chat      → asistente IA
/(dashboard)/analytics → métricas y PDF
/invite/[token]        → aceptar invitación (pública, sin auth obligatoria)
```

Las rutas bajo `(dashboard)` comparten un layout con sidebar y topbar. El layout es un **Server Component** que verifica la sesión y pasa los datos del perfil al `DashboardShell` (client component que gestiona el estado del sidebar).

Las rutas bajo `(auth)` no tienen sidebar.

`/invite/[token]` está fuera de ambos grupos y es la única ruta pública. El middleware la excluye del chequeo de autenticación.

### API Routes

```
POST /api/chat          → recibe mensaje, hace RAG, inicia stream SSE del agente
POST /api/chat/confirm  → ejecuta una tool destructiva ya confirmada
POST /api/report        → genera narrativa del informe ejecutivo con Groq
POST /api/embed         → genera y guarda embedding de una tarea (requiere HMAC)
GET  /api/cron/insights → evalúa tareas vencidas por proyecto (requiere CRON_SECRET)
```

### Middleware

`middleware.ts` (en la raíz del proyecto, no dentro de `src/`) intercepta todas las peticiones excepto las rutas en el `matcher`:
- Excluye: `/_next/*`, `/api/embed`, `/api/backfill`, `/invite/*`
- Para el resto: verifica la sesión de Supabase y actualiza las cookies. Si no hay sesión, redirige a `/login`.

---

## 4. Autenticación y seguridad

### Auth flow

Supabase Auth maneja registro, login y tokens JWT. El cliente SSR de Supabase (`@supabase/ssr`) lee y escribe las cookies de sesión en cada request.

- `createClient()` (server): crea un cliente con las cookies de la request actual. Es async y debe ser `await`-eado.
- `createClient()` (browser): usa `createBrowserClient` de Supabase. Solo en componentes `'use client'`.
- `getAuthUser()`: wrapper con `React.cache()` para deduplicar el llamado dentro del mismo request (el layout y la page llaman `getAuthUser()` pero solo hay un fetch a Supabase).

### Row Level Security (RLS)

Todas las tablas tienen RLS activo. Las políticas están en `supabase/migrations/004_rls_policies.sql` y extendidas en migraciones posteriores. El patrón general:

- `SELECT`: solo filas donde `user_id = auth.uid()` o donde el usuario es miembro del proyecto al que pertenece la tarea.
- `INSERT/UPDATE/DELETE`: solo si `user_id = auth.uid()` y la operación es coherente con el rol del usuario en el proyecto.

Para evitar recursión infinita en las políticas (cuando RLS de `tasks` necesita consultar `project_members` que también tiene RLS), se usan funciones `SECURITY DEFINER`:
- `is_project_member(p_project_id uuid)`: retorna `true` si `auth.uid()` tiene fila en `project_members`
- `is_project_editor(p_project_id uuid)`: retorna `true` si el rol es `owner` o `editor`

### HMAC para la API de embeddings

El endpoint `/api/embed` es llamado desde Server Actions via fire-and-forget. Para autenticarlo sin exponer el service_role key al exterior, se firma cada petición con HMAC-SHA256:

```
signature = HMAC-SHA256(key=EMBED_INTERNAL_SECRET, msg="POST:/api/embed:" + timestamp + ":" + SHA256(body))
```

El verificador comprueba:
1. La firma coincide (usando `timingSafeEqual` para evitar timing attacks)
2. El timestamp no es mayor a 5 minutos (ventana anti-replay)

### Reglas de seguridad fijas

1. `SUPABASE_SERVICE_ROLE_KEY` solo en `/api/embed` y tests. Jamás en componentes de cliente.
2. Toda Server Action valida con Zod `.safeParse()` antes de cualquier query.
3. Queries de Supabase siempre incluyen `.eq('user_id', user.id)` además del RLS (doble barrera).
4. INSERT en `task_embeddings` solo via la función SQL `upsert_task_embedding()` con service_role.
5. Bot guard: `/api/chat` y `/api/report` retornan 403 si el header `x-vercel-is-bot: 1` está presente.

---

## 5. Modelo de datos (12 tablas)

### Usuarios y perfiles

```sql
-- Gestionado por Supabase Auth internamente
auth.users (id, email, ...)

-- Perfil público del usuario
profiles (
  id          uuid PK → auth.users.id
  full_name   text
  avatar_url  text?
  created_at  timestamptz
)
```

Un trigger de Supabase crea la fila de `profiles` automáticamente al registrarse.

### Proyectos

```sql
projects (
  id            uuid PK
  user_id       uuid → auth.users
  name          text
  start_date    date
  delivery_date date
  created_at    timestamptz
)

project_phases (
  id         uuid PK
  project_id uuid → projects
  name       text          -- ej. "Análisis", "Desarrollo", "QA"
  total      int default 0
  done       int default 0
  color      text          -- color hex para el gráfico
  sort_order int default 0
)

project_members (
  project_id uuid → projects
  user_id    uuid → auth.users
  role       enum('owner','editor','viewer')
  joined_at  timestamptz
  PK (project_id, user_id)
)
```

### Tareas

```sql
tasks (
  id          uuid PK
  user_id     uuid → auth.users  -- propietario original
  project_id  uuid? → projects
  title       text (max 200)
  description text?
  status      enum('todo','in_progress','done')
  priority    enum('low','medium','high')
  position    int   -- espaciado de 1000; insert al medio = round((prev+next)/2)
  due_date    timestamptz?
  created_at  timestamptz
  updated_at  timestamptz
)

task_assignments (
  task_id     uuid → tasks
  user_id     uuid → auth.users
  assigned_at timestamptz
  PK (task_id, user_id)
)
```

### Embeddings

```sql
task_embeddings (
  id           uuid PK
  task_id      uuid → tasks (unique)
  user_id      uuid → auth.users
  embedding    halfvec(512)  -- vector de Voyage AI
  content_hash text          -- SHA256 del título+descripción; skip si no cambió
  created_at   timestamptz
)
```

### Colaboración

```sql
comments (
  id         uuid PK
  task_id    uuid → tasks
  user_id    uuid → auth.users
  content    text
  created_at timestamptz
)

activity_log (
  id         uuid PK
  project_id uuid → projects
  user_id    uuid → auth.users
  action     text
  payload    jsonb?
  created_at timestamptz
)

pending_invitations (
  id          uuid PK
  project_id  uuid → projects
  invited_by  uuid → auth.users
  email       text
  role        enum('editor','viewer')
  token       text unique  -- hex-64
  expires_at  timestamptz  -- now() + 7 días
  accepted_at timestamptz?
  created_at  timestamptz
)
```

### Chat

```sql
chat_sessions (
  id         uuid PK
  user_id    uuid → auth.users
  title      text  -- auto-generado del primer mensaje
  created_at timestamptz
  updated_at timestamptz
)

chat_messages (
  id         uuid PK
  session_id uuid → chat_sessions
  user_id    uuid → auth.users
  role       enum('user','assistant')
  content    text
  created_at timestamptz
)
```

### Funciones SQL críticas (`SECURITY DEFINER`)

| Función | Qué hace |
|---|---|
| `search_tasks_by_embedding(halfvec, threshold, count)` | Búsqueda vectorial por similitud coseno; incluye tareas de proyectos compartidos |
| `upsert_task_embedding(task_id, user_id, halfvec, hash)` | Inserta o actualiza embedding; skip si el hash no cambió; solo service_role |
| `is_project_member(project_id)` | Retorna bool; usada en RLS de tasks/comments para evitar recursión |
| `is_project_editor(project_id)` | Retorna bool; rol owner o editor |
| `get_project_member_profiles(project_id)` | Join de members + profiles; retorna solo si el caller es miembro |
| `get_invitation_by_token(token)` | Devuelve datos de la invitación incluyendo nombre del proyecto |
| `accept_invitation(token)` | Hace upsert en project_members y setea accepted_at; retorna el project_id |

---

## 6. Tablero Kanban

### Arquitectura de componentes

```
board/page.tsx (Server Component)
  └── InsightBanner        ← alerta amber si hay tareas vencidas o riesgo de velocidad
  └── Suspense
        └── BoardTasks (Server Component)
              └── board-dynamic.tsx → dynamic(() => import('./board'), { ssr: false })
                    └── board.tsx (KanbanBoard, 'use client')
                          ├── MemberFilterBar    ← chips de filtro por miembro
                          ├── Column × 3         ← Todo / En Progreso / Completado
                          │     └── SortableTaskCard × N
                          │           └── TaskCard
                          └── TaskDrawer         ← panel lateral deslizable
```

El `dynamic()` con `{ ssr: false }` es necesario porque `@dnd-kit` usa APIs del DOM que no existen en el servidor.

### Drag & Drop

Usa `@dnd-kit/core` y `@dnd-kit/sortable`. El flujo al soltar una tarjeta:

1. `onDragEnd` calcula la nueva posición: `Math.round((posicionAnterior + posicionSiguiente) / 2)`
2. Actualiza el estado local con `useOptimistic` (cambio visible de inmediato)
3. Lanza `moveTask(taskId, newStatus, newPosition)` en un `useTransition`
4. Si la Server Action falla, `useOptimistic` revierte automáticamente al estado anterior

El espaciado de 1000 entre posiciones permite hasta ~10 inserciones al medio antes de necesitar rebalancear (no implementado, pero el espacio existe).

### Posición de nuevas tareas

Cuando se crea una tarea, se calcula la posición máxima de la columna destino y se suma 1000:
```
position = max(position en esa columna) + 1000
```
Si la columna está vacía, `position = 1000`.

### useOptimistic + useTransition

El hook `useOptimistic` de React 19 permite mostrar el estado final antes de que la petición termine. Si la petición falla, el estado vuelve al original automáticamente. `useTransition` marca la actualización como no urgente para que React no bloquee el render.

### Sincronización Realtime

`use-realtime-tasks.ts` suscribe al canal `project-tasks:{projectId}` de Supabase Realtime. Cuando recibe un evento de INSERT/UPDATE/DELETE:
- Si `record.user_id === currentUserId`: descarta el evento (el cambio ya está en el estado local)
- Si es de otro usuario: muestra un toast con el nombre del usuario y recarga las tareas

### InsightBanner

Se calcula en el Server Component al cargar `/board`. Muestra un banner amber si:
- Hay tareas vencidas (due_date pasada y status ≠ done), o
- La velocidad actual es menor que la velocidad requerida para llegar a la fecha de entrega

El usuario puede cerrarlo con la X (estado guardado solo en el cliente, se vuelve a mostrar al recargar).

### Task Drawer

Panel lateral que se abre al hacer click en una tarjeta. Muestra:
- Título y descripción (editables inline)
- Badge de status y prioridad
- Fecha límite formateada en es-CO
- Lista de miembros del proyecto con toggle de asignación (avatar stack en la tarjeta)
- Thread de comentarios con author, timestamp y botón de eliminar (solo propios)

Los comentarios se cargan al abrir el drawer y se actualizan optimísticamente al agregar/eliminar.

---

## 7. Agente de IA

### Pipeline completo de un mensaje de chat

```
Usuario escribe mensaje
        ↓
POST /api/chat
        ↓
[1] Bot guard — si x-vercel-is-bot: 1 → 403
[2] Auth — si no hay sesión → 401
[3] Rate limit — 20/min por usuario (Upstash Redis)
        ↓
[4] RAG en paralelo:
    ├── searchTasksByQuery(mensaje) → top-5 tareas relevantes
    └── getProjectSummary(userId)   → métricas del proyecto
        ↓
[5] buildContextBlock → texto con las tareas [1], [2]... para el prompt
[6] buildSystemPrompt → system prompt con el contexto + resumen del proyecto
        ↓
[7] runAgent() → ReadableStream SSE
        ↓
Response con headers: Content-Type: text/event-stream
```

### Loop del agente (2 turnos)

**Turno 1 — detección de tool calls (sin streaming):**

```
callLLM(messages, stream=false)
    ↓
Si finish_reason === 'tool_calls':
    ├── Si es tool destructiva (delete_task):
    │     → emite evento { type: 'confirm_required', ... }
    │     → retorna (no ejecuta nada todavía)
    │
    └── Si no es destructiva:
          → ejecuta todas las tools en paralelo
          → emite { type: 'tool_call', tool, args } antes de cada una
          → emite { type: 'tool_result', tool, result } después de cada una
          → agrega resultados al historial de mensajes

Si finish_reason === 'stop' (sin tools):
    → emite tokens directamente → retorna
```

**Turno 2 — respuesta final (con streaming):**

```
callLLM(messages + tool_results, stream=true)
    ↓
Lee el stream SSE de Groq/Ollama chunk por chunk
    ↓
Por cada token: emite { type: 'token', content: '...' }
    ↓
Al finalizar: emite { type: 'sources', sources: [...] }
              emite { type: 'board_update' } si hubo tools
```

### Proveedores LLM intercambiables

El agente detecta el proveedor al arrancar:
```typescript
const PROVIDER  = process.env.CHAT_PROVIDER ?? 'groq'  // 'groq' | 'ollama'
const IS_OLLAMA = PROVIDER === 'ollama'

const LLM_BASE = IS_OLLAMA
  ? `${OLLAMA_BASE_URL}/v1`
  : (AI_GATEWAY_BASE_URL ?? 'https://api.groq.com/openai/v1')
```

Tanto Groq como Ollama exponen la misma API compatible con OpenAI (`/v1/chat/completions`), por lo que el mismo `callLLM()` sirve para ambos. La diferencia está en los headers de autenticación.

**Vercel AI Gateway**: si `AI_GATEWAY_BASE_URL` está configurado, todas las peticiones van a ese proxy (que agrega observabilidad, zero data retention y model fallbacks). El modelo lleva el prefijo `groq/`.

**Fallback a Claude Haiku 4.5**: si `callLLM()` lanza una excepción en el turno 2 (Groq/Ollama no disponible), se intenta `callClaudeHaikuStream()` que usa la API nativa de Anthropic. El formato del stream es distinto (eventos `content_block_delta` en lugar de `choices[0].delta`), por lo que hay un parser separado `pipeAnthropicStream()`.

### Confirmación de acciones destructivas

`DESTRUCTIVE_TOOLS = ['delete_task']`

Cuando el LLM decide llamar `delete_task`, el agente intercepta antes de ejecutar:
1. Busca el título de la tarea en la DB (para mostrarlo al usuario)
2. Emite `{ type: 'confirm_required', tool, args, task_title, confirm_id }`
3. El stream termina sin ejecutar nada

El cliente muestra un `ConfirmCard` con el nombre de la tarea y dos botones. Si el usuario confirma, hace `POST /api/chat/confirm` con `{ tool, args }`. Ese endpoint ejecuta la tool directamente con el service role y retorna una confirmación en texto.

### Las 6 tools del agente

| Tool | Qué hace | Parámetros requeridos |
|---|---|---|
| `create_task` | Inserta nueva tarea al final de la columna | `title` |
| `update_task` | Modifica título, descripción, prioridad o fecha límite | `task_id` |
| `move_task` | Cambia el status de la tarea (mueve entre columnas) | `task_id`, `status` |
| `delete_task` | Elimina la tarea (requiere confirmación previa) | `task_id` |
| `search_tasks` | Busca tareas por texto, status o prioridad | `query` |
| `search_comments` | Busca en el contenido de comentarios de las tareas | `query` |

---

## 8. RAG (Retrieval Augmented Generation)

### Por qué RAG

El LLM no tiene acceso directo a la DB. Para que el agente pueda responder "¿cuántas tareas de alta prioridad tengo?" o "¿qué falta para el deploy?", necesita que el contexto relevante esté en el prompt. RAG se encarga de recuperar ese contexto de forma eficiente.

### Pipeline de retrieval

```
query del usuario
        ↓
[1] detectStructuralIntent(query)
    → regex en español e inglés para detectar status/priority
    → ej. "tareas completadas" → { status: 'done' }
    → ej. "urgentes" → { priority: 'high' }
        ↓
[2] Si hay intención estructural:
    ├── searchTasksByFilter(intent)  → SQL directo, similarity=1.0
    └── searchTasksBySemantic(query) → vector search
    → mergeResults: estructurales primero, luego semánticos únicos
    (máx. 20 candidatos)

    Si no hay intención estructural:
    └── searchTasksBySemantic(query) → solo vector search
    (máx. 20 candidatos)
        ↓
[3] Si candidatos > 5:
    rerank(query, docs) → Voyage rerank-2-lite → top-5 ordenados por relevancia
    (si rerank falla → top-5 por posición, sin crash)
        ↓
[4] buildContextBlock(top-5)
    → texto numerado [1]...[5] con título, status, prioridad, descripción
        ↓
[5] buildSystemPrompt(context, voiceMode, projectSummary)
    → prompt completo para el LLM
```

### Cómo se generan los embeddings

Cuando una tarea es creada o actualizada, `task.actions.ts` dispara un embedding en background:

```typescript
void triggerEmbedding(taskId, userId, title, description)
```

`triggerEmbedding` hace un `fetch` a `/api/embed` con el cuerpo firmado con HMAC. Ese endpoint:
1. Verifica la firma HMAC
2. Genera el embedding con Voyage AI `voyage-3-lite` (512 dimensiones)
3. Calcula el SHA256 del contenido (título + descripción)
4. Llama a `upsert_task_embedding()` con service_role: si el hash no cambió, no actualiza (evita llamadas innecesarias a Voyage)

El fire-and-forget (`void`) significa que la creación de la tarea no espera al embedding. El usuario ve la tarea en el tablero de inmediato. El embedding estará disponible en la próxima búsqueda (generalmente en < 2 segundos).

### Modo voz

Cuando `voiceMode = true`, el system prompt cambia:
- Respuestas de máximo 2-3 oraciones
- Sin markdown, asteriscos ni bullets
- Lenguaje conversacional
- Siempre termina con una pregunta de seguimiento

El cliente también activa `SpeechSynthesisUtterance` con voz `es-CO` a rate 1.1, que lee la respuesta en voz alta.

---

## 9. Analítica

### Métricas calculadas

`src/lib/analytics/metrics.ts` contiene funciones puras (sin efectos) que calculan:

| Métrica | Cálculo |
|---|---|
| `pct` | `(done / total) * 100` |
| `daysElapsed` | días desde `start_date` hasta hoy (fechas UTC, no locales) |
| `daysLeft` | días desde hoy hasta `delivery_date` |
| `velocityActual` | `done / daysElapsed` (tareas completadas por día) |
| `velocityRequired` | `pending / daysLeft` (ritmo necesario para llegar a tiempo) |
| `atRisk` | `velocityRequired > velocityActual` |
| `burndown` | array de `{ label: 'S1', real: N, ideal: N }` por semana |
| `phaseReal` | array de fases con `done`, `total`, `pct`, `color` (desde DB) |
| `overdue` | tareas con `due_date` < hoy y status ≠ done |

Las fechas usan `parseUTCDate()` para evitar que el offset de zona horaria del navegador desplace el día calculado.

### hook `useAnalytics`

Carga los datos en `useEffect` con `Promise.all` de tareas, proyecto y fases. Maneja tres estados: loading, error, y datos. El error `PGRST116` (no rows — ningún proyecto) se trata como "sin datos" y no como fallo.

### Exportación de PDF

`handleExportPDF` en `analytics/page.tsx`:

1. Hace `POST /api/report` con el resumen de métricas (incluyendo `projectId`)
2. El endpoint busca el proyecto y sus fases en DB, construye el prompt dinámico y llama a Groq para generar la narrativa
3. La página importa lazily `buildAnalyticsPDF` (jsPDF ~150KB) solo cuando se necesita
4. `buildAnalyticsPDF` dibuja el PDF programáticamente: título, métricas, gráfico de burndown como barras, tabla de fases, y el texto narrativo del LLM

No se usa `html2canvas` porque convierte el DOM a imagen usando canvas, que no soporta los colores `oklch()` de Tailwind v4 y produce rectángulos negros.

---

## 10. Multi-tenancy y colaboración

### Modelo de proyectos

Un usuario puede tener múltiples proyectos y ser miembro de proyectos de otros usuarios. Las tareas pertenecen a un `user_id` (propietario original) y opcionalmente a un `project_id`.

El `ProjectSwitcher` en el sidebar muestra todos los proyectos donde el usuario tiene una fila en `project_members`. El contexto activo se guarda en `localStorage` y en la URL (`?project_id=<uuid>`).

### Roles

| Rol | Puede crear tareas | Puede editar/mover | Puede eliminar | Puede invitar |
|---|---|---|---|---|
| `owner` | Sí | Sí | Sí | Sí |
| `editor` | Sí | Sí | No | No |
| `viewer` | No | No | No | No |

Los roles son forzados por RLS en la DB, no solo por la UI.

### Invitaciones

1. El owner invoca `inviteToProject(email, role)` → genera un token hex-64 → inserta en `pending_invitations` con `expires_at = now + 7 días` → envía email via Resend con el link `/invite/<token>`
2. El invitado abre el link → la página lee la invitación via `get_invitation_by_token()` → muestra el nombre del proyecto y el rol ofrecido
3. Al aceptar → `accept_invitation(token)` → upsert en `project_members` → setea `accepted_at` → retorna `project_id`
4. La página redirige a `/board?project_id=<uuid>`

Si `RESEND_API_KEY` no está configurado, el link se loguea en consola del servidor en lugar de enviarse por email (degradación graceful).

---

## 11. Memoria conversacional del chat

Las conversaciones se persisten en `chat_sessions` y `chat_messages`. El flujo:

1. Al enviar el primer mensaje, `use-chat-stream.ts` crea una sesión (`createChatSession`)
2. La URL se actualiza a `?session_id=<uuid>` sin recargar la página
3. El historial se guarda en DB al finalizar cada intercambio (`saveMessages`)
4. Al recargar la página con `?session_id=<uuid>`, el Server Component verifica que la sesión pertenece al usuario y pasa el `initialSessionId` al cliente
5. El cliente carga el historial con `getChatMessages`

En el sidebar, `ChatSessions` lista las últimas 6 sesiones con su título y permite navegar entre ellas o eliminarlas. Se actualiza via evento DOM `taskflow:session_updated` emitido por `use-chat-stream.ts`.

---

## 11b. Importación de tareas desde CSV

### Entrada al flujo: empty state del tablero

`board.tsx` detecta `optimisticTasks.length === 0` y, en lugar de renderizar las tres columnas vacías, monta `<CsvImport projectId={projectId} />`. Esto pasa en dos escenarios:
- Usuario nuevo sin tareas (o en un proyecto recién creado sin contenido)
- Después de pulsar "Borrar todo" en `BoardActions`

El `MemberFilterBar` también queda oculto en este estado (no aplica filtrar miembros si no hay tareas).

### Componente `CsvImport`

`src/components/analytics/csv-import.tsx` — diseño dark MCOY consistente con la página de analítica (DM Sans, gradientes azules `#1d70e8 → #4d9bff`, surfaces `#131729`).

Secciones:
1. **Intro card** con descripción y botón "↓ Descargar plantilla" (genera Blob con el CSV embebido)
2. **Tabla de estructura** mostrando los 5 campos con tipo, descripción, ejemplo y notas (requerido vs opcional)
3. **Drop zone** que cambia de borde y fondo al hacer drag-over
4. **Preview** de las primeras 10 filas con `StatusBadge` y `PriorityBadge` para que el usuario verifique antes de insertar
5. **Resultado** con conteos de insertadas vs con errores y lista detallada de filas problemáticas

Estado machine: `idle → parsed → importing → done | error`.

### Parser CSV en el cliente

`parseCSV()` es un parser hand-rolled (sin dependencias) que maneja:
- BOM UTF-8 al inicio (`﻿`)
- Line endings `\r\n` y `\n`
- Campos quoted con comillas dobles
- Comillas escapadas dentro de quotes (`""`)
- Campos con comas internas

No soporta saltos de línea dentro de campos quoted (limitación conocida — para el caso de uso real con tareas de una línea funciona bien).

### Validación con Zod permisivo

`RowSchema` en `import.actions.ts`:
- `title`: requerido, max 200 chars
- `description`: opcional, max 2000 chars
- `status`: `.catch('todo')` — si viene "PENDIENTE" o cualquier otro valor, se normaliza a `todo` en lugar de abortar
- `priority`: `.catch('medium')` — mismo patrón
- `due_date`: acepta `YYYY-MM-DD` y `DD/MM/YYYY` (se transforma al ISO)

Las filas inválidas (solo si el título está vacío) se reportan como errores con número de fila, pero **no abortan** la importación de las demás.

### Server action `importTasksCSV`

```typescript
importTasksCSV(projectId, rawRows) → { inserted, skipped, errors[] }
```

Pasos:
1. Auth check (`supabase.auth.getUser()`)
2. Si `projectId` se proporciona: verificar membresía con rol `owner` o `editor` en `project_members`
3. Calcular `nextPosition` consultando la max `position` actual (espaciado de 1000)
4. Validar cada fila → acumular válidas en un array, inválidas en errores
5. Batch insert una sola query con todas las válidas (`.insert(payload).select('id, title, description')`)
6. Disparar embeddings throttleados en background (ver siguiente sección)
7. `Sentry.addBreadcrumb({ category: 'import', ... })`
8. `revalidatePath('/board')` + `revalidatePath('/analytics')`

Hard limit: 500 filas por importación.

### Embeddings throttleados

El loop original disparaba N fetches paralelos en ráfaga, lo cual rompía el rate limit de `/api/embed` (100/min). Ahora:

```typescript
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 3000
for (let i = 0; i < inserted.length; i += BATCH_SIZE) {
  const batch = inserted.slice(i, i + BATCH_SIZE)
  await Promise.allSettled(batch.map(/* fetch /api/embed con HMAC */))
  if (i + BATCH_SIZE < inserted.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
}
```

- 5 paralelos cada 3s = ~100 req/min sostenido (justo bajo el límite del endpoint)
- `Promise.allSettled` para que un fallo individual no aborte el batch
- Todo dentro de un IIFE `void (async () => {...})()` → la response al usuario no espera

Para 500 tareas: ~5 minutos en background, completamente transparente para el usuario.

### Cierre del ciclo: refresh tras inserción

Tras un import exitoso, `CsvImport` ejecuta `router.refresh()`. Esto fuerza al Server Component del board a recargar `initialTasks` con las tareas recién insertadas, y `KanbanBoard` deja de renderizar el empty state (ya hay tareas) y muestra las 3 columnas normales con drag & drop.

### Plantilla descargable

`public/template-tareas.csv` — 14 filas de ejemplo del pipeline Olist (setup, ETL bronze/silver/gold, modelado, ML, dashboard, FastAPI, demo final). Permite al usuario familiarizarse con la estructura sin tener que leer documentación.

---

## 12. Onboarding

`OnboardingModal` se monta en `DashboardShell`. Al cargar, verifica `localStorage.onboarding_done`. Si no existe, muestra el modal con 4 pasos:

1. **Bienvenida** — botón "Crear proyecto demo" que llama a `seedDemoProject()`
2. **Tablero Kanban** — explicación visual
3. **Asistente IA** — explicación del chat
4. **Analítica** — explicación del dashboard

`seedDemoProject()` crea un proyecto con fecha de entrega real, fases de ejemplo y 10 tareas distribuidas entre los tres estados. Después de la creación, redirige a `/board?project_id=<uuid>`.

Al cerrar el modal (por cualquier vía), setea `localStorage.onboarding_done = '1'`.

---

## 13. Rate limiting

`src/lib/ratelimit.ts` usa `@upstash/ratelimit` con sliding window de 60 segundos:

```typescript
chat:  20 peticiones / minuto por userId
report: 5 peticiones / minuto por userId
embed: 100 peticiones / minuto por userId (mayor porque es interno)
```

Si `UPSTASH_REDIS_REST_URL` no está configurado, `isConfigured()` retorna `false` y el método `check()` retorna `{ limited: false }` sin lanzar error.

Las respuestas con rate limit incluyen headers `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Reset`.

---

## 14. Cron y sugerencias proactivas

`/api/cron/insights` es un GET protegido con `Authorization: Bearer <CRON_SECRET>`. Está programado en `vercel.json` para ejecutarse a las 08:00 UTC diariamente.

Al ejecutarse:
1. Carga todos los proyectos activos
2. Para cada proyecto, evalúa si hay tareas vencidas o riesgo de velocidad
3. Los datos quedan disponibles para que `InsightBanner` los muestre al cargar el tablero

`InsightBanner` en `board/page.tsx` calcula el riesgo en tiempo de render del Server Component, comparando las métricas de velocidad con los mismos cálculos que usa la página de analítica.

---

## 15. CI/CD

### Pipeline en GitHub Actions

```yaml
ci (todo push y PR a main):
  1. checkout + node 24 + npm ci
  2. npm run lint     → 0 warnings obligatorio
  3. npx tsc --noEmit → 0 errores de tipos
  4. npm run test:coverage → 70% mínimo en todos los umbrales
  5. npm run build   → build de producción
  6. Lighthouse CI   → LCP <2.5s (error), CLS <0.1 (error), TBT <200ms (warn)

deploy-production (merge a main con CI verde):
  1. vercel pull --environment=production
  2. vercel build --prod
  3. vercel deploy --prebuilt --prod
```

### Variables en GitHub Secrets

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, y todas las variables de entorno de la aplicación deben estar configuradas como secrets para que el deploy funcione sin `.env`.

---

## 16. Tests

### Unitarios (Vitest)

Corren con jsdom. Setup global en `src/test/setup.ts`. Los mocks de Supabase usan un helper `makeChain()` que devuelve un objeto encadenable (`.from().select().eq()...`) con `vi.fn()`.

Archivos de test:
- `src/lib/__tests__/hmac.test.ts` — 12 casos: sign/verify, body modificado, timestamp expirado
- `src/lib/ai/__tests__/rag.test.ts` — buildContextBlock, buildSystemPrompt, rerank fallback
- `src/lib/ai/__tests__/voyage.test.ts` — mocks de fetch para embedding y rerank
- `src/actions/__tests__/tasks.test.ts` — createTask, moveTask, updateTask, deleteTask
- `src/hooks/__tests__/use-tasks-by-status.test.ts` — filtrado y memoización
- `src/lib/validations/__tests__/schemas.test.ts` — Zod schemas edge cases

Cobertura actual: **82% statements / 73% branches / 86% lines**.

### E2E (Playwright)

Requieren usuario real en `.env.local` (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`). El setup `e2e/auth.setup.ts` hace login y guarda el estado de auth en `e2e/.auth/user.json`. Las specs reutilizan ese estado.

Specs: `login`, `dashboard` (crear tarea, drag & drop), `chat` (streaming, session_id en URL), `analytics` (KPIs), `agent` (tool calling, confirmación de eliminación).

---

## 17. Errores comunes y sus causas

| Error | Causa | Solución |
|---|---|---|
| `cookies() should be awaited` | `createClient()` en servidor no fue `await`-eado | Siempre `await createClient()` |
| `PGRST200` — relationship not found | FK faltante en la DB (backup antiguo sin migración) | `ALTER TABLE ... ADD COLUMN` + `NOTIFY pgrst, 'reload schema'` |
| `42703` — column does not exist | Columna de migración posterior no aplicada | Aplicar la migración faltante en Supabase Dashboard |
| Flash de tema al cargar | El `<script>` de detección de tema fue movido de `<head>` | Mantenerlo en `<head>` de `app/layout.tsx` |
| Hydration mismatch en theme toggle | El botón del topbar usa el tema del cliente, el servidor no lo conoce | El botón tiene `suppressHydrationWarning` — no quitar |
| HMAC rechazado | `EMBED_INTERNAL_SECRET` diferente entre firmante y verificador, o timestamp > 5 min | Verificar que sea la misma clave en ambos lados |
| Embeddings no se generan | `SUPABASE_SERVICE_ROLE_KEY` o `VOYAGE_API_KEY` mal configurado | Verificar en Vercel → Environment Variables |
| Chat sin respuesta | `GROQ_API_KEY` inválida y `ANTHROPIC_API_KEY` no configurada | Configurar al menos una de las dos |
| RLS retorna array vacío sin error | Normal: RLS bloquea silenciosamente con array vacío | Verificar política con service_role para debugging |
