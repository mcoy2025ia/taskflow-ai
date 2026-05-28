-- Habilitar Realtime en las tablas de colaboración
-- Requiere que Realtime esté activado en el proyecto de Supabase
-- (Dashboard → Database → Replication → Source Tables)

-- Añadir tablas al publication de Realtime
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_assignments;

-- Realtime RLS: los cambios solo se envían a usuarios con permiso de SELECT
-- Las políticas RLS existentes filtran automáticamente los eventos de Realtime.
-- No se necesita configuración adicional para usuarios autenticados.
