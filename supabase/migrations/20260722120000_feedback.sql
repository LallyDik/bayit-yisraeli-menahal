-- User feedback submitted from the footer dialog.
--
-- RLS is enabled with no policies at all, which denies every request that
-- carries a user or anon JWT. That is deliberate: the anon key ships in the
-- browser bundle, so an insert policy for anon would hand anyone on the
-- internet a write endpoint into this table. The submit-feedback Edge Function
-- writes here with the service role, which bypasses RLS, and validates first.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  message     text not null,
  page        text,
  user_agent  text,
  constraint feedback_message_length check (char_length(message) between 1 and 2000)
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
