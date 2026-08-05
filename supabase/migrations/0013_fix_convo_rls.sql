-- Run in Supabase SQL Editor after previous migrations.
--
-- Bug: "infinite recursion detected in policy for relation
-- conversation_participants". The old policy checked membership by
-- querying conversation_participants FROM WITHIN a policy that protects
-- conversation_participants itself — Postgres has to re-evaluate the same
-- policy to answer that question, forever. This cascaded into failures on
-- conversations and messages too, since their policies check membership
-- via this same broken table.
--
-- Fix: move the membership check into a SECURITY DEFINER function. Functions
-- like this run with elevated privileges that bypass RLS internally, so the
-- self-reference no longer loops.

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists "see participants of own conversations" on public.conversation_participants;
create policy "see participants of own conversations" on public.conversation_participants
  for select to authenticated using (
    public.is_conversation_participant(conversation_id)
  );

drop policy if exists "participants read their conversations" on public.conversations;
create policy "participants read their conversations" on public.conversations
  for select to authenticated using (
    created_by = auth.uid() or public.is_conversation_participant(id)
  );

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated using (
    public.is_conversation_participant(conversation_id)
  );

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
  );