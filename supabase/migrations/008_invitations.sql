-- ── Tabla de invitaciones pendientes ─────────────────────────────────────────

create table if not exists public.pending_invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  email       text not null check (char_length(email) <= 254),
  role        text not null check (role in ('editor', 'viewer')),
  token       text not null unique,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists pending_invitations_token_idx
  on public.pending_invitations (token);

create index if not exists pending_invitations_project_idx
  on public.pending_invitations (project_id, accepted_at)
  where accepted_at is null;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.pending_invitations enable row level security;

-- Owners del proyecto gestionan sus invitaciones
create policy "Owners gestionan invitaciones"
  on public.pending_invitations for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    or invited_by = auth.uid()
  );

-- ── SECURITY DEFINER: lookup y accept por token ───────────────────────────────
-- Estas funciones permiten operar con el token sin exponer la tabla directamente.

create or replace function public.get_invitation_by_token(p_token text)
returns table (
  invitation_id   uuid,
  project_id      uuid,
  project_name    text,
  role            text,
  invited_email   text,
  expires_at      timestamptz,
  accepted_at     timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    pi.id,
    pi.project_id,
    proj.name,
    pi.role,
    pi.email,
    pi.expires_at,
    pi.accepted_at
  from public.pending_invitations pi
  inner join public.projects proj on proj.id = pi.project_id
  where pi.token = p_token;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid   -- returns project_id for redirect
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.pending_invitations%rowtype;
begin
  select * into v_inv
  from public.pending_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Invitación no encontrada';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'La invitación ha expirado';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esta invitación ya fue aceptada';
  end if;

  -- Add user to project_members (upsert: if already member, update role)
  insert into public.project_members (project_id, user_id, role)
  values (v_inv.project_id, auth.uid(), v_inv.role)
  on conflict (project_id, user_id) do update set role = excluded.role;

  -- Mark invitation accepted
  update public.pending_invitations
  set accepted_at = now()
  where id = v_inv.id;

  return v_inv.project_id;
end;
$$;

-- Revocar ejecución pública — solo usuarios autenticados
revoke execute on function public.get_invitation_by_token from public, anon;
grant  execute on function public.get_invitation_by_token to authenticated;

revoke execute on function public.accept_invitation from public, anon;
grant  execute on function public.accept_invitation to authenticated;
