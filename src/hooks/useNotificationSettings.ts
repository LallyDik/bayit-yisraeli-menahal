import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type Settings = { email_reminders: boolean; open_days_before: number; reminder_offset_days: number };
const DEFAULTS: Settings = { email_reminders: true, open_days_before: 3, reminder_offset_days: 0 };

export function useNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    supabase.from('notification_settings')
      .select('email_reminders, open_days_before, reminder_offset_days')
      .eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setSettings({
          email_reminders: data.email_reminders,
          open_days_before: data.open_days_before,
          reminder_offset_days: data.reminder_offset_days,
        });
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const save = useCallback(async (patch: Partial<Settings>) => {
    if (!user) return;
    const prev = settings;
    setSaving(true);
    setSettings((s) => ({ ...s, ...patch })); // optimistic
    const { error } = await supabase.from('notification_settings')
      .upsert({ owner_id: user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    setSaving(false);
    if (error) { setSettings(prev); throw error; }
  }, [user, settings]);

  return {
    emailReminders: settings.email_reminders,
    openDaysBefore: settings.open_days_before,
    reminderOffsetDays: settings.reminder_offset_days,
    loading, saving, save,
  };
}
