-- ── Tabla de proyectos ────────────────────────────────────────────────────────
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  start_date    date not null,
  delivery_date date not null,
  created_at    timestamptz not null default now()
);

-- ── Fases del proyecto ────────────────────────────────────────────────────────
create table if not exists public.project_phases (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  total       int  not null default 0,
  done        int  not null default 0,
  color       text not null default '#6366f1',
  sort_order  int  not null default 0
);

-- ── Vincular tareas a proyecto ────────────────────────────────────────────────
alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

-- ── Índices ───────────────────────────────────────────────────────────────────
create index if not exists projects_user_idx
  on public.projects (user_id);

create index if not exists project_phases_project_idx
  on public.project_phases (project_id, sort_order);

create index if not exists tasks_project_idx
  on public.tasks (project_id) where project_id is not null;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.projects      enable row level security;
alter table public.project_phases enable row level security;

create policy "Usuarios ven sus proyectos"
  on public.projects for select using (auth.uid() = user_id);

create policy "Usuarios crean sus proyectos"
  on public.projects for insert with check (auth.uid() = user_id);

create policy "Usuarios actualizan sus proyectos"
  on public.projects for update using (auth.uid() = user_id);

create policy "Usuarios eliminan sus proyectos"
  on public.projects for delete using (auth.uid() = user_id);

create policy "Usuarios ven fases de sus proyectos"
  on public.project_phases for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

create policy "Usuarios gestionan fases de sus proyectos"
  on public.project_phases for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

-- ── Backfill: crear proyecto Olist para usuarios existentes ───────────────────
-- Inserta el proyecto sólo si el usuario no tiene ninguno aún
insert into public.projects (user_id, name, start_date, delivery_date)
select
  u.id,
  'Pipeline Olist',
  '2025-02-27',
  '2025-05-12'
from auth.users u
where not exists (
  select 1 from public.projects p where p.user_id = u.id
);

-- Vincular tareas existentes a su proyecto (primer proyecto del usuario)
update public.tasks t
set project_id = (
  select p.id from public.projects p
  where p.user_id = t.user_id
  order by p.created_at
  limit 1
)
where t.project_id is null;

-- Seed de fases para cada proyecto recién creado
insert into public.project_phases (project_id, name, total, done, color, sort_order)
select
  p.id,
  phase.name,
  phase.total,
  phase.done,
  phase.color,
  phase.sort_order
from public.projects p
cross join (values
  ('Bronze (6)',       6, 6, '#cd7f32', 1),
  ('Silver (6)',       6, 6, '#94a3b8', 2),
  ('Gold (3)',         3, 0, '#f59e0b', 3),
  ('Feature Eng. (4)',4, 0, '#8b5cf6', 4),
  ('ML (2+3)',         5, 0, '#3b82f6', 5),
  ('Dashboard (3)',    3, 0, '#10b981', 6),
  ('Informe (2)',      2, 0, '#ef4444', 7)
) as phase(name, total, done, color, sort_order)
where not exists (
  select 1 from public.project_phases pp where pp.project_id = p.id
);
