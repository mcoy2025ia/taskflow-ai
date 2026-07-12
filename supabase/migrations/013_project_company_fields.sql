-- Metadata de organización para proyectos (empresa cliente + área solicitante)
alter table public.projects
  add column if not exists company text,
  add column if not exists department text;
