-- Chat sessions (one per conversation thread)
create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Nueva conversación',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Individual messages within a session
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists chat_sessions_user_updated_idx
  on chat_sessions(user_id, updated_at desc);

create index if not exists chat_messages_session_created_idx
  on chat_messages(session_id, created_at asc);

-- Trigger: bump session.updated_at whenever a message is inserted
create or replace function update_chat_session_updated_at()
returns trigger language plpgsql as $$
begin
  update chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$;

create trigger chat_message_bumps_session
  after insert on chat_messages
  for each row execute function update_chat_session_updated_at();

-- RLS
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

create policy "Users manage own chat sessions"
  on chat_sessions for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own chat messages"
  on chat_messages for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
