-- Función para obtener perfiles de miembros de un proyecto
-- SECURITY DEFINER: el llamante solo puede ver miembros de proyectos a los que pertenece.

create or replace function public.get_project_member_profiles(p_project_id uuid)
returns table (
  user_id    uuid,
  full_name  text,
  avatar_url text,
  role       text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    pm.user_id,
    coalesce(pr.full_name, 'Usuario') as full_name,
    pr.avatar_url,
    pm.role
  from public.project_members pm
  left join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = p_project_id
    -- Solo retorna datos si el usuario autenticado es miembro del proyecto
    and public.is_project_member(p_project_id)
  order by pm.joined_at;
$$;

revoke execute on function public.get_project_member_profiles from public, anon;
grant  execute on function public.get_project_member_profiles to authenticated;
