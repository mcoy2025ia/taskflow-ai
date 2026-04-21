-- Función RLS-safe para búsqueda semántica
-- SECURITY DEFINER: se ejecuta con privilegios del owner (postgres)
-- pero aplica el filtro user_id internamente → usuarios solo ven sus tareas
create or replace function public.search_tasks_by_embedding(
  query_embedding halfvec(1024),
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
    -- cosine similarity: 1 - distancia coseno
    1 - (te.embedding <=> query_embedding) as similarity
  from task_embeddings te
  inner join tasks t on t.id = te.task_id
  where
    -- RLS aplicado manualmente: solo tareas del usuario autenticado
    te.user_id = auth.uid()
    and t.user_id = auth.uid()
    -- Filtrar por threshold antes de ordenar (performance)
    and 1 - (te.embedding <=> query_embedding) >= match_threshold
  order by te.embedding <=> query_embedding
  limit match_count;
$$;

-- Función para upsert de embedding (usada desde service_role)
create or replace function public.upsert_task_embedding(
  p_task_id      uuid,
  p_user_id      uuid,
  p_embedding    halfvec(1024),
  p_content_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into task_embeddings (task_id, user_id, embedding, content_hash)
  values (p_task_id, p_user_id, p_embedding, p_content_hash)
  on conflict (task_id) do update
    set embedding    = excluded.embedding,
        content_hash = excluded.content_hash,
        created_at   = now()
  -- Solo actualizar si el contenido cambió (evita re-embedding innecesario)
  where task_embeddings.content_hash != excluded.content_hash;
end;
$$;

-- Revocar ejecución pública de funciones sensibles
revoke execute on function public.upsert_task_embedding from public, anon, authenticated;
grant  execute on function public.upsert_task_embedding to service_role;

-- search_tasks_by_embedding sí es accesible para usuarios autenticados
revoke execute on function public.search_tasks_by_embedding from public, anon;
grant  execute on function public.search_tasks_by_embedding to authenticated;