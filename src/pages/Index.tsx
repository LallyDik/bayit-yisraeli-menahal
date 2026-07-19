import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import {
  ArrowRight,
  CircleHelp,
  Home,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LandingPage } from '@/components/LandingPage';
import { useAuth } from '@/hooks/useAuth';
import { Dashboard, type TenantPaymentPreview } from '@/components/Dashboard';
import { TenantPaymentSummaryDialog } from '@/components/TenantPaymentSummaryDialog';
import { UnitForm } from '@/components/UnitForm';
import { UnitCard } from '@/components/UnitCard';
import { useUnits } from '@/hooks/useUnits';
import { TenantForm } from '@/components/TenantForm';
import { TenantCard } from '@/components/TenantCard';
import { useTenants } from '@/hooks/useTenants';
import { useTenancies } from '@/hooks/useTenancies';
import { useBilling } from '@/hooks/useBilling';
import { FirstLoginGuide } from '@/components/FirstLoginGuide';
import { localDateISO } from '@/utils/date';
import {
  CURRENT_ONBOARDING_VERSION,
  shouldShowOnboarding,
} from '@/utils/onboarding';
import type { Unit, Tenant } from '@/types';
import type { BillingCalendar } from '@/utils/billingSchedule';

const PaymentsPage = lazy(() => import('@/components/PaymentsPage').then((module) => ({
  default: module.PaymentsPage,
})));

const APP_TABS = ['overview', 'payments', 'units', 'tenants'] as const;
type AppTab = (typeof APP_TABS)[number];

const isAppTab = (value: string | null): value is AppTab => (
  value !== null && APP_TABS.includes(value as AppTab)
);

const TAB_TITLES: Record<AppTab, string> = {
  overview: 'סקירה',
  payments: 'תשלומים',
  units: 'יחידות',
  tenants: 'שוכרים',
};

interface LoadErrorProps {
  onRetry: () => void;
}

function LoadError({ onRetry }: LoadErrorProps) {
  return (
    <Card className="border-destructive/30 bg-card">
      <CardContent className="flex flex-col items-center px-6 py-10 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <RefreshCw className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl">לא הצלחנו לטעון את הנתונים</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">בדקו את החיבור ונסו שוב. שום מידע לא נמחק.</p>
        <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          נסו שוב
        </Button>
      </CardContent>
    </Card>
  );
}

function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full border bg-card px-5 py-3 text-muted-foreground shadow-sm">
        <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

interface PageHeadingProps {
  title: string;
  description: string;
  action: React.ReactNode;
}

function PageHeading({ title, description, action }: PageHeadingProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-3xl">{title}</h2>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

const Index = () => {
  const { user, loading, signOut, completeOnboarding } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: AppTab = isAppTab(searchParams.get('view')) ? searchParams.get('view') as AppTab : 'overview';
  const {
    units,
    isLoading: unitsLoading,
    error: unitsError,
    refetch: refetchUnits,
    isSaving: unitSaving,
    createUnit,
    updateUnit,
    archiveUnit,
  } = useUnits();
  const {
    tenants,
    isLoading: tenantsLoading,
    error: tenantsError,
    refetch: refetchTenants,
    createTenant,
    updateTenant,
    archiveTenant,
  } = useTenants();
  const {
    tenancies,
    activeByUnitId,
    activeByTenantId,
    isLoading: tenanciesLoading,
    error: tenanciesError,
    refetch: refetchTenancies,
    createTenancy,
    endTenancy,
    updateTenancy,
  } = useTenancies();
  const {
    charges,
    paymentTerms,
    billingSettingsByTenancyId,
    areSettingsReady,
    occurrencesByTenancyId,
    currentOccurrenceByTenancyId,
    currentRentByTenancyId,
    isLoading: billingLoading,
    error: billingError,
    refetch: refetchBilling,
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

  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [addingTenant, setAddingTenant] = useState(false);
  const [tenantFormSaving, setTenantFormSaving] = useState(false);
  const [unitQuery, setUnitQuery] = useState('');
  const [tenantQuery, setTenantQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [guideSaving, setGuideSaving] = useState(false);
  const [selectedPaymentTenancyId, setSelectedPaymentTenancyId] = useState<string | null>(null);

  const appLoading = unitsLoading || tenantsLoading || tenanciesLoading || billingLoading;
  const needsOnboarding = user ? shouldShowOnboarding(user.user_metadata) : false;
  const focusedPaymentTenancyId = tab === 'payments' ? searchParams.get('tenant') : null;

  const setTab = useCallback((nextTab: AppTab, replace = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextTab === 'overview') next.delete('view');
      else next.set('view', nextTab);
      next.delete('tenant');
      return next;
    }, { replace });
  }, [setSearchParams]);

  const handleGuideNavigate = useCallback((view: AppTab) => {
    setTab(view, true);
  }, [setTab]);

  useEffect(() => {
    document.title = `${TAB_TITLES[tab]} | ניהול שכירות`;
  }, [tab]);

  useEffect(() => {
    setGuideDismissed(false);
  }, [user?.id]);

  useEffect(() => {
    if (user && !appLoading && needsOnboarding && !guideDismissed) setGuideOpen(true);
  }, [appLoading, guideDismissed, needsOnboarding, user]);

  useEffect(() => {
    if (!tenanciesLoading && !billingLoading && areSettingsReady && !billingError) {
      void ensureDefaultSchedules(Array.from(activeByUnitId.values()));
    }
  }, [activeByUnitId, areSettingsReady, billingError, billingLoading, ensureDefaultSchedules, tenanciesLoading]);

  const activeTenancies = useMemo(() => Array.from(activeByUnitId.values()), [activeByUnitId]);
  const activeTenancyIds = useMemo(() => new Set(activeTenancies.map((tenancy) => tenancy.id)), [activeTenancies]);
  const displayCharges = useMemo(() => {
    const termById = new Map(paymentTerms.map((term) => [term.id, term]));
    return charges.filter((charge) => {
      const match = charge.period_key.match(/^term:([^:]+):(.+)$/);
      if (!match) return true;
      const term = termById.get(match[1]);
      const occurrence = (occurrencesByTenancyId.get(charge.tenancy_id) ?? [])
        .find((item) => item.period_key === match[2]);
      if (!term || !occurrence) return true;
      const startsOn = term.starts_on_sequence ?? 1;
      const frequency = term.frequency_months === 2 ? 2 : 1;
      const isEligible = occurrence.sequence_no >= startsOn
        && (occurrence.sequence_no - startsOn) % frequency === 0;
      return isEligible || Number(charge.paid_amount) > 0;
    });
  }, [charges, occurrencesByTenancyId, paymentTerms]);
  const dueActiveCharges = useMemo(() => {
    const today = localDateISO();
    return displayCharges.filter((charge) => activeTenancyIds.has(charge.tenancy_id) && charge.due_date <= today);
  }, [activeTenancyIds, displayCharges]);
  const overviewCharges = useMemo(() => {
    const currentRentIds = new Set(
      activeTenancies
        .map((tenancy) => currentRentByTenancyId.get(tenancy.id)?.id)
        .filter((id): id is string => Boolean(id)),
    );
    return dueActiveCharges.filter((charge) => charge.payment_type !== 'rent' || currentRentIds.has(charge.id));
  }, [activeTenancies, currentRentByTenancyId, dueActiveCharges]);

  const paymentOverview = useMemo(() => {
    return overviewCharges
      .reduce((totals, charge) => {
        const due = Number(charge.amount_due);
        const paid = Number(charge.paid_amount);
        const remaining = Math.max(due - paid, 0);
        return {
          due: totals.due + due,
          paid: totals.paid + paid,
          outstanding: totals.outstanding + remaining,
          openCount: totals.openCount + (remaining > 0 ? 1 : 0),
        };
      }, { due: 0, paid: 0, outstanding: 0, openCount: 0 });
  }, [overviewCharges]);
  const paymentPreview = useMemo<TenantPaymentPreview[]>(() => activeTenancies
    .map((tenancy) => {
      const rentCharge = currentRentByTenancyId.get(tenancy.id);
      const additionalCharges = dueActiveCharges.filter((charge) => (
        charge.tenancy_id === tenancy.id && charge.payment_type !== 'rent'
      ));
      const additionalDue = additionalCharges.reduce((sum, charge) => sum + Number(charge.amount_due), 0);
      const additionalPaid = additionalCharges.reduce((sum, charge) => sum + Number(charge.paid_amount), 0);
      return {
        id: tenancy.id,
        unitName: tenancy.unit_name,
        tenantName: tenancy.tenant_name,
        rentDue: Number(rentCharge?.amount_due ?? tenancy.monthly_rent ?? 0),
        rentPaid: Number(rentCharge?.paid_amount ?? 0),
        rentHasCharge: Boolean(rentCharge),
        additionalCount: additionalCharges.length,
        additionalDue,
        additionalPaid,
        additionalOpenCount: additionalCharges.filter((charge) => Number(charge.paid_amount) < Number(charge.amount_due)).length,
      };
    })
    .sort((first, second) => {
      const firstRemaining = Math.max(first.rentDue - first.rentPaid, 0) + Math.max(first.additionalDue - first.additionalPaid, 0);
      const secondRemaining = Math.max(second.rentDue - second.rentPaid, 0) + Math.max(second.additionalDue - second.additionalPaid, 0);
      return secondRemaining - firstRemaining || first.tenantName.localeCompare(second.tenantName, 'he');
    }), [activeTenancies, currentRentByTenancyId, dueActiveCharges]);

  const selectedPaymentTenancy = useMemo(() => (
    activeTenancies.find((tenancy) => tenancy.id === selectedPaymentTenancyId) ?? null
  ), [activeTenancies, selectedPaymentTenancyId]);
  const selectedAdditionalCharges = useMemo(() => (
    selectedPaymentTenancy
      ? dueActiveCharges
        .filter((charge) => charge.tenancy_id === selectedPaymentTenancy.id && charge.payment_type !== 'rent')
        .sort((first, second) => {
          const firstOpen = Number(first.paid_amount) < Number(first.amount_due);
          const secondOpen = Number(second.paid_amount) < Number(second.amount_due);
          return Number(secondOpen) - Number(firstOpen) || second.due_date.localeCompare(first.due_date);
        })
      : []
  ), [dueActiveCharges, selectedPaymentTenancy]);

  const openTenantPaymentDetails = useCallback((tenancyId: string) => {
    setSelectedPaymentTenancyId(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('view', 'payments');
      next.set('tenant', tenancyId);
      return next;
    });
  }, [setSearchParams]);

  const clearPaymentFocus = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('tenant');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const filteredUnits = useMemo(() => {
    const query = unitQuery.trim().toLocaleLowerCase('he');
    if (!query) return units;
    return units.filter((unit) => [unit.name, unit.description, unit.notes]
      .some((value) => value?.toLocaleLowerCase('he').includes(query)));
  }, [unitQuery, units]);

  const filteredTenants = useMemo(() => {
    const query = tenantQuery.trim().toLocaleLowerCase('he');
    if (!query) return tenants;
    return tenants.filter((tenant) => [tenant.name, tenant.phone, tenant.email, tenant.description]
      .some((value) => value?.toLocaleLowerCase('he').includes(query)));
  }, [tenantQuery, tenants]);

  type TenantFields = {
    name: string;
    phone: string | null;
    email: string | null;
    description: string | null;
    notes: string | null;
  };

  const saveNewTenant = async (
    fields: TenantFields,
    unitId: string | null,
    monthlyRent: number | null,
    startDate: string,
  ): Promise<boolean> => {
    let created: Tenant;
    try {
      created = await createTenant(fields);
    } catch {
      return false;
    }
    if (!unitId) return true;
    try {
      await createTenancy({
        tenant_id: created.id,
        unit_id: unitId,
        monthly_rent: monthlyRent ?? 0,
        start_date: startDate,
      });
    } catch {
      toast.error(`השוכר „${created.name}” נשמר, אך לא שויך ליחידה. אפשר לשייך אותו דרך עריכת השוכר.`);
    }
    return true;
  };

  const saveEditedTenant = async (
    tenant: Tenant,
    fields: TenantFields,
    unitId: string | null,
    monthlyRent: number | null,
    startDate: string,
  ): Promise<boolean> => {
    try {
      await updateTenant({ id: tenant.id, patch: fields });
    } catch {
      return false;
    }
    const current = activeByTenantId.get(tenant.id) ?? null;
    try {
      if (current && !unitId) {
        await endTenancy({ id: current.id, end_date: localDateISO() });
      } else if (current && unitId && unitId !== current.unit_id) {
        await endTenancy({ id: current.id, end_date: localDateISO() });
        await createTenancy({
          tenant_id: tenant.id,
          unit_id: unitId,
          monthly_rent: monthlyRent ?? 0,
          start_date: startDate,
        });
      } else if (current && unitId && unitId === current.unit_id) {
        const patch: { monthly_rent?: number; start_date?: string } = {};
        if (monthlyRent !== null && Number(monthlyRent) !== Number(current.monthly_rent)) patch.monthly_rent = monthlyRent;
        if (startDate && startDate !== current.start_date) patch.start_date = startDate;
        if (Object.keys(patch).length > 0) await updateTenancy({ id: current.id, patch });
      } else if (!current && unitId) {
        await createTenancy({
          tenant_id: tenant.id,
          unit_id: unitId,
          monthly_rent: monthlyRent ?? 0,
          start_date: startDate,
        });
      }
    } catch {
      toast.error('פרטי השוכר נשמרו, אך העדכון בשיוך ליחידה נכשל. הטופס נשאר פתוח כדי שתוכלו לנסות שוב.');
      return false;
    }
    return true;
  };

  const handleTenantSubmit = async (
    values: TenantFields & { unit_id: string | null; monthly_rent: number | null; start_date: string },
  ) => {
    setTenantFormSaving(true);
    const { unit_id, monthly_rent, start_date, ...fields } = values;
    try {
      const saved = editingTenant
        ? await saveEditedTenant(editingTenant, fields, unit_id, monthly_rent, start_date)
        : await saveNewTenant(fields, unit_id, monthly_rent, start_date);
      if (saved) {
        setAddingTenant(false);
        setEditingTenant(null);
      }
    } finally {
      setTenantFormSaving(false);
    }
  };

  const handleArchiveTenant = async (id: string) => {
    const activeTenancy = activeByTenantId.get(id);
    if (activeTenancy) await endTenancy({ id: activeTenancy.id, end_date: localDateISO() });
    await archiveTenant(id);
  };

  const handleArchiveUnit = async (id: string) => {
    const activeTenancy = activeByUnitId.get(id);
    if (activeTenancy) await endTenancy({ id: activeTenancy.id, end_date: localDateISO() });
    await archiveUnit(id);
  };

  const finishGuide = async (startWithUnit: boolean) => {
    setGuideSaving(true);
    try {
      await completeOnboarding(CURRENT_ONBOARDING_VERSION);
      setGuideOpen(false);
      setGuideDismissed(true);
      if (startWithUnit) {
        setTab('units');
        setAddingUnit(true);
        setEditingUnit(null);
      } else {
        setTab('overview');
      }
    } catch {
      toast.error('לא הצלחנו לשמור את סיום המדריך. נסו שוב.');
      return;
    } finally {
      setGuideSaving(false);
    }
  };

  const retryCore = () => {
    void Promise.all([refetchUnits(), refetchTenants(), refetchTenancies()]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader label="מכינים את המערכת..." />
      </div>
    );
  }

  if (!user) return <LandingPage />;

  const coreError = unitsError ?? tenantsError ?? tenanciesError;
  const hasCoreData = units.length > 0 || tenants.length > 0 || tenancies.length > 0;
  const blockingCoreError = Boolean(coreError) && !hasCoreData;
  const blockingPaymentsError = Boolean(tenanciesError || billingError) && tenancies.length === 0 && displayCharges.length === 0;
  const blockingUnitsError = Boolean(unitsError) && units.length === 0 && !addingUnit && !editingUnit;
  const blockingTenantsError = Boolean(tenantsError || tenanciesError) && tenants.length === 0 && !addingTenant && !editingTenant;

  return (
    <div className="min-h-screen bg-background page-confetti">
      <Helmet>
        <link rel="canonical" href="https://nihul-schhirut.lovable.app/" />
        <meta property="og:url" content="https://nihul-schhirut.lovable.app/" />
        <title>{`${TAB_TITLES[tab]} · ניהול שכירות`}</title>
      </Helmet>
      <header className="relative overflow-hidden rounded-b-[2.5rem] bg-primary/20 px-5 pb-20 pt-8 text-foreground sm:rounded-b-[4rem] sm:px-6">
        <div className="absolute -left-12 -top-16 h-48 w-48 rounded-full bg-primary/55" aria-hidden="true" />
        <div className="absolute -bottom-20 left-1/3 h-40 w-40 rotate-12 rounded-[2.5rem] bg-secondary" aria-hidden="true" />
        <div className="absolute right-[44%] top-10 h-10 w-10 rounded-full bg-accent" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-4xl leading-tight sm:text-6xl">השכירות מסודרת.<br />הראש שקט.</h1>
            <p className="mt-3 text-lg text-foreground/70">רואים מי שילם, מה נשאר ומתי מגיע החיוב הבא.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="rounded-full border-foreground/15 bg-white/55" onClick={() => setGuideOpen(true)} data-guide="help">
              <CircleHelp className="h-4 w-4" />
              מדריך
            </Button>
            <span className="hidden max-w-48 truncate rounded-full bg-white/70 px-4 py-2 text-sm md:block" dir="ltr" title={user.email ?? undefined}>{user.email}</span>
            <Button type="button" variant="outline" size="sm" className="rounded-full border-foreground/20 bg-white/35 text-foreground hover:bg-foreground hover:text-white" onClick={() => void signOut()} aria-label="התנתקות מהמערכת">
              <LogOut className="h-4 w-4" />
              התנתקות
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-10 max-w-6xl px-4 pb-16 sm:px-6">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AppTab)}>
          <div className="sticky top-2 z-20 mb-8 w-fit max-w-full overflow-x-auto rounded-2xl border bg-card/95 p-1.5 shadow-[0_12px_35px_-24px_rgba(23,50,77,0.55)] backdrop-blur" data-tour="navigation">
            <TabsList className="inline-flex h-auto w-auto min-w-max bg-transparent p-0" aria-label="ניווט ראשי">
              <TabsTrigger value="overview" data-guide="overview-tab" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">סקירה</TabsTrigger>
              <TabsTrigger value="payments" data-guide="payments-tab" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">תשלומים</TabsTrigger>
              <TabsTrigger value="units" data-guide="units-tab" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">יחידות</TabsTrigger>
              <TabsTrigger value="tenants" data-guide="tenants-tab" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">שוכרים</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            {blockingCoreError ? (
              <LoadError onRetry={retryCore} />
            ) : (
              <Dashboard
                units={units}
                tenants={tenants}
                activeByUnitId={activeByUnitId}
                activeByTenantId={activeByTenantId}
                isLoading={unitsLoading || tenantsLoading || tenanciesLoading}
                billingLoading={billingLoading}
                billingError={Boolean(billingError)}
                totalDue={paymentOverview.due}
                totalPaid={paymentOverview.paid}
                outstandingBalance={paymentOverview.outstanding}
                openChargeCount={paymentOverview.openCount}
                paymentPreview={paymentPreview}
                onAddUnit={() => { setTab('units'); setAddingUnit(true); }}
                onAddTenant={() => { setTab('tenants'); setAddingTenant(true); }}
                onEditUnit={(unit) => { setTab('units'); setEditingUnit(unit); }}
                onEditTenant={(tenant) => { setTab('tenants'); setEditingTenant(tenant); }}
                onGoUnits={() => setTab('units')}
                onGoTenants={() => setTab('tenants')}
                onGoPayments={() => setTab('payments')}
                onOpenTenantPayments={setSelectedPaymentTenancyId}
                onRetryBilling={() => { void refetchBilling(); }}
              />
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-0">
            {blockingPaymentsError ? (
              <LoadError onRetry={() => { void Promise.all([refetchTenancies(), refetchBilling()]); }} />
            ) : (
              <Suspense fallback={<PageLoader label="פותחים את מסך התשלומים..." />}>
                <PaymentsPage
                  tenancies={Array.from(activeByUnitId.values())}
                  allTenancies={tenancies}
                  charges={displayCharges}
                  paymentTerms={paymentTerms}
                  billingSettingsByTenancyId={billingSettingsByTenancyId}
                  occurrencesByTenancyId={occurrencesByTenancyId}
                  currentOccurrenceByTenancyId={currentOccurrenceByTenancyId}
                  currentRentByTenancyId={currentRentByTenancyId}
                  isLoading={billingLoading || tenanciesLoading}
                  pendingKeys={pendingTenancyIds}
                  focusedTenancyId={focusedPaymentTenancyId}
                  onClearFocus={clearPaymentFocus}
                  onAddTenant={() => { setTab('tenants'); setAddingTenant(true); }}
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
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="units" className="mt-0">
            {blockingUnitsError ? (
              <LoadError onRetry={() => { void refetchUnits(); }} />
            ) : addingUnit || editingUnit ? (
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                <Button type="button" variant="ghost" className="w-fit rounded-full" onClick={() => { setAddingUnit(false); setEditingUnit(null); }}>
                  <ArrowRight className="h-4 w-4" />
                  חזרה ליחידות
                </Button>
                <UnitForm
                  initialData={editingUnit ?? undefined}
                  submitLabel={editingUnit ? 'שמירת שינויים' : 'הוספת יחידה'}
                  isSubmitting={unitSaving}
                  onSubmit={async (values) => {
                    try {
                      if (editingUnit) await updateUnit({ id: editingUnit.id, patch: values });
                      else await createUnit(values);
                      setAddingUnit(false);
                      setEditingUnit(null);
                    } catch {
                      // The hook keeps the form open and explains the server error in a toast.
                    }
                  }}
                />
              </div>
            ) : (
              <section data-tour="units">
                <PageHeading
                  title="יחידות"
                  description="כל הנכסים שאתם מנהלים, עם מצב תפוסה ופרטי השכירות."
                  action={(
                    <Button type="button" className="rounded-full" size="lg" onClick={() => setAddingUnit(true)} data-guide="add-unit">
                      <Plus className="h-5 w-5" />
                      הוספת יחידה
                    </Button>
                  )}
                />

                {units.length > 3 && (
                  <div className="relative mb-6 max-w-md">
                    <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input value={unitQuery} onChange={(event) => setUnitQuery(event.target.value)} className="rounded-full bg-card pe-10" placeholder="חיפוש לפי שם או תיאור" aria-label="חיפוש יחידות" />
                  </div>
                )}

                {unitsLoading ? (
                  <PageLoader label="טוענים יחידות..." />
                ) : units.length === 0 ? (
                  <Card className="border-dashed bg-card text-center">
                    <CardContent className="px-6 py-12">
                      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60"><Home className="h-8 w-8" /></span>
                      <h3 className="font-display text-xl">מתחילים מהיחידה הראשונה</h3>
                      <p className="mx-auto mt-2 max-w-md text-muted-foreground">צריך רק שם. שכ״ד, מאפיינים ומסמכים אפשר להוסיף גם אחר כך.</p>
                      <Button type="button" className="mt-6 rounded-full" onClick={() => setAddingUnit(true)}><Plus className="h-4 w-4" />הוספת יחידה</Button>
                    </CardContent>
                  </Card>
                ) : filteredUnits.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="px-6 py-10 text-center"><p className="font-medium">לא נמצאו יחידות מתאימות</p><Button type="button" variant="link" onClick={() => setUnitQuery('')}>ניקוי החיפוש</Button></CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {filteredUnits.map((unit) => (
                      <UnitCard key={unit.id} unit={unit} activeTenantName={activeByUnitId.get(unit.id)?.tenant_name ?? null} onEdit={setEditingUnit} onArchive={handleArchiveUnit} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="tenants" className="mt-0">
            {blockingTenantsError ? (
              <LoadError onRetry={() => { void Promise.all([refetchTenants(), refetchTenancies()]); }} />
            ) : addingTenant || editingTenant ? (
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                <Button type="button" variant="ghost" className="w-fit rounded-full" onClick={() => { setAddingTenant(false); setEditingTenant(null); }}>
                  <ArrowRight className="h-4 w-4" />
                  חזרה לשוכרים
                </Button>
                <TenantForm
                  units={units}
                  occupiedUnitIds={new Set(activeByUnitId.keys())}
                  initialData={editingTenant ? {
                    ...editingTenant,
                    unit_id: activeByTenantId.get(editingTenant.id)?.unit_id ?? null,
                    monthly_rent: activeByTenantId.get(editingTenant.id)?.monthly_rent ?? null,
                    start_date: activeByTenantId.get(editingTenant.id)?.start_date ?? localDateISO(),
                  } : undefined}
                  submitLabel={editingTenant ? 'שמירת שינויים' : 'הוספת שוכר'}
                  isSubmitting={tenantFormSaving}
                  onSubmit={handleTenantSubmit}
                />
              </div>
            ) : (
              <section data-tour="tenants">
                <PageHeading
                  title="שוכרים"
                  description="פרטי קשר, שיוך ליחידה והסכום שסוכם לכל תקופת שכירות."
                  action={(
                    <Button type="button" className="rounded-full" size="lg" onClick={() => setAddingTenant(true)} data-guide="add-tenant">
                      <Plus className="h-5 w-5" />
                      הוספת שוכר
                    </Button>
                  )}
                />

                {tenants.length > 3 && (
                  <div className="relative mb-6 max-w-md">
                    <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input value={tenantQuery} onChange={(event) => setTenantQuery(event.target.value)} className="rounded-full bg-card pe-10" placeholder="חיפוש לפי שם, טלפון או מייל" aria-label="חיפוש שוכרים" />
                  </div>
                )}

                {tenantsLoading || tenanciesLoading ? (
                  <PageLoader label="טוענים שוכרים..." />
                ) : tenants.length === 0 ? (
                  <Card className="border-dashed bg-card text-center">
                    <CardContent className="px-6 py-12">
                      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/50"><Users className="h-8 w-8" /></span>
                      <h3 className="font-display text-xl">מוסיפים את השוכר הראשון</h3>
                      <p className="mx-auto mt-2 max-w-md text-muted-foreground">אפשר לשייך אותו ליחידה עכשיו, או לשמור את הפרטים ולחזור לשיוך בהמשך.</p>
                      <Button type="button" className="mt-6 rounded-full" onClick={() => setAddingTenant(true)}><Plus className="h-4 w-4" />הוספת שוכר</Button>
                    </CardContent>
                  </Card>
                ) : filteredTenants.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="px-6 py-10 text-center"><p className="font-medium">לא נמצאו שוכרים מתאימים</p><Button type="button" variant="link" onClick={() => setTenantQuery('')}>ניקוי החיפוש</Button></CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTenants.map((tenant) => (
                      <TenantCard key={tenant.id} tenant={tenant} unitName={activeByTenantId.get(tenant.id)?.unit_name ?? null} monthlyRent={activeByTenantId.get(tenant.id)?.monthly_rent ?? null} onEdit={setEditingTenant} onArchive={handleArchiveTenant} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <TenantPaymentSummaryDialog
        open={selectedPaymentTenancy !== null}
        tenancy={selectedPaymentTenancy}
        rentCharge={selectedPaymentTenancy ? currentRentByTenancyId.get(selectedPaymentTenancy.id) ?? null : null}
        additionalCharges={selectedAdditionalCharges}
        calendar={selectedPaymentTenancy
          ? (billingSettingsByTenancyId.get(selectedPaymentTenancy.id)?.calendar_type as BillingCalendar | undefined) ?? 'gregorian'
          : 'gregorian'}
        pendingKeys={pendingTenancyIds}
        onOpenChange={(open) => { if (!open) setSelectedPaymentTenancyId(null); }}
        onMarkRentPaid={markCurrentRentPaid}
        onSaveRentPayment={saveCurrentRentPayment}
        onMarkChargePaid={markChargePaid}
        onSaveChargePayment={saveChargePayment}
        onGoToDetails={openTenantPaymentDetails}
      />

      <FirstLoginGuide
        open={guideOpen}
        hasUnits={units.length > 0}
        saving={guideSaving}
        onOpenChange={(open) => { setGuideOpen(open); if (!open) setGuideDismissed(true); }}
        onNavigate={handleGuideNavigate}
        onComplete={() => finishGuide(false)}
        onStart={() => finishGuide(true)}
      />
    </div>
  );
};

export default Index;
