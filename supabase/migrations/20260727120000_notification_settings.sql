-- Per-landlord email preferences. RLS lets each owner read/write only their
-- own row (the settings page uses the anon key with a user JWT). The
-- unsubscribe edge function flips email_reminders off via the service role,
-- looked up by the stable unsubscribe_token.
create table if not exists public.notification_settings (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  email_reminders   boolean not null default true,
  unsubscribe_token text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at        timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy "notification_settings_select_own" on public.notification_settings
  for select using (owner_id = auth.uid());
create policy "notification_settings_insert_own" on public.notification_settings
  for insert with check (owner_id = auth.uid());
create policy "notification_settings_update_own" on public.notification_settings
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
