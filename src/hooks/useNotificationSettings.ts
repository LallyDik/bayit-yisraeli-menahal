import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function useNotificationSettings() {
  const { user } = useAuth();
  const [emailReminders, setEmailReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    supabase.from('notification_settings').select('email_reminders').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setEmailReminders(data.email_reminders);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const save = useCallback(async (value: boolean) => {
    if (!user) return;
    const prev = emailReminders;
    setSaving(true);
    setEmailReminders(value); // optimistic
    const { error } = await supabase.from('notification_settings')
      .upsert({ owner_id: user.id, email_reminders: value, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    setSaving(false);
    if (error) { setEmailReminders(prev); throw error; }
  }, [user, emailReminders]);

  return { emailReminders, loading, saving, save };
}
