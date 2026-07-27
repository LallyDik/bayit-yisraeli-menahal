-- Per-landlord timing: how many days before due a charge shows as "due" in the
-- app, and how many days after due the reminder email goes out. Additive; the
-- existing notification_settings RLS covers the new columns.
alter table public.notification_settings
  add column if not exists open_days_before integer not null default 3
    check (open_days_before between 0 and 30),
  add column if not exists reminder_offset_days integer not null default 0
    check (reminder_offset_days between 0 and 30);
