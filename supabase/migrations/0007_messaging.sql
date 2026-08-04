-- Run in Supabase SQL Editor after previous migrations.
-- Phase 7 — internal team communication (1:1, groups, department chats,
-- company discussion threads, file/image sharing, read receipts).
--
-- Typing indicators use Supabase Realtime Broadcast (ephemeral, no table
-- needed) — wired client-side only. Task comments already exist via the
-- `task_notes` table from Phase 0, so this migration doesn't duplicate that.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group', 'department', 'company')),
  title text,
  department text,
  company_id uuid references public.companies (id) on delete cascade,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  content text,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- A user can see a conversation only if they're a participant in it.
drop policy if exists "participants read their conversations" on public.conversations;
create policy "participants read their conversations" on public.conversations
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated can create conversations" on public.conversations;
create policy "authenticated can create conversations" on public.conversations
  for insert to authenticated with check (true);

-- Participants: you can see the participant list of conversations you're
-- in, and you can add yourself/others when creating a conversation.
drop policy if exists "see participants of own conversations" on public.conversation_participants;
create policy "see participants of own conversations" on public.conversation_participants
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants me
      where me.conversation_id = conversation_participants.conversation_id
        and me.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated can add participants" on public.conversation_participants;
create policy "authenticated can add participants" on public.conversation_participants
  for insert to authenticated with check (true);

drop policy if exists "users update their own participant row" on public.conversation_participants;
create policy "users update their own participant row" on public.conversation_participants
  for update to authenticated using (user_id = auth.uid());

-- Messages: only participants can read or send.
drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;

create index if not exists idx_conv_participants_user on public.conversation_participants (user_id);
create index if not exists idx_conv_participants_conv on public.conversation_participants (conversation_id);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);

-- Stream new messages live to everyone subscribed.
alter publication supabase_realtime add table public.messages;

-- ── Storage bucket for shared files/images/documents in chat ───────────────
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

drop policy if exists "authenticated upload chat files" on storage.objects;
create policy "authenticated upload chat files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-attachments');

drop policy if exists "anyone can view chat files" on storage.objects;
create policy "anyone can view chat files" on storage.objects
  for select using (bucket_id = 'message-attachments');
