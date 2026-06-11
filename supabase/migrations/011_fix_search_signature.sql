-- Realinea la firma de search_tasks_by_embedding con lo que rag.ts invoca.
-- 007_collaboration.sql dejó la función con (match_threshold, sin p_user_id),
-- pero rag.ts llama con (similarity_threshold, p_user_id). PostgREST resuelve
-- RPCs por nombre de parámetro: en una DB recién migrada esto lanza PGRST202,
-- searchTasksBySemantic lo captura silenciosamente y retorna [] → RAG roto.

drop function if exists public.search_tasks_by_embedding(halfvec(512), float, int);

create or replace function public.search_tasks_by_embedding(
  query_embedding      halfvec(512),
  similarity_threshold float default 0.3,
  match_count          int   default 20,
  p_user_id            uuid  default null
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
    (te.user_id = coalesce(p_user_id, auth.uid())
      or public.is_project_member(t.project_id))
    and (t.user_id = coalesce(p_user_id, auth.uid())
      or public.is_project_member(t.project_id))
    and 1 - (te.embedding <=> query_embedding) >= similarity_threshold
  order by te.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.search_tasks_by_embedding from public, anon;
grant  execute on function public.search_tasks_by_embedding to authenticated;
