import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart, CheckCircle2, Home, Plus, ReceiptText, Users } from 'lucide-react';
import type { Unit, Tenant } from '@/types';
import type { TenancyWithNames } from '@/api/tenancies';

export interface TenantPaymentPreview {
  id: string;
  unitName: string;
  tenantName: string;
  rentDue: number;
  rentPaid: number;
  rentHasCharge: boolean;
  additionalCount: number;
  additionalDue: number;
  additionalPaid: number;
  additionalOpenCount: number;
}

interface DashboardProps {
  units: Unit[];
  tenants: Tenant[];
  activeByUnitId: Map<string, TenancyWithNames>;
  activeByTenantId: Map<string, TenancyWithNames>;
  isLoading: boolean;
  billingLoading: boolean;
  billingError: boolean;
  totalDue: number;
  totalPaid: number;
  outstandingBalance: number;
  openChargeCount: number;
  paymentPreview: TenantPaymentPreview[];
  onAddUnit: () => void;
  onAddTenant: () => void;
  onEditUnit: (unit: Unit) => void;
  onEditTenant: (tenant: Tenant) => void;
  onGoUnits: () => void;
  onGoTenants: () => void;
  onGoPayments: () => void;
  onOpenTenantPayments: (tenancyId: string) => void;
  onRetryBilling: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  units,
  tenants,
  activeByUnitId,
  activeByTenantId,
  isLoading,
  billingLoading,
  billingError,
  totalDue,
  totalPaid,
  outstandingBalance,
  openChargeCount,
  paymentPreview,
  onAddUnit,
  onAddTenant,
  onEditUnit,
  onEditTenant,
  onGoUnits,
  onGoTenants,
  onGoPayments,
  onOpenTenantPayments,
  onRetryBilling,
}) => {
  if (isLoading) {
    return <p className="py-12 text-center text-muted-foreground" role="status">טוען את הסקירה...</p>;
  }

  if (units.length === 0 && tenants.length === 0) {
    return (
      <Card className="p-8 text-center sm:p-12">
        <CardContent className="p-0">
          <Home className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
          <h2 className="font-display text-2xl">ברוכים הבאים! מתחילים בדירה הראשונה</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">צריך רק שם לדירה. את שאר הפרטים אפשר להשלים אחר כך.</p>
          <Button type="button" onClick={onAddUnit} className="mt-6 rounded-full" size="lg">
            <Plus className="h-5 w-5" />
            הוספת דירה
          </Button>
        </CardContent>
      </Card>
    );
  }

  const occupiedUnits = units.filter((unit) => activeByUnitId.has(unit.id)).length;
  const vacantUnits = units.length - occupiedUnits;
  const assignedTenants = tenants.filter((tenant) => activeByTenantId.has(tenant.id)).length;
  const unassignedTenants = tenants.length - assignedTenants;
  const activeTenancies = Array.from(activeByUnitId.values());
  const monthlyIncome = activeTenancies.reduce((sum, tenancy) => sum + Number(tenancy.monthly_rent), 0);
  const tenantsWithoutUnit = tenants.filter((tenant) => !activeByTenantId.has(tenant.id));

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-12" aria-label="תמונת מצב">
        <button type="button" className="card-hover rounded-[2rem] bg-primary/70 p-6 text-start md:col-span-5" onClick={onGoUnits}>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/45"><Home className="h-7 w-7" /></span>
            <span>
              <span className="block font-display text-4xl nums">{units.length}</span>
              <span className="block text-sm font-medium">דירות</span>
              <span className="mt-1 block text-sm text-foreground/65">{occupiedUnits} תפוסות · {vacantUnits} פנויות</span>
            </span>
          </div>
        </button>

        <button type="button" className="card-hover rounded-[2rem] bg-secondary p-6 text-start md:col-span-3" onClick={onGoTenants}>
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/45"><Users className="h-6 w-6" /></span>
            <span>
              <span className="block font-display text-4xl nums">{tenants.length}</span>
              <span className="block text-sm font-medium">שוכרים</span>
              <span className="mt-1 block text-sm text-foreground/65">{assignedTenants} משויכים · {unassignedTenants} ללא דירה</span>
            </span>
          </div>
        </button>

        <div className="rounded-[2rem] bg-accent/90 p-6 md:col-span-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/45"><BarChart className="h-6 w-6" /></span>
            <span>
              <span className="block font-display text-3xl nums">₪{monthlyIncome.toLocaleString()}</span>
              <span className="block text-sm font-medium">הכנסה חודשית</span>
              <span className="mt-1 block text-sm text-foreground/65">{activeTenancies.length} שכירויות פעילות</span>
            </span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 rounded-[2rem] border bg-card p-4">
        <Button type="button" onClick={onAddUnit} className="rounded-full" size="lg"><Plus className="h-5 w-5" />הוספת דירה</Button>
        <Button type="button" onClick={onAddTenant} variant="outline" className="rounded-full" size="lg"><Plus className="h-5 w-5" />הוספת שוכר</Button>
      </div>

      <section className="rounded-[2rem] border bg-card p-5 sm:p-6" aria-labelledby="payments-summary-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary" aria-hidden="true">
              {openChargeCount > 0 ? <ReceiptText className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div>
              <h2 id="payments-summary-title" className="font-display text-xl">מצב התשלומים</h2>
              <p className="text-sm text-muted-foreground">כל החיובים שהגיע מועד התשלום שלהם עד היום · הפירוט המלא במסך התשלומים</p>
            </div>
          </div>
          <Button type="button" variant="outline" className="rounded-full" onClick={onGoPayments}>לכל התשלומים <ArrowLeft className="h-4 w-4" /></Button>
        </div>

        {billingError ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted p-4 text-sm">
            <span>לא הצלחנו לעדכן את מצב התשלומים.</span>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onRetryBilling}>נסו שוב</Button>
          </div>
        ) : billingLoading ? (
          <p className="mt-5 text-sm text-muted-foreground" role="status">מעדכן את מצב התשלומים...</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 divide-y rounded-2xl bg-muted p-2 text-center sm:grid-cols-3 sm:divide-x-reverse sm:divide-x sm:divide-y-0">
            <div className="min-w-0 px-2 py-2"><p className="text-xs text-muted-foreground">לתשלום עד היום</p><p className="mt-1 break-words text-sm font-bold nums sm:text-base">₪{totalDue.toLocaleString()}</p></div>
            <div className="min-w-0 px-2 py-2"><p className="text-xs text-muted-foreground">שולם</p><p className="mt-1 break-words text-sm font-bold nums sm:text-base">₪{totalPaid.toLocaleString()}</p></div>
            <div className="min-w-0 px-2 py-2"><p className="text-xs text-muted-foreground">נשאר</p><p className="mt-1 break-words text-sm font-bold nums sm:text-base">₪{Math.max(outstandingBalance, 0).toLocaleString()}</p></div>
          </div>
        )}
        {!billingLoading && !billingError && (
          <p className="mt-3 text-sm text-muted-foreground">{openChargeCount > 0 ? `${openChargeCount} חיובים עדיין פתוחים` : 'כל החיובים שנוצרו מסומנים כשולמו'}</p>
        )}

        {!billingLoading && !billingError && paymentPreview.length > 0 && (
          <div className="mt-4 divide-y overflow-hidden rounded-2xl border" aria-label="מצב תשלומים לפי שוכר">
            {paymentPreview.map((item) => {
              const rentRemaining = Math.max(item.rentDue - item.rentPaid, 0);
              const rentStatus = !item.rentHasCharge ? 'טרם חויב' : rentRemaining === 0 ? 'שולם' : item.rentPaid > 0 ? 'חלקי' : 'פתוח';
              const additionalRemaining = Math.max(item.additionalDue - item.additionalPaid, 0);
              const additionalStatus = item.additionalCount === 0
                ? 'אין חיובים'
                : additionalRemaining === 0
                  ? 'שולם'
                  : item.additionalPaid > 0
                    ? 'חלקי'
                    : 'פתוח';
              return (
                <button
                  key={item.id}
                  type="button"
                  className="group w-full bg-background px-4 py-3.5 text-start transition-colors hover:bg-muted focus-visible:bg-muted"
                  onClick={() => onOpenTenantPayments(item.id)}
                  aria-label={`פתיחת תשלומים מהירה עבור ${item.tenantName}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.tenantName} · {item.unitName}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">לחצו לסימון תשלום או לפתיחת הפירוט</span>
                    </div>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-primary/[0.06] px-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">שכר דירה</span>
                        <span className="block truncate text-xs text-muted-foreground nums">{!item.rentHasCharge ? `צפוי ₪${item.rentDue.toLocaleString()}` : rentRemaining > 0 ? `נשאר ₪${rentRemaining.toLocaleString()}` : `₪${item.rentDue.toLocaleString()}`}</span>
                      </span>
                      <Badge variant={rentStatus === 'שולם' ? 'default' : rentStatus === 'פתוח' ? 'destructive' : 'secondary'} className="shrink-0">{rentStatus}</Badge>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-secondary/25 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">תשלומים נוספים</span>
                        <span className="block truncate text-xs text-muted-foreground nums">
                          {item.additionalCount === 0 ? 'אין חיובים שהגיע זמנם' : `${item.additionalOpenCount} פתוחים · נשאר ₪${additionalRemaining.toLocaleString()}`}
                        </span>
                      </span>
                      <Badge variant={additionalStatus === 'שולם' ? 'default' : additionalStatus === 'פתוח' ? 'destructive' : 'secondary'} className="shrink-0">{additionalStatus}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="units-status-title">
        <h2 id="units-status-title" className="mb-4 text-2xl font-bold">מצב הדירות</h2>
        <div className="space-y-2">
          {units.map((unit) => {
            const tenancy = activeByUnitId.get(unit.id);
            return (
              <button key={unit.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-accent/40" onClick={() => onEditUnit(unit)}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${tenancy ? 'bg-primary' : 'bg-secondary'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-display">{unit.name}</span>
                    {tenancy && <span className="block truncate text-sm text-muted-foreground nums">{tenancy.tenant_name} · ₪{Number(tenancy.monthly_rent).toLocaleString()}</span>}
                  </span>
                </span>
                <Badge variant={tenancy ? 'default' : 'secondary'}>{tenancy ? 'תפוסה' : 'פנויה'}</Badge>
              </button>
            );
          })}
        </div>
      </section>

      {tenantsWithoutUnit.length > 0 && (
        <section aria-labelledby="unassigned-title">
          <h2 id="unassigned-title" className="mb-4 text-2xl font-bold">שוכרים ללא דירה</h2>
          <div className="space-y-2">
            {tenantsWithoutUnit.map((tenant) => (
              <button key={tenant.id} type="button" className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-start transition-colors hover:bg-accent/40" onClick={() => onEditTenant(tenant)}>
                <span>
                  <span className="block font-semibold">{tenant.name}</span>
                  {tenant.phone && <span className="block text-sm text-muted-foreground" dir="ltr">{tenant.phone}</span>}
                </span>
                <Badge variant="secondary">ללא דירה</Badge>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
