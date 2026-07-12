-- 1. Asegurar que la extensión para UUIDs esté activa en el esquema correcto
create extension if not exists "uuid-ossp" with schema extensions;

-- 2. Creación de ENUMs limpios (sin "if not exists" que rompe Postgres)
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');

-- 3. Creación de la tabla principal
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  status      public.task_status not null default 'todo',
  priority    public.task_priority not null default 'medium',
  position    integer not null default 0,
  due_date    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 4. Índices para el Kanban
create index if not exists tasks_user_status_position_idx
  on public.tasks (user_id, status, position);

create index if not exists tasks_user_created_idx
  on public.tasks (user_id, created_at desc);

-- 5. Función y Trigger para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- 6. Habilitar y configurar RLS de forma hermética
alter table public.tasks enable row level security;

drop policy if exists "Usuarios ven solo sus tareas" on public.tasks;
create policy "Usuarios ven solo sus tareas"
  on public.tasks for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios crean sus propias tareas" on public.tasks;
create policy "Usuarios crean sus propias tareas"
  on public.tasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios actualizan solo sus tareas" on public.tasks;
create policy "Usuarios actualizan solo sus tareas"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios eliminan solo sus tareas" on public.tasks;
create policy "Usuarios eliminan solo sus tareas"
  on public.tasks for delete
  using (auth.uid() = user_id);