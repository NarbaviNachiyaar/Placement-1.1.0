-- Run in Supabase SQL Editor after previous migrations.
-- Adds a dedicated storage bucket for announcement images, using the same
-- pattern already established for message attachments (0007).

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

drop policy if exists "authenticated upload announcement images" on storage.objects;
create policy "authenticated upload announcement images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'announcement-images');

drop policy if exists "anyone can view announcement images" on storage.objects;
create policy "anyone can view announcement images" on storage.objects
  for select using (bucket_id = 'announcement-images');

alter table public.announcements
  add column if not exists image_url text;
