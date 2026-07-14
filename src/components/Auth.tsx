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
  const { signIn, signUp } = useAuth();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold gradient-bg bg-clip-text text-transparent">
            מערכת ניהול שוכרים
          </CardTitle>
          <p className="text-muted-foreground">
            {isLogin ? 'התחבר לחשבון שלך' : 'צור חשבון חדש'}
          </p>
        </CardHeader>
        <CardContent>
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
            <Button type="submit" className="w-full gradient-bg hover:opacity-90" disabled={loading}>
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
