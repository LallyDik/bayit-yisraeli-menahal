import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle, signUp } = useAuth();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('provider is not enabled') || message.includes('Unsupported provider')) {
        toast.error('הכניסה עם Google עדיין לא הופעלה בהגדרות המערכת.');
      } else {
        toast.error('לא ניתן להתחבר עם Google כרגע. נסה שוב.');
      }
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('התחברת בהצלחה');
      } else {
        await signUp(email, password);
        toast.success('החשבון נוצר בהצלחה');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'אירעה שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background page-confetti flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2rem] border-border border-t-4 border-t-primary shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display text-foreground">
            השכירות מסודרת. הראש שקט.
          </CardTitle>
          <p className="text-muted-foreground">
            {isLogin ? 'רואים מי שילם ומה עדיין נשאר פתוח.' : 'פותחים חשבון ומתחילים לעשות סדר.'}
          </p>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl bg-white"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignIn}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.39 13.9A6.01 6.01 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.5H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.5l3.35-2.6Z" />
              <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.5l3.35 2.6C7.18 7.73 9.39 5.97 12 5.97Z" />
            </svg>
            {googleLoading ? 'מעביר ל-Google...' : 'המשך עם Google'}
          </Button>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">או עם מייל</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">כתובת מייל</Label>
              <Input
                id="email" type="email" value={email} required className="text-right"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הכנס כתובת מייל"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password" type="password" value={password} required minLength={6}
                className="text-right"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="הכנס סיסמה"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? 'מעבד...' : isLogin ? 'התחבר' : 'צור חשבון'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="text-primary">
              {isLogin ? 'אין לך חשבון? צור חשבון חדש' : 'יש לך חשבון? התחבר'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
