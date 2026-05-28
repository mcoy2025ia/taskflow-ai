-- ── Tablas de colaboración ────────────────────────────────────────────────────

create table if not exists public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.task_assignments (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists project_members_user_idx
  on public.project_members (user_id);

create index if not exists task_assignments_task_idx
  on public.task_assignments (task_id);

create index if not exists task_assignments_user_idx
  on public.task_assignments (user_id);

create index if not exists comments_task_created_idx
  on public.comments (task_id, created_at);

create index if not exists activity_log_project_created_idx
  on public.activity_log (project_id, created_at desc);

-- ── Funciones helper (SECURITY DEFINER para evitar recursión en RLS) ──────────

-- Retorna true si el usuario autenticado es miembro del proyecto
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

-- Retorna true si el usuario tiene rol owner o editor en el proyecto
create or replace function public.is_project_editor(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  );
$$;

-- ── RLS: project_members ──────────────────────────────────────────────────────
-- Usa projects (no project_members) en el subquery del owner para evitar recursión

alter table public.project_members enable row level security;

create policy "Usuarios ven su propia membresía"
  on public.project_members for select
  using (auth.uid() = user_id);

create policy "Owners ven todos los miembros de su proyecto"
  on public.project_members for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Owners gestionan miembros del proyecto"
  on public.project_members for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
        and p.user_id = auth.uid()
    )
  );

-- ── RLS: task_assignments ─────────────────────────────────────────────────────

alter table public.task_assignments enable row level security;

create policy "Miembros ven asignaciones de tareas del proyecto"
  on public.task_assignments for select
  using (
    -- Propietario de la tarea (workspace personal)
    exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id and t.user_id = auth.uid()
    )
    -- Miembro del proyecto al que pertenece la tarea
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.is_project_member(t.project_id)
    )
  );

create policy "Editors gestionan asignaciones de tareas"
  on public.task_assignments for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.is_project_editor(t.project_id)
    )
  );

-- ── RLS: comments ─────────────────────────────────────────────────────────────

alter table public.comments enable row level security;

create policy "Miembros del proyecto ven comentarios"
  on public.comments for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = comments.task_id
        and (
          t.user_id = auth.uid()
          or public.is_project_member(t.project_id)
        )
    )
  );

create policy "Miembros editors crean comentarios"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.tasks t
      where t.id = comments.task_id
        and (
          t.user_id = auth.uid()
          or public.is_project_editor(t.project_id)
        )
    )
  );

create policy "Usuarios eliminan sus propios comentarios"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ── RLS: activity_log ─────────────────────────────────────────────────────────

alter table public.activity_log enable row level security;

create policy "Miembros del proyecto ven actividad"
  on public.activity_log for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = activity_log.project_id and p.user_id = auth.uid()
    )
    or public.is_project_member(activity_log.project_id)
  );

create policy "Usuarios registran su propia actividad"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

-- ── Extender RLS de projects para miembros invitados ─────────────────────────

create policy "Miembros invitados ven el proyecto"
  on public.projects for select
  using (public.is_project_member(id));

create policy "Miembros editors actualizan proyecto"
  on public.projects for update
  using (public.is_project_editor(id));

-- ── Extender RLS de project_phases para miembros invitados ───────────────────

create policy "Miembros invitados ven fases del proyecto"
  on public.project_phases for select
  using (public.is_project_member(project_id));

-- ── Extender RLS de tasks para miembros del proyecto ─────────────────────────

create policy "Miembros del proyecto ven tareas"
  on public.tasks for select
  using (public.is_project_member(project_id));

create policy "Editors del proyecto crean tareas"
  on public.tasks for insert
  with check (
    -- user_id debe ser el usuario autenticado (siempre)
    auth.uid() = user_id
    and public.is_project_editor(project_id)
  );

create policy "Editors del proyecto actualizan tareas"
  on public.tasks for update
  using (public.is_project_editor(project_id))
  with check (auth.uid() = user_id or user_id is not null);

-- ── Actualizar search_tasks_by_embedding para proyectos compartidos ───────────
-- Reemplaza la versión de 004 para incluir tareas de proyectos compartidos

create or replace function public.search_tasks_by_embedding(
  query_embedding halfvec(512),
  match_threshold float default 0.7,
  match_count     int    default 5
)
returns table (
  task_id     uuid,
  title       text,
  description text,
  status      task_status,
  priority    task_priority,
  similarity  float
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.id          as task_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    1 - (te.embedding <=> query_embedding) as similarity
  from task_embeddings te
  inner join tasks t on t.id = te.task_id
  where
    -- Tarea propia (workspace personal) O miembro del proyecto
    (te.user_id = auth.uid() or public.is_project_member(t.project_id))
    and (t.user_id = auth.uid() or public.is_project_member(t.project_id))
    and 1 - (te.embedding <=> query_embedding) >= match_threshold
  order by te.embedding <=> query_embedding
  limit match_count;
$$;

-- ── Backfill: registrar owners actuales en project_members ───────────────────

insert into public.project_members (project_id, user_id, role)
select id, user_id, 'owner'
from public.projects
on conflict (project_id, user_id) do nothing;
