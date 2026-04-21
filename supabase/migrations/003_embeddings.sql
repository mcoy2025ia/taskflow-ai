-- Habilitar pgvector
create extension if not exists vector;

create table if not exists public.task_embeddings (
  id           uuid primary key default uuid_generate_v4(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- halfvec(1024): Voyage AI voyage-3.5 produce 1024 dimensiones
  -- halfvec usa 16-bit floats → mitad de memoria que vector(1024)
  embedding    halfvec(1024) not null,
  -- Hash del contenido para detectar cambios y evitar re-embedding innecesario
  content_hash text not null,
  created_at   timestamptz not null default now(),
  -- Un solo embedding por tarea
  constraint task_embeddings_task_id_unique unique (task_id)
);

-- Índice HNSW: mejor performance en búsqueda aproximada de vecinos
-- m=16: conexiones por nodo (más = más preciso, más RAM)
-- ef_construction=64: precisión en construcción (más = más lento en insert, más preciso en search)
-- operator class: halfvec_cosine_ops para distancia coseno (ideal para embeddings semánticos)
create index if not exists task_embeddings_hnsw_idx
  on public.task_embeddings
  using hnsw (embedding halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Índice adicional para lookup por task_id y user_id
create index if not exists task_embeddings_user_idx
  on public.task_embeddings (user_id, task_id);

-- RLS — user_id en embeddings espeja RLS de tasks
alter table public.task_embeddings enable row level security;

create policy "Usuarios ven solo sus embeddings"
  on public.task_embeddings for select
  using (auth.uid() = user_id);

-- INSERT y UPDATE solo desde service_role (pipeline de embeddings en API Route)
-- El anon key NUNCA puede escribir en esta tabla directamente
create policy "Solo service_role inserta embeddings"
  on public.task_embeddings for insert
  with check (false);  -- bloqueado para anon/authenticated

create policy "Solo service_role actualiza embeddings"
  on public.task_embeddings for update
  using (false);