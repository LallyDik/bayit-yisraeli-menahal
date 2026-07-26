import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Reached from the reset link in the email. Supabase parses the recovery token
// from the URL, opens a temporary session and fires PASSWORD_RECOVERY; this page
// then lets the user set a new password via updateUser.
const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('הסיסמה חייבת לכלול לפחות 6 תווים.'); return; }
    if (password !== confirm) { toast.error('הסיסמאות אינן תואמות.'); return; }
    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('הסיסמה עודכנה. אתם מחוברים.');
      navigate('/');
    } catch {
      toast.error('לא הצלחנו לעדכן את הסיסמה. ייתכן שהקישור פג. בקשו איפוס חדש.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Helmet>
        <title>איפוס סיסמה | ניהול שכירות</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Card className="w-full max-w-md rounded-[2rem] border-border border-t-4 border-t-primary shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display text-foreground">איפוס סיסמה</CardTitle>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : !ready ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">הקישור לאיפוס אינו תקין או שפג תוקפו.</p>
              <Button asChild variant="link" className="text-primary">
                <Link to="/">חזרה למסך ההתחברות</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="new-password" type={showPassword ? 'text' : 'password'} value={password}
                    required minLength={6} autoComplete="new-password" className="pe-11 text-right"
                    onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים"
                  />
                  <button
                    type="button"
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <Input
                  id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirm}
                  required minLength={6} autoComplete="new-password" className="text-right"
                  onChange={(e) => setConfirm(e.target.value)} placeholder="הקלידו שוב"
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving} aria-busy={saving}>
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? 'מעדכן...' : 'עדכון סיסמה'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
