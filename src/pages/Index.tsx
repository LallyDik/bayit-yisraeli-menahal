import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Plus, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Auth } from '@/components/Auth';
import { useAuth } from '@/hooks/useAuth';
import { UnitForm } from '@/components/UnitForm';
import { UnitCard } from '@/components/UnitCard';
import { useUnits } from '@/hooks/useUnits';
import type { Unit } from '@/types';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { units, isLoading, createUnit, updateUnit, archiveUnit } = useUnits();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [adding, setAdding] = useState(false);

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

      <div className="max-w-6xl mx-auto p-6">
        {adding || editing ? (
          <div className="flex flex-col items-center gap-4">
            <Button variant="outline" onClick={() => { setAdding(false); setEditing(null); }}>
              ← חזור
            </Button>
            <UnitForm
              initialData={editing ?? undefined}
              submitLabel={editing ? 'עדכן יחידה' : 'הוסף יחידה'}
              onSubmit={(values) => {
                if (editing) updateUnit({ id: editing.id, patch: values });
                else createUnit(values);
                setAdding(false);
                setEditing(null);
              }}
            />
          </div>
        ) : (
          <>
            <Button onClick={() => setAdding(true)} className="gradient-bg hover:opacity-90 mb-8" size="lg">
              <Plus className="w-5 h-5 ml-2" />
              הוסף יחידה
            </Button>

            {isLoading ? (
              <p className="text-center text-muted-foreground">טוען יחידות...</p>
            ) : units.length === 0 ? (
              <Card className="text-center p-12">
                <CardContent>
                  <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">אין יחידות במערכת</h3>
                  <p className="text-muted-foreground mb-6">הוסף יחידה ראשונה כדי להתחיל</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    activeTenantName={null}
                    onEdit={setEditing}
                    onArchive={archiveUnit}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
