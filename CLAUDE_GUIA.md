# CLAUDE_GUIA.md
## Guía de Construcción: TaskFlow v3
### Debate entre tres expertos + síntesis ejecutable

---

## Los expertos

**Diego Vargas** — Arquitecto de Seguridad y Plataforma. 12 años en infraestructura de SaaS multi-tenant. Obsesionado con que "el código correcto es el que no puede hacer daño aunque esté mal llamado".

**Valentina Torres** — Ingeniería de IA/ML y Sistemas RAG. Construye pipelines de embeddings y agentes LLM en producción. Cree que "un agente sin guardrails es un bug con acceso a base de datos".

**Sebastián Mora** — Arquitecto Full-Stack y Calidad de Software. Especialista en Next.js App Router, TypeScript estricto, y UX de aplicaciones de productividad. "Si el TypeScript compila con `any`, no compila."

---

## Cómo leer esta guía

Cada fase tiene:
1. Un **debate** entre los tres expertos sobre las decisiones críticas
2. La **decisión de consenso** con justificación
3. Los **pasos exactos** con código real del proyecto
4. Las **trampas** que los expertos identificaron

Esta guía asume que construyes desde cero. El orden importa — cada fase depende de la anterior.

---

# FASE 0: Decisiones de Arquitectura Antes de Escribir Código

## El debate

> **Sebastián**: La primera pregunta es: ¿monolito Next.js con Supabase o backend separado? He visto equipos perder 3 meses en microservicios para 200 usuarios.
>
> **Diego**: La respuesta depende del modelo de amenaza. Con Supabase RLS, el backend "separado" ya existe — es PostgreSQL ejecutando políticas de seguridad fila por fila. No necesitas un API layer intermedio si la lógica de negocio es simple.
>
> **Valentina**: Pero el agente IA sí necesita runtime Node.js completo — streaming SSE, acceso a múltiples APIs externas, loops de tool calling. Edge runtime no sirve aquí. Eso fuerza `runtime = 'nodejs'` en las rutas de chat.
>
> **Diego**: Exacto. Y eso es un guardrail en sí mismo: el agente solo vive en el servidor. Nunca en el cliente. Las API keys nunca tocan el browser. Si usas Edge Functions para el chat, pierdes esa separación.
>
> **Sebastián**: ¿Y el state management? ¿Redux, Zustand, Context?
>
> **Valentina**: Ninguno global. Server Components manejan el 80% del estado. Para lo que necesita interactividad en tiempo real — el tablero, el chat — usas `useOptimistic` + `useTransition` + Supabase Realtime. No hay servidor de estado.
>
> **Diego**: Y ese patrón tiene una ventaja de seguridad: el servidor siempre es la fuente de verdad. El cliente puede proponer un movimiento optimista, pero el Server Action lo valida con Zod antes de tocar la DB.

### Decisión de consenso: Arquitectura

```
Browser → Next.js Server Components / Server Actions → Supabase (RLS)
                     ↓
         /api/chat (Node.js runtime) → Groq LLM → Tools → Supabase
                     ↓
         /api/embed (service_role, HMAC protegida) → Voyage AI
```

**Regla de oro**: nada que sea secreto llega al cliente. Nada que sea mutación llega sin validación Zod.

---

# FASE 1: Base de Datos — El Fundamento de la Seguridad

## El debate

> **Diego**: Aquí es donde la mayoría de los proyectos fallan. Crean las tablas, habilitan RLS, y asumen que están protegidos. RLS mal configurado retorna array vacío silenciosamente — nunca error. Tu aplicación funciona "bien" en staging y filtra datos en producción.
>
> **Valentina**: ¿Cuál es la estrategia para los embeddings? `pgvector` tiene `vector` y `halfvec`. La diferencia no es trivial — `halfvec(512)` usa float16, la mitad de espacio, misma precisión para voyage-3-lite. Con 100k tareas la diferencia es 200MB de índice.
>
> **Sebastián**: El orden de las migraciones importa tanto como su contenido. He visto proyectos donde migration 003 asume que migration 002 ya corrió, pero en CI ambas corren en paralelo. Supabase CLI las aplica en orden, pero si usas `db push` manual en producción, un error a mitad deja la DB en estado inconsistente.
>
> **Diego**: Por eso cada migración debe ser idempotente: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`. Si falla a mitad y vuelves a correr, no explota.

### Decisión de consenso: Migraciones

**Nunca** crear tablas desde el dashboard de Supabase. Todo va en archivos `supabase/migrations/NNN_nombre.sql` numerados secuencialmente. Cada archivo es idempotente.

## Paso 1.1 — Instalar y configurar Supabase CLI

```bash
npm install supabase --save-dev
npx supabase init          # genera supabase/config.toml
npx supabase login         # autenticarte con tu cuenta
npx supabase link --project-ref <TU_PROJECT_REF>
```

## Paso 1.2 — Estructura de migraciones

```
supabase/migrations/
  001_types_and_profiles.sql    ← enums y tabla profiles
  002_tasks.sql                  ← tabla tasks con posicionamiento
  003_embeddings.sql             ← task_embeddings con halfvec(512)
  004_rls_policies.sql           ← TODAS las políticas RLS + funciones SECURITY DEFINER
  005_projects.sql               ← multi-tenancy: projects + project_members
  006_invitations.sql            ← tokens de invitación con expiración
  007_chat_sessions.sql          ← sesiones de chat persistentes
  008_comments.sql               ← comentarios en tareas
  009_indexes.sql                ← índices de rendimiento
  010_realtime.sql               ← publicación de canales Realtime
```

## Paso 1.3 — Migración 001: Enums y Profiles

```sql
-- 001_types_and_profiles.sql
create type public.task_status   as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.member_role   as enum ('owner', 'editor', 'viewer');

-- profiles: espejo de auth.users con datos públicos
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Trigger: crear profile automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## Paso 1.4 — Migración 002: Tabla Tasks

```sql
-- 002_tasks.sql
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  title       text not null check (char_length(title) between 1 and 500),
  description text check (char_length(description) <= 5000),
  status      task_status   not null default 'todo',
  priority    task_priority not null default 'medium',
  due_date    date,
  position    integer not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Índices de acceso frecuente
create index if not exists tasks_user_status_idx  on public.tasks(user_id, status);
create index if not exists tasks_project_id_idx   on public.tasks(project_id);
create index if not exists tasks_position_idx     on public.tasks(position);
```

> **Diego** (trampa crítica): El campo `position` usa espaciado de 1000. Al insertar entre dos tareas con posiciones 1000 y 2000, usas `Math.round((1000 + 2000) / 2) = 1500`. Si sigues insertando entre el mismo par llegas a precisión de entero. La solución real es un job periódico que normalice posiciones o usar `real` (float) en lugar de `integer`. Este proyecto usa `integer` — funcional para uso normal, pero documentar el límite.

## Paso 1.5 — Migración 003: Embeddings con halfvec

```sql
-- 003_embeddings.sql
-- Habilitar extensión pgvector
create extension if not exists vector;

create table if not exists public.task_embeddings (
  task_id      uuid primary key references public.tasks(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  embedding    halfvec(512) not null,     -- voyage-3-lite = 512 dims, halfvec ahorra 50% espacio
  content_hash text not null,             -- SHA-256 del contenido para skip si no cambió
  created_at   timestamptz default now()
);

-- IVFFLAT para búsqueda aproximada (cosine similarity)
-- lists = sqrt(número de filas esperadas). Para 10k tareas: 100.
create index if not exists task_embeddings_hnsw_idx
  on public.task_embeddings
  using hnsw (embedding halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);
```

> **Valentina** (decisión técnica): HNSW sobre IVFFLAT porque HNSW no requiere entrenamiento previo (IVFFLAT necesita al menos 3× `lists` filas para construir el índice correctamente). Con una base nueva, IVFFLAT con `lists=100` pero 50 filas produce resultados basura. HNSW funciona bien desde la primera fila.

## Paso 1.6 — Migración 004: RLS — La Capa Más Crítica

> **Diego**: Las políticas RLS son la última línea de defensa. Si tu Server Action tiene un bug y no filtra por `user_id`, RLS salva la situación. Si RLS está mal, el bug filtra datos de otros usuarios silenciosamente.

```sql
-- 004_rls_policies.sql

-- ── Activar RLS en TODAS las tablas ──────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_embeddings  enable row level security;

-- ── Funciones helper SECURITY DEFINER (evitan recursión en RLS) ──────────────
-- Sin estas funciones, una política en tasks que consulta project_members
-- dispara la política de project_members que consulta tasks → loop infinito.

create or replace function public.is_project_member(p_project_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id    = auth.uid()
  );
$$;

create or replace function public.is_project_editor(p_project_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id    = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

-- ── Políticas para tasks ──────────────────────────────────────────────────────
create policy "tasks: propietario puede leer" on public.tasks
  for select using (user_id = auth.uid());

create policy "tasks: miembro de proyecto puede leer" on public.tasks
  for select using (
    project_id is not null
    and public.is_project_member(project_id)
  );

create policy "tasks: solo propietario puede crear" on public.tasks
  for insert with check (user_id = auth.uid());

create policy "tasks: propietario o editor puede actualizar" on public.tasks
  for update using (
    user_id = auth.uid()
    or (project_id is not null and public.is_project_editor(project_id))
  );

create policy "tasks: solo propietario puede eliminar" on public.tasks
  for delete using (user_id = auth.uid());

-- ── Políticas para task_embeddings ───────────────────────────────────────────
-- Solo service_role escribe. Usuarios autenticados leen solo las suyas.
create policy "embeddings: usuario lee las suyas" on public.task_embeddings
  for select using (user_id = auth.uid());

-- No hay política INSERT/UPDATE para authenticated — solo service_role la tiene por defecto
```

> **Diego** (guardrail de implementación): Después de crear RLS, **verificar con service_role** que los datos existen, y con anon_key que NO son accesibles. El flujo:
> 1. `supabase db push` aplica migración
> 2. Insertar datos de prueba con service_role (dashboard)
> 3. Consultar con anon_key — debe retornar array vacío, no error
> 4. Consultar con el JWT del usuario correcto — debe retornar los datos

---

# FASE 2: Proyecto Next.js — Estructura y Configuración

## El debate

> **Sebastián**: El App Router de Next.js tiene una trampa con los grupos de rutas `(auth)` y `(dashboard)`. Los layouts no se comparten entre grupos — si pones providers en `app/layout.tsx`, funcionan en todos. Si los pones en `(dashboard)/layout.tsx`, solo funcionan dentro del dashboard. Necesitas saber esto antes de decidir dónde van tus contexts.
>
> **Diego**: Y el middleware es el punto de control de auth para TODO el sitio. Hay una trampa de seguridad: si tu middleware usa `NextResponse.next()` en vez de devolver `supabaseResponse`, las cookies de auth se pierden entre requests. El usuario parece autenticado pero Supabase no puede validarlo.
>
> **Valentina**: El runtime también importa. Las rutas que usan APIs externas (Groq, Anthropic) deben ser `runtime = 'nodejs'`. Edge runtime tiene límite de 50ms de CPU, sin streams largos, sin `crypto.subtle` completo. Si pones el agente en Edge te enteras en producción, no en desarrollo.

## Paso 2.1 — Inicializar el proyecto

```bash
npx create-next-app@latest taskflow-v3 \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir     # usaremos src/ pero lo configuramos manualmente

# Mover a src/ y configurar paths
```

### tsconfig.json crítico

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "paths": { "@/*": ["./src/*"] },
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"]
  }
}
```

> **Sebastián**: `noUncheckedIndexedAccess` es el flag más infravalorado de TypeScript. `array[0]` devuelve `T | undefined`, no `T`. Catches `Cannot read property of undefined` en tiempo de compilación, no en runtime.

## Paso 2.2 — Variables de entorno con validación en boot

Nunca acceder a `process.env.ALGO` directamente. Crear `src/lib/env.ts`:

```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:       z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:  z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:      z.string().min(1),
  GROQ_API_KEY:                   z.string().min(1),
  VOYAGE_API_KEY:                 z.string().min(1),
  EMBED_INTERNAL_SECRET:          z.string().min(32),
  NEXT_PUBLIC_APP_URL:            z.string().url(),
  CHAT_PROVIDER:                  z.enum(['groq', 'ollama']).default('groq'),
  UPSTASH_REDIS_REST_URL:         z.string().url(),
  UPSTASH_REDIS_REST_TOKEN:       z.string().min(1),
  // Opcionales
  ANTHROPIC_API_KEY:              z.string().optional(),
  RESEND_API_KEY:                 z.string().optional(),
  CRON_SECRET:                    z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN:         z.string().optional(),
})

export const env = envSchema.parse(process.env)
```

Si falta una variable, la aplicación no arranca — el error es explícito, no un `undefined is not a function` a las 3am.

> **Diego**: `EMBED_INTERNAL_SECRET` mínimo 32 caracteres. Generar con:
> ```bash
> openssl rand -hex 32
> ```
> Nunca usar strings predecibles como `"my-secret"`. El HMAC de la ruta `/api/embed` depende de esto.

## Paso 2.3 — Middleware de autenticación

```typescript
// middleware.ts (en raíz del proyecto, NO en src/)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  // CRÍTICO: iniciar con NextResponse.next({ request }), no con NextResponse.next()
  // Sin { request }, los headers de la request no se propagan al Server Component
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)  // CRÍTICO: setear en ambos
          })
        },
      },
    }
  )

  // getUser() valida JWT contra Supabase — no usar getSession() (no valida)
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute   = request.nextUrl.pathname.startsWith('/login') ||
                        request.nextUrl.pathname.startsWith('/register')
  const isPublicRoute = isAuthRoute ||
                        request.nextUrl.pathname.startsWith('/invite')

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/board', request.url))
  }

  // CRÍTICO: devolver supabaseResponse, NUNCA NextResponse.next() aquí
  return supabaseResponse
}

export const config = {
  // Excluir assets estáticos Y rutas que usan service_role (no necesitan auth de middleware)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/embed|api/backfill).*)'],
}
```

> **Diego** (trampa frecuente): `getSession()` usa el JWT del cookie sin validarlo contra el servidor — un token expirado o manipulado pasa. `getUser()` hace una llamada extra a Supabase pero es la única forma correcta de verificar autenticación en middleware.

---

# FASE 3: Sistema de Tipos y Validaciones

## El debate

> **Sebastián**: Zod v4 cambió `.errors` a `.issues`. Si vienes de Zod v3 y usas `.errors[0].message` en tus Server Actions, obtienes `undefined` silenciosamente — el error se pierde. Peor: el usuario ve "undefined" como mensaje.
>
> **Valentina**: Y con react-hook-form, hay una trampa específica con schemas que tienen `.default()`. `z.infer<Schema>` te da el tipo OUTPUT (después de aplicar defaults — todos los campos son requeridos). Pero el formulario tiene el tipo INPUT (antes — campos con default son opcionales). Si usas `useForm<CreateTaskSchema>` explota.
>
> **Diego**: La regla de los schemas: define UN schema por entidad. Deriva los tipos del schema, no al revés. El schema es la fuente de verdad para validación en Server Action Y para el formulario. Si tienes dos schemas distintos, eventualmente se dessincronizan.

## Paso 3.1 — Schemas de validación

```typescript
// src/lib/validations/task.schema.ts
import { z } from 'zod'

export const CreateTaskSchema = z.object({
  title:       z.string().min(1, 'El título es requerido').max(500),
  description: z.string().max(5000).optional(),
  status:      z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
  due_date:    z.string().optional(),  // ISO date string del input date
  project_id:  z.string().uuid().optional(),
})

// Para usar en useForm<>: tipo ANTES de defaults (campos con .default() son opcionales)
export type CreateTaskInput  = z.infer<typeof CreateTaskSchema>   // después de defaults
// Nota: z.input<typeof CreateTaskSchema> es el tipo que react-hook-form necesita

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  id: z.string().uuid(),
})

export const MoveTaskSchema = z.object({
  id:       z.string().uuid(),
  status:   z.enum(['todo', 'in_progress', 'done']),
  position: z.number().int().min(0),
})
```

> **Sebastián** (patrón react-hook-form + zod con defaults):
> ```typescript
> // En el componente de formulario:
> import { z } from 'zod'
> type FormValues = z.input<typeof CreateTaskSchema>  // tipo INPUT (para useForm)
>
> const form = useForm<FormValues>({
>   resolver: zodResolver(CreateTaskSchema),
>   defaultValues: { title: '', status: 'todo', priority: 'medium' },
> })
>
> async function onSubmit(data: FormValues) {
>   const result = await createTask(data as CreateTaskInput)  // cast al tipo OUTPUT
> }
> ```
> La regla: `z.input<>` para `useForm<>`, cast a `z.infer<>` cuando llamas la Server Action.

## Paso 3.2 — Tipos de dominio

```typescript
// src/types/app.types.ts
export type TaskStatus   = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id:          string
  user_id:     string
  project_id:  string | null
  title:       string
  description: string | null
  status:      TaskStatus
  priority:    TaskPriority
  due_date:    string | null
  position:    number
  created_at:  string
  updated_at:  string
}

export interface TaskWithAssignees extends Task {
  assignees: string[]  // array de user_ids
}

export interface KanbanColumn {
  id:    TaskStatus
  title: string
  tasks: TaskWithAssignees[]
}

export interface ProjectMember {
  userId:    string
  name:      string
  initials:  string
  avatarUrl: string | null
  role:      'owner' | 'editor' | 'viewer'
}

// Patrón de respuesta para Server Actions
export type ActionResult<T = void> =
  | { success: true;  data: T }
  | { success: false; error: string }
```

---

# FASE 4: Server Actions — CRUD Seguro

## El debate

> **Diego**: Cada Server Action es un endpoint de API implícito. Cualquier usuario autenticado puede llamarla directamente, no solo tu formulario. El orden de validación no es negociable: (1) autenticación, (2) validación Zod, (3) autorización, (4) mutación.
>
> **Sebastián**: Y manejar `redirect()` de Next.js es un gotcha: `redirect()` lanza una excepción internamente. Si lo pones dentro de un try/catch, el catch lo captura y el redirect nunca ocurre. Siempre llamar `redirect()` fuera del try.
>
> **Valentina**: El embedding es fire-and-forget. No bloquees al usuario esperando que Voyage AI procese el embedding. `void fetch(...)` desde el Server Action, y el endpoint `/api/embed` lo maneja asíncronamente.

## Paso 4.1 — Patrón base de Server Action

```typescript
// src/actions/task.actions.ts
'use server'

import { revalidatePath }  from 'next/cache'
import { createClient }    from '@/lib/supabase/server'
import { getAuthUser }     from '@/lib/supabase/get-user'
import { CreateTaskSchema, MoveTaskSchema } from '@/lib/validations/task.schema'
import type { ActionResult, TaskWithAssignees } from '@/types/app.types'
import * as Sentry from '@sentry/nextjs'

export async function createTask(rawData: unknown): Promise<ActionResult<TaskWithAssignees>> {
  // 1. Autenticación
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // 2. Validación Zod
  const parsed = CreateTaskSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
    // NOTA: .issues[0] en Zod v4, no .errors[0]
  }

  const { title, description, status, priority, due_date, project_id } = parsed.data

  // 3. Autorización: si project_id, verificar que el usuario es editor
  if (project_id) {
    const supabase = await createClient()
    const { data: isMember } = await supabase
      .rpc('is_project_editor', { p_project_id: project_id })
    if (!isMember) return { success: false, error: 'Sin permisos en este proyecto' }
  }

  const supabase = await createClient()

  // 4. Obtener posición máxima actual
  const { data: maxPos } = await supabase
    .from('tasks')
    .select('position')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxPos?.position ?? 0) + 1000

  // 5. Mutación (RLS también protege aquí)
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,  // SIEMPRE incluir user_id explícitamente
      title,
      description: description ?? null,
      status,
      priority,
      due_date: due_date ?? null,
      position,
      project_id: project_id ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    Sentry.captureException(error)
    return { success: false, error: 'Error al crear la tarea' }
  }

  // 6. Trigger embedding asíncrono (fire-and-forget)
  void triggerEmbedding(data.id, user.id, title, description)

  // 7. Sentry breadcrumb
  Sentry.addBreadcrumb({
    category: 'task',
    message: 'task.created',
    data: { taskId: data.id, status, priority },
    level: 'info',
  })

  revalidatePath('/board')
  return { success: true, data: { ...data, assignees: [] } as TaskWithAssignees }
}

// Fire-and-forget: no await, no throw
async function triggerEmbedding(taskId: string, userId: string, title: string, description: string | null | undefined) {
  const body    = JSON.stringify({ task_id: taskId, user_id: userId, title, description })
  const { signRequest } = await import('@/lib/hmac')
  const headers = await signRequest('/api/embed', body)

  void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  }).catch(err => console.error('[embed] trigger failed:', err))
}
```

---

# FASE 5: Pipeline RAG — Búsqueda Semántica

## El debate

> **Valentina**: El error más común en RAG es creer que solo necesitas embeddings. Con tareas estructuradas (status, priority), la búsqueda exacta SQL supera a la semántica para consultas como "¿qué tengo pendiente?". La solución correcta es híbrida: detectar intención estructural primero, hacer ambas búsquedas en paralelo, fusionar.
>
> **Diego**: Y el reranking no es opcional en producción. top-K de vector similarity tiene alta recall pero baja precision — te devuelve cosas relacionadas pero no necesariamente las más relevantes. `rerank-2-lite` re-ordena los candidatos semánticos según relevancia léxica. El costo (una llamada API extra) se justifica.
>
> **Sebastián**: El threshold de similarity es tricky. 0.7 es demasiado alto — con tareas cortas y vocabulario específico del dominio, scores de 0.35 son relevantes. Empezar en 0.3 y ajustar con datos reales.

## Paso 5.1 — Voyage AI: embeddings y reranking

```typescript
// src/lib/ai/voyage.ts
import { env } from '@/lib/env'

const VOYAGE_API = 'https://api.voyageai.com/v1'
const EMBED_MODEL = 'voyage-3-lite'    // 512 dims, óptimo para tareas cortas
const RERANK_MODEL = 'rerank-2-lite'

export function buildTaskContent(title: string, description: string | null | undefined): string {
  const parts = [title]
  if (description?.trim()) parts.push(description.trim())
  return parts.join('\n')
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${VOYAGE_API}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: [text],
      input_type: 'document',   // para indexar tareas
    }),
  })
  if (!res.ok) throw new Error(`Voyage embed error: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const res = await fetch(`${VOYAGE_API}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: [query],
      input_type: 'query',       // distinción importante: query vs document
    }),
  })
  if (!res.ok) throw new Error(`Voyage query embed error: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number
): Promise<Array<{ index: number; relevance_score: number }>> {
  const res = await fetch(`${VOYAGE_API}/rerank`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents,
      top_k: topK,
    }),
  })
  if (!res.ok) throw new Error(`Voyage rerank error: ${res.status}`)
  const data = await res.json()
  return data.data
}
```

## Paso 5.2 — Endpoint de embedding con HMAC

```typescript
// src/app/api/embed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient }     from '@supabase/supabase-js'
import { verifyHmacRequest } from '@/lib/hmac'
import { generateEmbedding, buildTaskContent } from '@/lib/ai/voyage'
import { ratelimit }         from '@/lib/ratelimit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // 1. Verificar HMAC — rechaza cualquier llamada que no sea del propio servidor
  const isValid = await verifyHmacRequest(request.clone())
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit por IP (no por user, es llamada interna)
  const ip = request.headers.get('x-forwarded-for') ?? 'internal'
  const { limited } = await ratelimit.embed(ip)
  if (limited) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const { task_id, user_id, title, description } = await request.json()

  // 3. Generar embedding
  const content   = buildTaskContent(title, description)
  const embedding = await generateEmbedding(content)

  // 4. Hash del contenido para skip idempotente
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(content)
  )
  const contentHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 5. Upsert con service_role (único lugar donde se usa)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // SOLO aquí
  )

  const { error } = await supabase.rpc('upsert_task_embedding', {
    p_task_id:      task_id,
    p_user_id:      user_id,
    p_embedding:    embedding,
    p_content_hash: contentHash,
  })

  if (error) {
    console.error('[embed] Error upsert:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

> **Diego** (guardrail de HMAC): La firma incluye `timestamp + path + SHA256(body)`. La ventana de 5 minutos previene replay attacks. Si alguien captura la firma, solo puede usarla 5 minutos — tiempo insuficiente para un ataque automatizado significativo. El secret debe ser distinto del `SUPABASE_SERVICE_ROLE_KEY`.

---

# FASE 6: El Agente IA — La Pieza Más Compleja

## El debate

> **Valentina**: El agente tiene dos decisiones de diseño fundamentales: cuántos turnos de tool calling permitir, y cómo manejar operaciones destructivas. Para un Kanban, dos turnos son suficientes — el primer turno identifica qué tool usar, el segundo sintetiza la respuesta. Más turnos = más latencia, más costo, más superficie de ataque para prompt injection.
>
> **Diego**: Las operaciones destructivas son el punto crítico de seguridad del agente. `delete_task` ejecutado por un LLM que malinterpretó "elimina los pendientes" podría borrar decenas de tareas. La solución es `confirm_required`: el agente detecta la tool destructiva, emite un evento especial al cliente, pausa la ejecución, y espera confirmación explícita del usuario.
>
> **Sebastián**: El streaming SSE tiene una trampa con Next.js: si usas `runtime = 'edge'`, el stream funciona en development pero en producción Vercel Edge corta el stream después de 30 segundos y tiene límites de CPU que truncan respuestas largas. El agente DEBE ser `runtime = 'nodejs'`.
>
> **Valentina**: Y el sistema de herramientas debe ser mínimo. Cada tool que añades es superficie de prompt injection. Seis tools cubre el 95% de casos de un Kanban: crear, actualizar, mover, eliminar, listar, buscar comentarios. No añadir tools "por si acaso".

## Paso 6.1 — Definición de tools

```typescript
// src/lib/ai/tools.ts
export const TASK_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Crea una nueva tarea en el tablero del usuario',
      parameters: {
        type: 'object',
        properties: {
          title:       { type: 'string', description: 'Título de la tarea (requerido)' },
          description: { type: 'string', description: 'Descripción opcional' },
          status:      { type: 'string', enum: ['todo', 'in_progress', 'done'] },
          priority:    { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date:    { type: 'string', description: 'Fecha de vencimiento ISO 8601' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Elimina permanentemente una tarea. USAR SOLO cuando el usuario pide explícitamente eliminar/borrar.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID de la tarea a eliminar' },
        },
        required: ['task_id'],
      },
    },
  },
  // ... move_task, update_task, list_tasks, search_comments
]
```

> **Valentina** (guardrail en el description de la tool): La description de `delete_task` dice explícitamente "USAR SOLO cuando el usuario pide explícitamente eliminar/borrar". El LLM lee el description de la tool al decidir cuándo usarla. Hacerlo prescriptivo reduce false positives.

## Paso 6.2 — Loop del agente con guardrails

```typescript
// src/lib/ai/agent.ts (fragmento clave del loop)

const DESTRUCTIVE_TOOLS = new Set(['delete_task'])

export function runAgent(options: AgentOptions, relevantTasks: unknown[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        // ── Turno 1: sin streaming — necesitamos ver si hay tool calls ─────
        const first = await callLLM(currentMessages, false)

        if (first.finish_reason === 'tool_calls' && first.tool_calls?.length) {

          // ── Guardrail: interceptar destructivas ANTES de ejecutar ─────────
          const destructiveCall = first.tool_calls.find(
            tc => DESTRUCTIVE_TOOLS.has(tc.function.name)
          )

          if (destructiveCall) {
            // Buscar el título de la tarea para mostrarlo en la confirmación
            const args = JSON.parse(destructiveCall.function.arguments)
            const { data } = await supabase
              .from('tasks')
              .select('title')
              .eq('id', args.task_id)
              .eq('user_id', userId)   // Verificar ownership antes de mostrar título
              .single()

            emit(controller, {
              type:       'confirm_required',
              tool:       destructiveCall.function.name,
              args,
              task_title: data?.title ?? null,
              confirm_id: crypto.randomUUID(),
            })
            return   // Parar aquí. El cliente maneja la confirmación.
          }

          // Ejecutar tools no destructivas en paralelo
          const toolResults = await Promise.all(
            first.tool_calls.map(async (tc) => {
              const args = JSON.parse(tc.function.arguments)
              emit(controller, { type: 'tool_call', tool: tc.function.name, args })
              const result = await executeTool(tc.function.name, args, { supabase, userId })
              emit(controller, { type: 'tool_result', tool: tc.function.name, result })
              return { role: 'tool' as const, tool_call_id: tc.id, content: result }
            })
          )

          currentMessages = [...currentMessages, ...toolResults]
        }

        // ── Turno 2: síntesis final con streaming ─────────────────────────
        try {
          const stream = await callLLM(currentMessages, true)
          // ... pipe stream to client
        } catch {
          // Fallback a Claude Haiku si Groq falla
          const haikuStream = await callClaudeHaikuStream(currentMessages)
          await pipeAnthropicStream(haikuStream, data => emit(controller, data))
        }

      } catch (err) {
        Sentry.captureException(err)
        emit(controller, { type: 'error', message: err instanceof Error ? err.message : 'Error desconocido' })
      } finally {
        controller.close()
      }
    },
  })
}
```

## Paso 6.3 — Endpoint de confirmación de tool destructiva

```typescript
// src/app/api/chat/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser }  from '@/lib/supabase/get-user'
import { executeTool }  from '@/lib/ai/tools'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tool, args } = await request.json()

  // Solo tools en la lista destructiva pueden ser confirmadas por esta ruta
  const ALLOWED = ['delete_task']
  if (!ALLOWED.includes(tool)) {
    return NextResponse.json({ error: 'Tool no permitida' }, { status: 400 })
  }

  const supabase = await createClient()
  const result = await executeTool(tool, args, { supabase, userId: user.id })

  return NextResponse.json({ result })
}
```

> **Diego** (doble guardrail): El endpoint `/api/chat/confirm` solo acepta tools de `ALLOWED`. Si alguien manipula el frontend para enviar `tool: 'drop_all_tables'`, el servidor rechaza. Y `executeTool` internamente hace `.eq('user_id', userId)` en todas las queries — RLS + filtro explícito.

## Paso 6.4 — Sistema de prompts con guardrails

```typescript
// En rag.ts — buildSystemPrompt
export function buildSystemPrompt(context: string, voiceMode: boolean, project?: ProjectSummary): string {
  return `Eres TaskFlow AI, un asistente de productividad integrado en un tablero Kanban.

REGLAS ESTRICTAS:
- Solo puedes hablar sobre las tareas del usuario que están en el contexto.
- No inventes tareas que no estén listadas abajo.
- Si el usuario pregunta sobre temas no relacionados con sus tareas, redirígelo amablemente.
- Para eliminar tareas, SIEMPRE pedir confirmación explícita si el usuario no fue claro.
- No ejecutes acciones masivas sin confirmación ("elimina todo", "mueve todas").

CONTEXTO DE TAREAS:
${context}

Fecha actual: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
}
```

> **Valentina** (guardrails en el system prompt): Cuatro reglas explícitas para el LLM: (1) no inventar datos, (2) no salir del dominio, (3) pedir confirmación en ambiguedad destructiva, (4) no ejecutar acciones masivas. Estas reglas no son perfectas — un modelo mal calibrado las puede ignorar — pero combinadas con el guardrail técnico de `DESTRUCTIVE_TOOLS` crean defensa en capas.

---

# FASE 7: Multi-tenancy Seguro

## El debate

> **Diego**: Multi-tenancy en una aplicación SaaS es donde más errores de seguridad ocurren. El patrón incorrecto es: "verifico en el frontend que el usuario es del proyecto". El patrón correcto es: RLS + función `is_project_member()` que se evalúa en el servidor para CADA query.
>
> **Sebastián**: Las invitaciones por token tienen otro problema: el token debe ser irrepetible y de entropía suficiente. `crypto.randomBytes(32).toString('hex')` da 64 caracteres hex — 256 bits de entropía — imposible de bruteforcear. Expiración de 7 días. Un único uso (marcar como aceptado).
>
> **Valentina**: Y el email de invitación es la superficie de phishing más común. El link debe ir a `/invite/[token]` en TU dominio, no a un link externo. El servidor verifica el token, muestra los detalles del proyecto, y solo entonces ejecuta `accept_invitation`.

## Paso 7.1 — Migración de multi-tenancy

```sql
-- 005_projects.sql
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 200),
  delivery_date date,
  created_at    timestamptz default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'editor',
  joined_at  timestamptz default now(),
  primary key (project_id, user_id)
);

-- El owner siempre es miembro
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create or replace trigger on_project_created
  after insert on public.projects
  for each row execute function public.add_owner_as_member();

-- RLS para projects
alter table public.projects       enable row level security;
alter table public.project_members enable row level security;

create policy "projects: miembro puede ver" on public.projects
  for select using (public.is_project_member(id));

create policy "projects: owner puede actualizar" on public.projects
  for update using (user_id = auth.uid());

create policy "members: miembro puede ver otros miembros" on public.project_members
  for select using (public.is_project_member(project_id));
```

```sql
-- 006_invitations.sql
create table if not exists public.project_invitations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  email      text not null,
  token      text not null unique,
  role       member_role not null default 'editor',
  accepted   boolean not null default false,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create index if not exists invitations_token_idx on public.project_invitations(token);

-- Función para aceptar invitación (SECURITY DEFINER para hacer upsert en project_members)
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_inv public.project_invitations;
begin
  select * into v_inv
  from public.project_invitations
  where token = p_token
    and accepted = false
    and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'Invitación inválida o expirada');
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (v_inv.project_id, auth.uid(), v_inv.role)
  on conflict (project_id, user_id) do update set role = excluded.role;

  update public.project_invitations
  set accepted = true
  where id = v_inv.id;

  return jsonb_build_object('project_id', v_inv.project_id);
end;
$$;
```

---

# FASE 8: Rate Limiting y Protección de APIs

## El debate

> **Diego**: Rate limiting en el borde (middleware) es el ideal, pero con Upstash y Vercel está bien en el handler. Lo crítico es elegir el identificador correcto: para endpoints autenticados, usar `user.id` — no la IP, que puede ser compartida. Para endpoints públicos como `/api/embed` (que ya tiene HMAC), usar IP.
>
> **Valentina**: Los límites deben ser asimétricos según el costo de la operación. Chat (LLM call + RAG) es caro: 20/min. Report (generación PDF completa): 5/min. Embed (solo Voyage AI): 100/min. Si pones 20/min en embed, el backfill de embeddings de 500 tareas tarda 25 minutos.
>
> **Sebastián**: Y el bot guard es el primer filtro: si `x-vercel-is-bot: 1` está en el header, rechazar antes de llegar al rate limiter. Vercel detecta bots en el borde — usar esa señal.

## Paso 8.1 — Rate limiting con Upstash

```typescript
// src/lib/ratelimit.ts
import { Ratelimit }  from '@upstash/ratelimit'
import { Redis }      from '@upstash/redis'
import { env }        from '@/lib/env'

const redis = new Redis({
  url:   env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

function makeRatelimit(requests: number, window: string) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
  })
}

const chatLimiter   = makeRatelimit(20,  '1 m')
const reportLimiter = makeRatelimit(5,   '1 m')
const embedLimiter  = makeRatelimit(100, '1 m')

async function check(limiter: Ratelimit, identifier: string) {
  const { success, limit, remaining, reset } = await limiter.limit(identifier)
  const headers = {
    'X-RateLimit-Limit':     limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset':     reset.toString(),
  }
  return { limited: !success, headers }
}

export const ratelimit = {
  chat:   (userId: string) => check(chatLimiter,   `chat:${userId}`),
  report: (userId: string) => check(reportLimiter, `report:${userId}`),
  embed:  (ip: string)     => check(embedLimiter,  `embed:${ip}`),
}
```

## Paso 8.2 — Bot guard

```typescript
// src/lib/bot-guard.ts
import { NextRequest, NextResponse } from 'next/server'

export function isBot(request: NextRequest): boolean {
  return request.headers.get('x-vercel-is-bot') === '1'
}

export function botBlockResponse(): NextResponse {
  return new NextResponse('Forbidden', { status: 403 })
}
```

---

# FASE 9: Kanban — UI Reactiva con Optimistic Updates

## El debate

> **Sebastián**: El Kanban tiene dos partes que la mayoría confunde: el drag-and-drop (cliente) y la persistencia (servidor). `@dnd-kit` maneja el DnD. `useOptimistic` + `useTransition` manejan la ilusión de inmediatez. Si el Server Action falla, `useOptimistic` revierte automáticamente — el usuario ve el rollback.
>
> **Diego**: El posicionamiento de tareas es una fuente de race conditions. Dos usuarios mueven la misma tarea al mismo tiempo. La solución de este proyecto es eventual consistency: el último en escribir gana, Supabase Realtime propaga el cambio, el cliente que "perdió" ve el estado correcto en el siguiente ciclo de Realtime.
>
> **Valentina**: El `useRealtimeTasks` es el componente más delicado: suscribe a cambios de la tabla `tasks` para el proyecto activo. Pero los cambios propios (los que acabas de hacer vía Server Action) ya están aplicados optimistamente — si el Realtime los re-aplica, hay un flash. La solución es `skipChanges = record.user_id === currentUserId`.

## Paso 9.1 — useOptimistic en el Kanban

```typescript
// src/components/kanban/board.tsx (patrón clave)
'use client'

import { useOptimistic, useTransition } from 'react'
import { moveTask } from '@/actions/task.actions'

function boardReducer(tasks: TaskWithAssignees[], action: OptimisticAction) {
  if (action.type === 'MOVE_TASK') {
    return tasks.map(task =>
      task.id === action.taskId
        ? { ...task, status: action.newStatus, position: action.newPosition }
        : task
    )
  }
  return tasks
}

// En el componente:
const [optimisticTasks, applyOptimisticMove] = useOptimistic(initialTasks, boardReducer)
const [isPending, startTransition] = useTransition()

function handleDragEnd(event: DragEndEvent) {
  // ... calcular newStatus y newPosition

  startTransition(async () => {
    // 1. Aplicar cambio optimista INMEDIATAMENTE (sin esperar al servidor)
    applyOptimisticMove({ type: 'MOVE_TASK', taskId, newStatus, newPosition })

    // 2. Persistir en el servidor
    const result = await moveTask({ id: taskId, status: newStatus, position: newPosition })

    // 3. Si falla, useOptimistic revierte automáticamente al estado anterior
    if (!result.success) toast.error(result.error)
  })
}
```

## Paso 9.2 — Realtime con deduplicación

```typescript
// src/hooks/use-realtime-tasks.ts
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { toast } from 'sonner'

export function useRealtimeTasks({ projectId, currentUserId }: {
  projectId: string | null
  currentUserId: string
}) {
  const router = useRouter()

  useEffect(() => {
    if (!projectId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel(`project-tasks:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        const record = payload.new as { user_id?: string } | null

        // Skip cambios propios — ya aplicados optimistamente
        if (record?.user_id === currentUserId) return

        // Revalidar para obtener el estado real del servidor
        router.refresh()
        toast.info('Un colaborador actualizó una tarea')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, currentUserId, router])
}
```

---

# FASE 10: Analítica — Métricas Puras sin Recharts

## El debate

> **Sebastián**: La decisión de no usar Recharts en este proyecto es deliberada. Recharts usa `oklch()` de Tailwind v4 para colores — `oklch` no está soportado en `html2canvas`, que es lo que usan la mayoría de librerías de PDF. Resultado: el PDF exportado tiene colores incorrectos o transparentes. La solución es: gráficos con divs (Tailwind) en pantalla + `jsPDF` programático para el PDF.
>
> **Valentina**: Y las métricas de burndown deben calcularse del lado del servidor, no del cliente. `calculateBurndown` en `src/lib/analytics/metrics.ts` son funciones puras — sin fetch, sin side effects. Testeables en Vitest con datos fixtures.
>
> **Diego**: El endpoint `/api/report` genera el narrativo con Groq. Protegerlo con rate limit estricto (5/min) y auth obligatoria. El narrativo incluye datos del proyecto — no exponerlo a usuarios no autenticados.

## Paso 10.1 — Funciones puras de métricas

```typescript
// src/lib/analytics/metrics.ts
import type { TaskWithAssignees } from '@/types/app.types'

export interface BurndownPoint {
  label: string
  real:  number
  ideal: number
}

export interface ProjectMetrics {
  total:            number
  done:             number
  inProgress:       number
  todo:             number
  overdue:          number
  pct:              number
  daysLeft:         number
  atRisk:           boolean
  velocityActual:   number
  velocityRequired: number
  pending:          number
  phaseReal:        PhaseProgress[]
  burndown:         BurndownPoint[]
}

export function calculateMetrics(
  tasks: TaskWithAssignees[],
  endDate: Date,
  startDate: Date
): ProjectMetrics {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const total      = tasks.length
  const done       = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const todo       = tasks.filter(t => t.status === 'todo').length
  const overdue    = tasks.filter(
    t => t.status !== 'done' && t.due_date && new Date(t.due_date) < now
  ).length

  const pct      = total > 0 ? Math.round((done / total) * 100) : 0
  const pending  = total - done

  // Días transcurridos y restantes con fechas UTC absolutas
  const startMs   = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const endMs     = Date.UTC(endDate.getFullYear(),   endDate.getMonth(),   endDate.getDate())
  const nowMs     = Date.UTC(now.getFullYear(),        now.getMonth(),       now.getDate())

  const daysElapsed = Math.max(0, Math.round((nowMs - startMs) / 86_400_000))
  const daysLeft    = Math.max(0, Math.round((endMs - nowMs)   / 86_400_000))

  const velocityActual   = daysElapsed > 0 ? +(done / daysElapsed).toFixed(2) : 0
  const velocityRequired = daysLeft    > 0 ? +(pending / daysLeft).toFixed(2) : 0
  const atRisk           = velocityRequired > velocityActual && daysLeft < 14

  return {
    total, done, inProgress, todo, overdue, pct, daysLeft, atRisk,
    velocityActual, velocityRequired, pending,
    phaseReal: calculatePhaseProgress(tasks),
    burndown:  calculateBurndown(tasks, startDate, endDate),
  }
}
```

---

# FASE 11: Seguridad de Headers HTTP

## El debate

> **Diego**: Los headers de seguridad no son opcionales. Sin `Content-Security-Policy`, cualquier script inyectado en el DOM puede robar tokens de auth. Sin `X-Frame-Options`, tu app puede embeberse en un iframe de otro dominio (clickjacking). Con Vercel, se configuran en `next.config.ts`.
>
> **Sebastián**: CSP con Next.js es complicado porque los scripts inline de Next.js (el hydration bootstrap, el theme script) necesitan estar permitidos. La solución es usar nonces generados por request o `'unsafe-inline'` para scripts (menos seguro pero funcional). Para producción seria, usar nonces.
>
> **Valentina**: Y `Permissions-Policy` deshabilita APIs del browser que no usas. Si no usas geolocation ni camera, deshabilitarlas previene que un script malicioso las acceda.

## Paso 11.1 — Headers de seguridad

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requiere esto
      "style-src 'self' 'unsafe-inline'",                 // Tailwind inline styles
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://api.voyageai.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: securityHeaders,
    }]
  },
}
export default nextConfig
```

---

# FASE 12: Observabilidad con Sentry

## El debate

> **Valentina**: Sentry para el agente IA tiene un uso específico: `addBreadcrumb` para trazar el flujo sin exponer datos del usuario. `captureException` para errores del LLM. NO usar `captureMessage` para cada mensaje del usuario — eso es un data leak de conversaciones privadas.
>
> **Diego**: Y `SENTRY_AUTH_TOKEN` nunca en el frontend. El source map upload es un paso de build (CI/CD), no runtime. Con Next.js 15+, el `withSentryConfig` wrappea el build automáticamente.
>
> **Sebastián**: Los eventos custom (`task.created`, `agent.tool_called`, `chat.completion`) son breadcrumbs, no events. Un breadcrumb se acumula en el contexto del error siguiente — si hay un fallo en el agente después de hacer tool calling, el breadcrumb te dice qué tool se usó.

## Paso 12.1 — Configuración de Sentry

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:              process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment:      process.env.NODE_ENV,
  // No capturar PII
  beforeSend(event) {
    // Limpiar headers que pueden contener tokens
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return event
  },
})
```

```typescript
// Uso correcto en Server Actions:
import * as Sentry from '@sentry/nextjs'

// ✅ Breadcrumb de auditoría (no expone datos)
Sentry.addBreadcrumb({
  category: 'task',
  message: 'task.created',
  data: { taskId: data.id, status, priority },  // IDs y enums, no contenido
  level: 'info',
})

// ✅ Capturar errores DB con contexto
Sentry.captureException(error, {
  tags: { component: 'task.actions', operation: 'create' },
})

// ❌ NUNCA: capturar el contenido del mensaje del usuario
// Sentry.captureMessage(message)  ← data leak
```

---

# FASE 13: Testing — La Red de Seguridad

## El debate

> **Sebastián**: Los mocks de Supabase en tests unitarios son una trampa: si mockeas el cliente completo, estás testeando que tu mock funciona, no que tu código funciona. El patrón correcto es mockear solo las funciones de alto nivel (`createClient`, `getAuthUser`) y testear la lógica de tu código.
>
> **Diego**: Y los tests E2E deben correr contra la base de datos real de staging, no contra mocks. Si tus migraciones tienen un bug de RLS, los tests unitarios no lo detectan — el E2E sí, porque hace queries reales contra Supabase.
>
> **Valentina**: Para el agente IA, testear el loop completo es caro (llama APIs externas). La estrategia es: testear `detectStructuralIntent`, `mergeResults`, `buildContextBlock`, `buildSystemPrompt` (funciones puras) en unitarios. El loop completo del agente en E2E, con cuenta de test real.

## Paso 13.1 — Vitest: setup y mocks

```typescript
// src/test/setup.ts
import { vi, beforeEach } from 'vitest'

// Mock global de Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/get-user', () => ({
  getAuthUser: vi.fn(),
}))

// Mock de next/cache para Server Actions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Helper para construir el mock de Supabase con chainable API
export function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    from:       vi.fn().mockReturnThis(),
    select:     vi.fn().mockReturnThis(),
    insert:     vi.fn().mockReturnThis(),
    update:     vi.fn().mockReturnThis(),
    delete:     vi.fn().mockReturnThis(),
    eq:         vi.fn().mockReturnThis(),
    order:      vi.fn().mockReturnThis(),
    limit:      vi.fn().mockReturnThis(),
    single:     vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
  return chain
}
```

```typescript
// src/actions/__tests__/task.actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient }    from '@/lib/supabase/server'
import { getAuthUser }     from '@/lib/supabase/get-user'
import { makeSupabaseMock } from '@/test/setup'
import { createTask }      from '@/actions/task.actions'

const mockCreateClient = vi.mocked(createClient)
const mockGetAuthUser  = vi.mocked(getAuthUser)

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue({ id: 'user-123' } as ReturnType<typeof getAuthUser> extends Promise<infer T> ? T : never)
  })

  it('retorna error si el usuario no está autenticado', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const result = await createTask({ title: 'Test' })
    expect(result).toEqual({ success: false, error: 'No autenticado' })
  })

  it('retorna error si title está vacío', async () => {
    const result = await createTask({ title: '' })
    expect(result.success).toBe(false)
  })

  it('crea tarea con datos válidos', async () => {
    const mockTask = { id: 'task-1', title: 'Mi tarea', status: 'todo', priority: 'medium', position: 1000 }
    const supabaseMock = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
    })
    mockCreateClient.mockResolvedValue(supabaseMock as unknown as Awaited<ReturnType<typeof createClient>>)

    const result = await createTask({ title: 'Mi tarea' })
    expect(result.success).toBe(true)
  })
})
```

## Paso 13.2 — Configuración de cobertura mínima

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines:      70,
        functions:  70,
        branches:   70,
        statements: 70,
      },
      include: [
        'src/actions/**/*.ts',
        'src/lib/**/*.ts',
        'src/hooks/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/types/**',
      ],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

---

# FASE 14: CI/CD — El Pipeline Completo

## El debate

> **Diego**: El pipeline CI no es opcional para producción. Si haces `git push` directo a main sin CI, una línea TypeScript con error puede deployar a producción. El orden del pipeline importa: lint y tsc ANTES de tests (son más rápidos), tests ANTES de build (el build tarda más), Lighthouse DESPUÉS de build (necesita el bundle real).
>
> **Sebastián**: Y el deploy automático solo cuando CI pasa verde. `vercel deploy --prebuilt --prod` usa el artefacto que ya buildó CI — no vuelve a buildear en Vercel, lo que ahorra 3-5 minutos y garantiza que lo que testeaste es lo que se deployó.
>
> **Valentina**: Los secrets en GitHub Actions necesitan manejo cuidadoso. `SUPABASE_SERVICE_ROLE_KEY` en CI es necesario para los E2E (crean datos de prueba), pero debe estar en un environment protegido de GitHub que solo se activa en branches específicos.

## Paso 14.1 — GitHub Actions workflow completo

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  ci:
    name: Quality Gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Gate 1: TypeScript (falla si hay errores de tipos)
      - name: Type check
        run: npx tsc --noEmit

      # Gate 2: ESLint (0 warnings permitidos)
      - name: Lint
        run: npm run lint
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      # Gate 3: Tests unitarios con cobertura
      - name: Unit tests + coverage
        run: npm run test:coverage
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          VOYAGE_API_KEY: ${{ secrets.VOYAGE_API_KEY }}
          EMBED_INTERNAL_SECRET: ${{ secrets.EMBED_INTERNAL_SECRET }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
          NEXT_PUBLIC_APP_URL: http://localhost:3000

      # Gate 4: Build de producción
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          VOYAGE_API_KEY: ${{ secrets.VOYAGE_API_KEY }}
          EMBED_INTERNAL_SECRET: ${{ secrets.EMBED_INTERNAL_SECRET }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}

      # Gate 5: Lighthouse CI (performance budgets)
      - name: Lighthouse CI
        run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

  deploy-production:
    name: Deploy to Production
    needs: ci
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production   # Environment protegido en GitHub

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Pull Vercel config
        run: npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build for Vercel
        run: npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy prebuilt artifact
        run: npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

> **Diego** (configuración de environment en GitHub): El environment `production` en GitHub (Settings → Environments) puede requerir aprobación manual antes de deployar. Para un SaaS real, configurar al menos un reviewer requerido — nadie debería poder deployar a producción sin revisión, incluso si es la misma persona.

---

# FASE 15: Onboarding — La Primera Impresión

## El debate

> **Sebastián**: El onboarding modal tiene una decisión de UX con implicaciones técnicas: ¿localStorage o DB? Si guardas en DB, el onboarding persiste entre dispositivos pero requiere una query extra al cargar. Si guardas en localStorage, es más rápido pero el usuario lo ve de nuevo en otro dispositivo.
>
> **Valentina**: El demo project seeding (`seedDemoProject` Server Action) es el momento de mayor carga de todo el flujo de onboarding. Crear 12-15 tareas de una vez, embeddings para todas. Debe ser async — mostrar progress en el modal, no bloquear.
>
> **Diego**: Y las tareas del demo deben ser del usuario — `user_id = auth.uid()`. Si el seed crea tareas "genéricas" sin user_id, o peor, con el user_id de un admin de sistema, el RLS expone esas tareas a todos.

## Paso 15.1 — Onboarding modal con seedDemoProject

```typescript
// src/actions/project.actions.ts
'use server'

export async function seedDemoProject(): Promise<ActionResult<{ projectId: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  // Crear proyecto demo
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,          // SIEMPRE user_id del usuario actual
      name: 'Proyecto Demo — Olist E-commerce',
      delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    .select()
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Error al crear proyecto demo' }
  }

  // Crear tareas demo
  const demoTasks = [
    { title: 'Análisis exploratorio de datos (EDA)', status: 'done',        priority: 'high'   },
    { title: 'Limpieza y normalización de datos',   status: 'done',        priority: 'high'   },
    { title: 'Modelo de predicción de ventas',      status: 'in_progress', priority: 'high'   },
    { title: 'Dashboard de métricas KPI',           status: 'in_progress', priority: 'medium' },
    { title: 'API de recomendaciones',              status: 'todo',        priority: 'medium' },
    { title: 'Testing de modelos ML',               status: 'todo',        priority: 'low'    },
  ] as const

  const tasksToInsert = demoTasks.map((t, i) => ({
    user_id:    user.id,        // SIEMPRE
    project_id: project.id,
    title:      t.title,
    status:     t.status,
    priority:   t.priority,
    position:   (i + 1) * 1000,
  }))

  const { data: tasks } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  // Trigger embeddings en paralelo (fire-and-forget)
  if (tasks) {
    for (const task of tasks) {
      void triggerEmbedding(task.id, user.id, task.title, null)
    }
  }

  revalidatePath('/board')
  return { success: true, data: { projectId: project.id } }
}
```

---

# FASE 16: Checklist Pre-Deploy a Producción

## El debate final

> **Diego**: Antes de cada deploy a producción, debe existir un checklist ejecutado por un humano, no solo CI. CI verifica el código. El checklist verifica la infraestructura: ¿las variables de entorno están configuradas en Vercel? ¿Las migraciones corrieron en la DB de producción? ¿RLS está activo en todas las tablas?
>
> **Valentina**: Y verificar que los modelos de IA son los correctos. Si GROQ_API_KEY apunta a un proyecto de desarrollo con rate limits bajos, producción se cae en hora pico. Voyage AI también — verificar que la API key de producción tiene el plan correcto para el volumen esperado.
>
> **Sebastián**: El test de humo post-deploy: abrir la URL de producción, hacer login, crear una tarea, verla aparecer en el Kanban, preguntar al chat sobre esa tarea. Si ese flujo funciona, el 80% de la aplicación funciona.

## Checklist completo (ejecutar en orden)

### Infraestructura
- [ ] Migraciones 001-010 aplicadas en Supabase producción (`SELECT * FROM supabase_migrations.schema_migrations`)
- [ ] RLS activo en todas las tablas (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — todas deben ser `true`)
- [ ] Índice HNSW creado en `task_embeddings` (`\d task_embeddings` — debe mostrar el índice)
- [ ] `search_tasks_by_embedding` accesible para `authenticated` (`SELECT has_function_privilege('authenticated', 'search_tasks_by_embedding(halfvec, float, int)', 'execute')`)

### Variables de entorno en Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto de producción (no staging)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key de producción
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — service role key (marcar como Sensitive)
- [ ] `GROQ_API_KEY` — key de producción con rate limit adecuado
- [ ] `VOYAGE_API_KEY` — key de producción
- [ ] `EMBED_INTERNAL_SECRET` — 64 chars hex, generado con `openssl rand -hex 32`
- [ ] `NEXT_PUBLIC_APP_URL` — URL real de producción (sin barra final)
- [ ] `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` — base de datos de producción
- [ ] `CRON_SECRET` — para proteger `/api/cron/insights`
- [ ] `NEXT_PUBLIC_SENTRY_DSN` — proyecto de producción en Sentry

### Seguridad
- [ ] `securityheaders.com` → rating A o superior
- [ ] No hay `console.log` con datos de usuarios en producción
- [ ] HMAC funcional: `curl -X POST /api/embed` sin firma → 401
- [ ] Rate limit funcional: 21 requests seguidas a `/api/chat` → 429

### Rendimiento
- [ ] Lighthouse mobile ≥ 90 en Performance, Accessibility, Best Practices, SEO
- [ ] LCP < 2.5s, CLS < 0.1, TBT < 200ms

### Test de humo
1. Login con usuario real de producción
2. Ver tablero cargado con Suspense fallback y luego tareas
3. Crear tarea → aparece en columna correcta
4. Drag-and-drop tarea a otra columna → persiste tras recarga
5. Chat: "¿qué tareas tengo pendientes?" → respuesta con tareas reales
6. Analytics: ver métricas de velocidad
7. Exportar PDF → descarga con narrativo generado

---

# Resumen de Decisiones de los Expertos

| Área | Decisión | Rationale |
|------|----------|-----------|
| Auth middleware | `getUser()` no `getSession()` | `getSession()` no valida JWT contra servidor |
| Middleware response | Devolver `supabaseResponse` | `NextResponse.next()` pierde cookies de auth |
| RLS | Funciones `SECURITY DEFINER` para helpers | Evita recursión infinita en políticas |
| Embeddings | `halfvec(512)` + HNSW | 50% menos espacio, funciona desde fila 1 |
| RAG | Híbrido: intención + vector + rerank | Máxima precisión con menor latencia |
| Agent runtime | `runtime = 'nodejs'` | Edge no soporta streams largos ni todas las APIs |
| Destructive tools | `confirm_required` interceptor | Doble guardrail: técnico + UX |
| System prompt | Reglas negativas explícitas | El LLM respeta restricciones cuando son claras |
| Zod forms | `z.input<>` para useForm, cast al OUTPUT | Defaults hacen que los tipos no coincidan |
| Errores Zod | `.issues[0]?.message` | Zod v4 cambió de `.errors` a `.issues` |
| Posición tareas | `Math.round((prev + next) / 2)` | Inserción O(1) sin renumerar |
| PDF | `jsPDF` programático, sin html2canvas | `oklch()` de Tailwind v4 rompe html2canvas |
| Rate limit | Por `user.id` en endpoints auth | IP compartida genera falsos positivos |
| Tests E2E | DB real de staging | Bugs de RLS son invisibles con mocks |
| CI/CD | Build prebuilt en Vercel | Lo que CI testea es exactamente lo que se deploya |

---

*Guía construida a partir del debate de Diego Vargas, Valentina Torres y Sebastián Mora — sintetizando seguridad, arquitectura de IA y calidad de software en pasos ejecutables.*
