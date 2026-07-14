import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { Auth } from '@/components/Auth';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="gradient-bg text-white p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">מערכת ניהול שוכרים</h1>
            <p className="text-xl opacity-90">ניהול מקצועי של נכסים ותשלומים</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg">{user.email}</span>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <LogOut className="w-4 h-4 ml-2" />
              התנתק
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
