import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Plus, Home, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Auth } from '@/components/Auth';
import { useAuth } from '@/hooks/useAuth';
import { UnitForm } from '@/components/UnitForm';
import { UnitCard } from '@/components/UnitCard';
import { useUnits } from '@/hooks/useUnits';
import { TenantForm } from '@/components/TenantForm';
import { TenantCard } from '@/components/TenantCard';
import { useTenants } from '@/hooks/useTenants';
import type { Unit, Tenant } from '@/types';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { units, isLoading, createUnit, updateUnit, archiveUnit } = useUnits();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [adding, setAdding] = useState(false);
  const { tenants, isLoading: tenantsLoading, createTenant, updateTenant, archiveTenant } = useTenants();
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [addingTenant, setAddingTenant] = useState(false);

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
        <Tabs defaultValue="units">
          <TabsList className="mb-6">
            <TabsTrigger value="units">יחידות</TabsTrigger>
            <TabsTrigger value="tenants">שוכרים</TabsTrigger>
          </TabsList>

          <TabsContent value="units">
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
          </TabsContent>

          <TabsContent value="tenants">
            {addingTenant || editingTenant ? (
              <div className="flex flex-col items-center gap-4">
                <Button variant="outline" onClick={() => { setAddingTenant(false); setEditingTenant(null); }}>
                  ← חזור
                </Button>
                <TenantForm
                  initialData={editingTenant ?? undefined}
                  submitLabel={editingTenant ? 'עדכן שוכר' : 'הוסף שוכר'}
                  onSubmit={(values) => {
                    if (editingTenant) updateTenant({ id: editingTenant.id, patch: values });
                    else createTenant(values);
                    setAddingTenant(false);
                    setEditingTenant(null);
                  }}
                />
              </div>
            ) : (
              <>
                <Button onClick={() => setAddingTenant(true)} className="gradient-bg hover:opacity-90 mb-8" size="lg">
                  <Plus className="w-5 h-5 ml-2" />
                  הוסף שוכר
                </Button>
                {tenantsLoading ? (
                  <p className="text-center text-muted-foreground">טוען שוכרים...</p>
                ) : tenants.length === 0 ? (
                  <Card className="text-center p-12">
                    <CardContent>
                      <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">אין שוכרים במערכת</h3>
                      <p className="text-muted-foreground">הוסף שוכר ראשון כדי להתחיל</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tenants.map((tenant) => (
                      <TenantCard
                        key={tenant.id}
                        tenant={tenant}
                        unitName={null}
                        onEdit={setEditingTenant}
                        onArchive={archiveTenant}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
