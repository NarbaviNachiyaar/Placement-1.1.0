-- Run in Supabase SQL Editor after previous migrations.
--
-- Bug: creating any conversation (DM, group, department chat, company
-- thread) silently failed. The code creates the conversation row, then
-- immediately reads it back to get its ID, THEN adds participants — but
-- the old SELECT policy only allowed participants to see a conversation,
-- and at that read-back moment no participant rows exist yet. This adds
-- "or you created it" as an alternate path, so the read-back succeeds.

drop policy if exists "participants read their conversations" on public.conversations;
create policy "participants read their conversations" on public.conversations
  for select to authenticated using (
    created_by = auth.uid()
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );