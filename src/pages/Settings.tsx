import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const { emailReminders, loading, saving, save } = useNotificationSettings();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const onToggle = async (value: boolean) => {
    try {
      await save(value);
      toast.success(value ? 'תקבלו תזכורות תשלום במייל.' : 'ביטלת קבלת תזכורות תשלום במייל.');
    } catch {
      toast.error('לא הצלחנו לשמור את ההגדרה. נסו שוב.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>הגדרות | ניהול שכירות</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl">ניהול שכירות</span>
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה למערכת
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <h1 className="font-display text-3xl">הגדרות</h1>
        <p className="mt-1 text-muted-foreground">ניהול ההעדפות של החשבון שלך.</p>
        <Card className="mt-6 rounded-2xl">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <Label htmlFor="email-reminders" className="text-base">תזכורות תשלום במייל</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                קבלת מייל תקופתי על חיובים שהגיע מועדם ועדיין לא סומנו כשולמו.
              </p>
            </div>
            <Switch
              id="email-reminders"
              checked={emailReminders}
              disabled={loading || saving}
              onCheckedChange={onToggle}
              aria-label="קבלת תזכורות תשלום במייל"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
