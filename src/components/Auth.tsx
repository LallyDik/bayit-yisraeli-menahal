import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';

const authErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Invalid login credentials')) return 'כתובת המייל או הסיסמה אינם נכונים.';
  if (message.includes('Email not confirmed')) return 'צריך לאשר את כתובת המייל לפני ההתחברות.';
  if (message.includes('User already registered')) return 'כבר קיים חשבון עם כתובת המייל הזו.';
  if (message.toLowerCase().includes('password')) return 'הסיסמה חייבת לכלול לפחות 6 תווים.';
  if (message.toLowerCase().includes('rate limit')) return 'בוצעו יותר מדי ניסיונות. המתינו מעט ונסו שוב.';
  return 'לא הצלחנו להשלים את הפעולה. בדקו את הפרטים ונסו שוב.';
};

export const Auth = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle, signUp, requestPasswordReset } = useAuth();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('provider is not enabled') || message.includes('Unsupported provider')) {
        toast.error('הכניסה עם Google עדיין לא הופעלה בהגדרות המערכת.');
      } else {
        toast.error('לא ניתן להתחבר עם Google כרגע. נסו שוב.');
      }
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email);
        setResetSent(true);
        toast.success('אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס.');
      } else if (mode === 'login') {
        await signIn(email, password);
        toast.success('התחברת בהצלחה');
      } else {
        await signUp(email, password);
        toast.success('החשבון נוצר בהצלחה');
      }
    } catch (error) {
      // A reset request must not reveal whether the address exists: show the
      // same neutral confirmation even on error (rate-limit errors excepted are
      // not worth leaking either).
      if (mode === 'reset') {
        setResetSent(true);
        toast.success('אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס.');
      } else {
        toast.error(authErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-0 py-4 sm:p-6">
      <Card className="w-full max-w-md rounded-[2rem] border-border border-t-4 border-t-primary shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display text-foreground">
            השכירות מסודרת. הראש שקט.
          </CardTitle>
          <p className="text-muted-foreground">
            {mode === 'login' && 'רואים מי שילם ומה עדיין נשאר פתוח.'}
            {mode === 'signup' && 'פותחים חשבון ומתחילים לעשות סדר.'}
            {mode === 'reset' && 'הזינו את כתובת המייל ונשלח קישור לאיפוס הסיסמה.'}
          </p>
        </CardHeader>
        <CardContent>
          {mode !== 'reset' && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl bg-white"
                disabled={loading || googleLoading}
                aria-busy={googleLoading}
                onClick={handleGoogleSignIn}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.39 13.9A6.01 6.01 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.5H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.5l3.35-2.6Z" />
                  <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.5l3.35 2.6C7.18 7.73 9.39 5.97 12 5.97Z" />
                </svg>
                {googleLoading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {googleLoading ? 'מעביר ל-Google...' : 'המשך עם Google'}
              </Button>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">או עם מייל</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {mode === 'reset' && resetSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס. בדקו את תיבת הדואר (וגם את הספאם).</p>
              <Button type="button" variant="link" className="text-primary" onClick={() => { setMode('login'); setResetSent(false); }}>
                חזרה להתחברות
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">כתובת מייל</Label>
                <Input
                  id="email" type="email" value={email} required autoComplete="email" inputMode="email" className="text-right"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="הכנס כתובת מייל"
                />
              </div>
              {mode !== 'reset' && (
                <div className="space-y-2">
                  <Label htmlFor="password">סיסמה</Label>
                  <div className="relative">
                    <Input
                      id="password" type={showPassword ? 'text' : 'password'} value={password} required minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="pe-11 text-right"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="הכנס סיסמה"
                    />
                    <button
                      type="button"
                      className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading || googleLoading} aria-busy={loading}>
                {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {loading ? 'מעבד...' : mode === 'login' ? 'התחבר' : mode === 'signup' ? 'צור חשבון' : 'שליחת קישור לאיפוס'}
              </Button>
            </form>
          )}
          <div className="mt-4 space-y-1 text-center">
            {mode === 'login' && (
              <>
                <Button variant="link" onClick={() => setMode('signup')} className="text-primary">אין לך חשבון? צור חשבון חדש</Button>
                <div>
                  <Button variant="link" onClick={() => { setMode('reset'); setResetSent(false); }} className="text-muted-foreground">שכחתי סיסמה</Button>
                </div>
              </>
            )}
            {mode === 'signup' && (
              <Button variant="link" onClick={() => setMode('login')} className="text-primary">יש לך חשבון? התחבר</Button>
            )}
            {mode === 'reset' && !resetSent && (
              <Button variant="link" onClick={() => setMode('login')} className="text-primary">חזרה להתחברות</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
