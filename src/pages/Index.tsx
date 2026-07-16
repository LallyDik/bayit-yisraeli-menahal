import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LogOut, Plus, Home, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LandingPage } from '@/components/LandingPage';
import { useAuth } from '@/hooks/useAuth';
import { Dashboard } from '@/components/Dashboard';
import { PaymentsPage } from '@/components/PaymentsPage';
import { UnitForm } from '@/components/UnitForm';
import { UnitCard } from '@/components/UnitCard';
import { useUnits } from '@/hooks/useUnits';
import { TenantForm } from '@/components/TenantForm';
import { TenantCard } from '@/components/TenantCard';
import { useTenants } from '@/hooks/useTenants';
import { useTenancies } from '@/hooks/useTenancies';
import { useBilling } from '@/hooks/useBilling';
import type { Unit, Tenant } from '@/types';

const todayISO = () => new Date().toISOString().slice(0, 10);

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState('overview');
  const { units, isLoading, createUnit, updateUnit, archiveUnit } = useUnits();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [adding, setAdding] = useState(false);
  const { tenants, isLoading: tenantsLoading, createTenant, updateTenant, archiveTenant } = useTenants();
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [addingTenant, setAddingTenant] = useState(false);
  const {
    tenancies, activeByUnitId, activeByTenantId, createTenancy, endTenancy, updateTenancy,
  } = useTenancies();
  const {
    charges,
    paymentTerms,
    billingSettingsByTenancyId,
    occurrencesByTenancyId,
    currentOccurrenceByTenancyId,
    currentRentByTenancyId,
    isLoading: billingLoading,
    saveBillingSettings,
    ensureDefaultSchedules,
    markCurrentRentPaid,
    saveCurrentRentPayment,
    saveUtilityCharge,
    addAdditionalPayment,
    updateAdditionalPayment,
    updateUtilityPaymentSettings,
    saveUtilityPaymentSettings,
    saveFixedTermCharge,
    saveMeterTermCharge,
    removePaymentTerm,
    markChargePaid,
    saveChargePayment,
    pendingTenancyIds,
  } = useBilling();

  useEffect(() => {
    void ensureDefaultSchedules(Array.from(activeByUnitId.values()));
  }, [activeByUnitId, ensureDefaultSchedules]);

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
    fields: TenantFields, unitId: string | null, monthlyRent: number | null, startDate: string,
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
        start_date: startDate,
      });
    } catch {
      toast.error(`השוכר "${created.name}" נשמר, אך לא שויך ליחידה. אפשר לשייך אותו דרך עריכת השוכר.`);
    }
  };

  const saveEditedTenant = async (
    tenant: Tenant, fields: TenantFields, unitId: string | null, monthlyRent: number | null, startDate: string,
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
          tenant_id: tenant.id, unit_id: unitId, monthly_rent: monthlyRent ?? 0, start_date: startDate,
        });
      } else if (current && unitId && unitId === current.unit_id) {
        // Same unit — only the rent may have changed. Update in place; ending
        // and recreating would fabricate a fake move-out in the history.
        const patch: { monthly_rent?: number; start_date?: string } = {};
        if (monthlyRent !== null && Number(monthlyRent) !== Number(current.monthly_rent)) {
          patch.monthly_rent = monthlyRent;
        }
        if (startDate && startDate !== current.start_date) {
          patch.start_date = startDate;
        }
        if (Object.keys(patch).length > 0) {
          await updateTenancy({ id: current.id, patch });
        }
      } else if (!current && unitId) {
        // Had no unit, now assigned one for the first time.
        await createTenancy({
          tenant_id: tenant.id, unit_id: unitId, monthly_rent: monthlyRent ?? 0, start_date: startDate,
        });
      }
      // else: no unit before, still no unit -> nothing to do on the tenancy side.
    } catch {
      toast.error('פרטי השוכר נשמרו, אך העדכון בשיוך ליחידה נכשל.');
    }
  };

  const handleTenantSubmit = (values: TenantFields & { unit_id: string | null; monthly_rent: number | null; start_date: string }) => {
    const { unit_id, monthly_rent, start_date, ...fields } = values;
    if (editingTenant) {
      void saveEditedTenant(editingTenant, fields, unit_id, monthly_rent, start_date);
    } else {
      void saveNewTenant(fields, unit_id, monthly_rent, start_date);
    }
    setAddingTenant(false);
    setEditingTenant(null);
  };

  const handleArchiveTenant = async (id: string) => {
    const activeTenancy = activeByTenantId.get(id);
    if (activeTenancy) {
      await endTenancy({ id: activeTenancy.id, end_date: todayISO() });
    }
    await archiveTenant(id);
  };

  const handleArchiveUnit = async (id: string) => {
    const activeTenancy = activeByUnitId.get(id);
    if (activeTenancy) {
      await endTenancy({ id: activeTenancy.id, end_date: todayISO() });
    }
    await archiveUnit(id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LandingPage />;

  return (
    <div className="min-h-screen bg-background page-confetti">
      <header className="relative overflow-hidden bg-primary/20 text-foreground px-6 pt-8 pb-20 rounded-b-[2.5rem] sm:rounded-b-[4rem]">
        <div className="absolute -top-16 -left-12 h-48 w-48 rounded-full bg-primary/55" aria-hidden="true" />
        <div className="absolute -bottom-20 left-1/3 h-40 w-40 rotate-12 rounded-[2.5rem] bg-secondary" aria-hidden="true" />
        <div className="absolute top-10 right-[44%] h-10 w-10 rounded-full bg-accent" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto flex flex-col sm:flex-row justify-between sm:items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-6xl font-display leading-tight">השכירות מסודרת.<br />הראש שקט.</h1>
            <p className="mt-3 text-lg text-foreground/70">רואים מי שילם, מה נשאר ומתי מגיע החיוב הבא.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="max-w-48 truncate rounded-full bg-white/70 px-4 py-2 text-sm nums">{user.email}</span>
            <Button onClick={signOut} variant="outline" size="sm" className="rounded-full border-foreground/20 bg-white/35 text-foreground hover:bg-foreground hover:text-white">
              <LogOut className="w-4 h-4" />
              התנתק
            </Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto -mt-10 px-4 sm:px-6 pb-12">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-8 h-auto w-full sm:w-auto rounded-2xl border bg-card p-2 shadow-[0_12px_35px_-18px_rgba(23,50,77,0.45)]">
            <TabsTrigger value="overview">סקירה</TabsTrigger>
            <TabsTrigger value="payments">תשלומים</TabsTrigger>
            <TabsTrigger value="units">יחידות</TabsTrigger>
            <TabsTrigger value="tenants">שוכרים</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-12">
              <Dashboard
                units={units}
                tenants={tenants}
                activeByUnitId={activeByUnitId}
                activeByTenantId={activeByTenantId}
                isLoading={isLoading || tenantsLoading}
                onAddUnit={() => { setTab('units'); setAdding(true); }}
                onAddTenant={() => { setTab('tenants'); setAddingTenant(true); }}
                onEditUnit={(u) => { setTab('units'); setEditing(u); }}
                onEditTenant={(t) => { setTab('tenants'); setEditingTenant(t); }}
                onGoUnits={() => setTab('units')}
                onGoTenants={() => setTab('tenants')}
              >
                <PaymentsPage
                  tenancies={Array.from(activeByUnitId.values())}
                  allTenancies={tenancies}
                  charges={charges}
                  paymentTerms={paymentTerms}
                  billingSettingsByTenancyId={billingSettingsByTenancyId}
                  occurrencesByTenancyId={occurrencesByTenancyId}
                  currentOccurrenceByTenancyId={currentOccurrenceByTenancyId}
                  currentRentByTenancyId={currentRentByTenancyId}
                  isLoading={billingLoading}
                  pendingKeys={pendingTenancyIds}
                  onMarkRentPaid={markCurrentRentPaid}
                  onSaveRentPayment={saveCurrentRentPayment}
                  onSaveUtilityCharge={saveUtilityCharge}
                  onMarkChargePaid={markChargePaid}
                  onSaveChargePayment={saveChargePayment}
                  onAddAdditionalPayment={addAdditionalPayment}
                  onUpdateAdditionalPayment={updateAdditionalPayment}
                  onUpdateUtilityPaymentSettings={updateUtilityPaymentSettings}
                  onSaveUtilityPaymentSettings={saveUtilityPaymentSettings}
                  onSaveFixedTermCharge={saveFixedTermCharge}
                  onSaveMeterTermCharge={saveMeterTermCharge}
                  onDeletePaymentTerm={removePaymentTerm}
                  onSaveBillingSettings={saveBillingSettings}
                />
              </Dashboard>
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsPage
              tenancies={Array.from(activeByUnitId.values())}
              allTenancies={tenancies}
              charges={charges}
              paymentTerms={paymentTerms}
              billingSettingsByTenancyId={billingSettingsByTenancyId}
              occurrencesByTenancyId={occurrencesByTenancyId}
              currentOccurrenceByTenancyId={currentOccurrenceByTenancyId}
              currentRentByTenancyId={currentRentByTenancyId}
              isLoading={billingLoading}
              pendingKeys={pendingTenancyIds}
              onMarkRentPaid={markCurrentRentPaid}
              onSaveRentPayment={saveCurrentRentPayment}
              onSaveUtilityCharge={saveUtilityCharge}
              onMarkChargePaid={markChargePaid}
              onSaveChargePayment={saveChargePayment}
              onAddAdditionalPayment={addAdditionalPayment}
              onUpdateAdditionalPayment={updateAdditionalPayment}
              onUpdateUtilityPaymentSettings={updateUtilityPaymentSettings}
              onSaveUtilityPaymentSettings={saveUtilityPaymentSettings}
              onSaveFixedTermCharge={saveFixedTermCharge}
              onSaveMeterTermCharge={saveMeterTermCharge}
              onDeletePaymentTerm={removePaymentTerm}
              onSaveBillingSettings={saveBillingSettings}
            />
          </TabsContent>

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
                <Button onClick={() => setAdding(true)} className="mb-8" size="lg">
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
                        onArchive={handleArchiveUnit}
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
                    start_date: activeByTenantId.get(editingTenant.id)?.start_date ?? todayISO(),
                  } : undefined}
                  submitLabel={editingTenant ? 'עדכן שוכר' : 'הוסף שוכר'}
                  onSubmit={handleTenantSubmit}
                />
              </div>
            ) : (
              <>
                <Button onClick={() => setAddingTenant(true)} className="mb-8" size="lg">
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
                        onArchive={handleArchiveTenant}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
