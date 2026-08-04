-- Run in Supabase SQL Editor after previous migrations.
-- Phase 3 — extended user profile fields (staff fields common to everyone,
-- plus Placement Coordinator / student-specific fields).

alter table public.profiles
  add column if not exists alternate_phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists emergency_contact text,
  add column if not exists blood_group text,
  add column if not exists joining_date date,
  add column if not exists designation text,
  -- Placement Coordinator / student fields
  add column if not exists student_id text,
  add column if not exists roll_number text,
  add column if not exists course text,
  add column if not exists academic_year text,
  add column if not exists semester text,
  add column if not exists section text,
  add column if not exists batch text,
  add column if not exists parent_name text,
  add column if not exists parent_phone text,
  add column if not exists parent_email text,
  add column if not exists hostel_or_day_scholar text,
  add column if not exists faculty_mentor text;
