import { useState } from 'react';
import { toast } from 'sonner';
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
import { useTenancies } from '@/hooks/useTenancies';
import type { Unit, Tenant } from '@/types';

const todayISO = () => new Date().toISOString().slice(0, 10);

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { units, isLoading, createUnit, updateUnit, archiveUnit } = useUnits();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [adding, setAdding] = useState(false);
  const { tenants, isLoading: tenantsLoading, createTenant, updateTenant, archiveTenant } = useTenants();
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [addingTenant, setAddingTenant] = useState(false);
  const {
    activeByUnitId, activeByTenantId, createTenancy, endTenancy, updateTenancy,
  } = useTenancies();

  // Saving a tenant with a unit assignment is two sequential writes (tenant,
  // then tenancy). If the first succeeds and the second fails, the tenant
  // must not be left looking unaccounted-for: createTenant/updateTenant's own
  // toast already confirms what *did* save, and the tenancy mutations' own
  // onError already explains *why* the assignment step failed (e.g. the unit
  // was taken in the meantime) — this just makes explicit, in the tenant's
  // own name, that the two are separate outcomes.
  type TenantFields = {
    name: string;
    phone: string | null;
    email: string | null;
    description: string | null;
    notes: string | null;
  };

  const saveNewTenant = async (
    fields: TenantFields, unitId: string | null, monthlyRent: number | null,
  ) => {
    let created: Tenant;
    try {
      created = await createTenant(fields);
    } catch {
      return; // useTenants already toasted why the tenant itself wasn't saved.
    }
    if (!unitId) return;
    try {
      await createTenancy({
        tenant_id: created.id,
        unit_id: unitId,
        monthly_rent: monthlyRent ?? 0,
        start_date: todayISO(),
      });
    } catch {
      toast.error(`השוכר "${created.name}" נשמר, אך לא שויך ליחידה. אפשר לשייך אותו דרך עריכת השוכר.`);
    }
  };

  const saveEditedTenant = async (
    tenant: Tenant, fields: TenantFields, unitId: string | null, monthlyRent: number | null,
  ) => {
    try {
      await updateTenant({ id: tenant.id, patch: fields });
    } catch {
      return; // useTenants already toasted why the tenant fields weren't saved.
    }
    const current = activeByTenantId.get(tenant.id) ?? null;
    try {
      if (current && !unitId) {
        // Cleared the unit -> end the tenancy. Never delete: it's history.
        await endTenancy({ id: current.id, end_date: todayISO() });
      } else if (current && unitId && unitId !== current.unit_id) {
        // Moved to a different unit -> close out the old stay, open a new one.
        await endTenancy({ id: current.id, end_date: todayISO() });
        await createTenancy({
          tenant_id: tenant.id, unit_id: unitId, monthly_rent: monthlyRent ?? 0, start_date: todayISO(),
        });
      } else if (current && unitId && unitId === current.unit_id) {
        // Same unit — only the rent may have changed. Update in place; ending
        // and recreating would fabricate a fake move-out in the history.
        if (monthlyRent !== null && Number(monthlyRent) !== Number(current.monthly_rent)) {
          await updateTenancy({ id: current.id, patch: { monthly_rent: monthlyRent } });
        }
      } else if (!current && unitId) {
        // Had no unit, now assigned one for the first time.
        await createTenancy({
          tenant_id: tenant.id, unit_id: unitId, monthly_rent: monthlyRent ?? 0, start_date: todayISO(),
        });
      }
      // else: no unit before, still no unit -> nothing to do on the tenancy side.
    } catch {
      toast.error('פרטי השוכר נשמרו, אך העדכון בשיוך ליחידה נכשל.');
    }
  };

  const handleTenantSubmit = (values: TenantFields & { unit_id: string | null; monthly_rent: number | null }) => {
    const { unit_id, monthly_rent, ...fields } = values;
    if (editingTenant) {
      void saveEditedTenant(editingTenant, fields, unit_id, monthly_rent);
    } else {
      void saveNewTenant(fields, unit_id, monthly_rent);
    }
    setAddingTenant(false);
    setEditingTenant(null);
  };

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
              <LogOut className="w-4 h-4" />
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
                  <Plus className="w-5 h-5" />
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
                        activeTenantName={activeByUnitId.get(unit.id)?.tenant_name ?? null}
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
                  units={units}
                  occupiedUnitIds={new Set(activeByUnitId.keys())}
                  initialData={editingTenant ? {
                    ...editingTenant,
                    unit_id: activeByTenantId.get(editingTenant.id)?.unit_id ?? null,
                    monthly_rent: activeByTenantId.get(editingTenant.id)?.monthly_rent ?? null,
                  } : undefined}
                  submitLabel={editingTenant ? 'עדכן שוכר' : 'הוסף שוכר'}
                  onSubmit={handleTenantSubmit}
                />
              </div>
            ) : (
              <>
                <Button onClick={() => setAddingTenant(true)} className="gradient-bg hover:opacity-90 mb-8" size="lg">
                  <Plus className="w-5 h-5" />
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
                        unitName={activeByTenantId.get(tenant.id)?.unit_name ?? null}
                        monthlyRent={activeByTenantId.get(tenant.id)?.monthly_rent ?? null}
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
