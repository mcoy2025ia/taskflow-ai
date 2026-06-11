-- Corrige la política de UPDATE en tasks cuyo WITH CHECK era tautológico.
-- 007_collaboration.sql tenía:
--   with check (auth.uid() = user_id or user_id is not null)
-- Como user_id es NOT NULL, la segunda condición es siempre verdadera →
-- un editor podía hacer SET user_id = <cualquier uuid> y robar ownership.

drop policy if exists "Editors del proyecto actualizan tareas" on public.tasks;

create policy "Editors del proyecto actualizan tareas"
  on public.tasks for update
  using  (public.is_project_editor(project_id))
  with check (public.is_project_editor(project_id));

-- Trigger que hace user_id inmutable en updates, ya que WITH CHECK
-- no puede comparar OLD vs NEW directamente en Postgres RLS.
create or replace function public.tasks_prevent_user_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.user_id <> OLD.user_id then
    raise exception 'No se permite cambiar el propietario de una tarea';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_tasks_immutable_user_id on public.tasks;

create trigger trg_tasks_immutable_user_id
  before update on public.tasks
  for each row execute function public.tasks_prevent_user_id_change();
