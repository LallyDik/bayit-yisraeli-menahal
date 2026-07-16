import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Users, BarChart, Plus } from 'lucide-react';
import type { Unit, Tenant } from '@/types';
import type { TenancyWithNames } from '@/api/tenancies';

interface DashboardProps {
  units: Unit[];
  tenants: Tenant[];
  activeByUnitId: Map<string, TenancyWithNames>;
  activeByTenantId: Map<string, TenancyWithNames>;
  isLoading: boolean;
  onAddUnit: () => void;
  onAddTenant: () => void;
  onEditUnit: (unit: Unit) => void;
  onEditTenant: (tenant: Tenant) => void;
  onGoUnits: () => void;
  onGoTenants: () => void;
  children?: React.ReactNode;
}

export const Dashboard: React.FC<DashboardProps> = ({
  units,
  tenants,
  activeByUnitId,
  activeByTenantId,
  isLoading,
  onAddUnit,
  onAddTenant,
  onEditUnit,
  onEditTenant,
  onGoUnits,
  onGoTenants,
  children,
}) => {
  if (isLoading) {
    return <p className="text-center text-muted-foreground">טוען...</p>;
  }

  if (units.length === 0 && tenants.length === 0) {
    return (
      <Card className="text-center p-12">
        <CardContent>
          <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">ברוך הבא! התחל בהוספת היחידה הראשונה שלך</h3>
          <Button onClick={onAddUnit} className="mt-4" size="lg">
            <Plus className="w-5 h-5" />
            הוסף יחידה
          </Button>
        </CardContent>
      </Card>
    );
  }

  const occupiedUnits = units.filter((u) => activeByUnitId.has(u.id)).length;
  const vacantUnits = units.length - occupiedUnits;

  const assignedTenants = tenants.filter((t) => activeByTenantId.has(t.id)).length;
  const unassignedTenants = tenants.length - assignedTenants;

  const activeTenancies = Array.from(activeByUnitId.values());
  const monthlyIncome = activeTenancies.reduce((sum, t) => sum + Number(t.monthly_rent), 0);
  const tenantsWithoutUnit = tenants.filter((t) => !activeByTenantId.has(t.id));

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <Card
          className="card-hover cursor-pointer md:col-span-5 rounded-[2rem] border-0 bg-primary/70 text-primary-foreground"
          role="button"
          onClick={onGoUnits}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl rotate-3 bg-white/45 flex items-center justify-center">
                <Home className="w-7 h-7 text-foreground" />
              </div>
              <div>
                <p className="text-4xl font-display nums">{units.length}</p>
                <div className="my-2 h-0.5 w-10 bg-secondary" />
                <p className="text-sm text-foreground/80">יחידות</p>
                <p className="text-sm text-foreground/70">
                  {occupiedUnits} תפוסות · {vacantUnits} פנויות
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="card-hover cursor-pointer md:col-span-3 rounded-[2rem] border-0 bg-secondary"
          role="button"
          onClick={onGoTenants}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl -rotate-3 bg-white/45 flex items-center justify-center">
                <Users className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-4xl font-display nums">{tenants.length}</p>
                <div className="my-2 h-0.5 w-10 bg-foreground/25" />
                <p className="text-sm text-muted-foreground">שוכרים</p>
                <p className="text-sm text-muted-foreground">
                  {assignedTenants} משויכים · {unassignedTenants} ללא יחידה
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover md:col-span-4 rounded-[2rem] border-0 bg-accent/90">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl rotate-6 bg-white/45 flex items-center justify-center">
                <BarChart className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-4xl font-display nums">₪{monthlyIncome.toLocaleString()}</p>
                <div className="my-2 h-0.5 w-10 bg-foreground/25" />
                <p className="text-sm text-muted-foreground">הכנסה חודשית</p>
                <p className="text-sm text-muted-foreground">
                  מ-{activeTenancies.length} חוזים פעילים
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3 rounded-[2rem] border bg-card p-4">
        <Button onClick={onAddUnit} className="rounded-full" size="lg">
          <Plus className="w-5 h-5" />
          הוסף יחידה
        </Button>
        <Button onClick={onAddTenant} variant="outline" className="rounded-full" size="lg">
          <Plus className="w-5 h-5" />
          הוסף שוכר
        </Button>
      </div>

      {children}

      <div>
        <h2 className="text-2xl font-bold mb-4">מצב היחידות</h2>
        {units.length === 0 ? (
          <p className="text-muted-foreground">אין יחידות במערכת</p>
        ) : (
          <div className="space-y-2">
            {units.map((unit) => {
              const tenancy = activeByUnitId.get(unit.id);
              return (
                <Card
                  key={unit.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => onEditUnit(unit)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${tenancy ? 'bg-primary' : 'bg-secondary'}`} aria-hidden="true" />
                      <div>
                      <p className="font-display">{unit.name}</p>
                      {tenancy && (
                        <p className="text-sm text-muted-foreground">
                          <span className="nums">{tenancy.tenant_name} · ₪{Number(tenancy.monthly_rent).toLocaleString()} לחודש</span>
                        </p>
                      )}
                      </div>
                    </div>
                    <Badge variant={tenancy ? 'default' : 'secondary'}>
                      {tenancy ? 'תפוסה' : 'פנויה'}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {tenantsWithoutUnit.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">שוכרים ללא יחידה</h2>
          <div className="space-y-2">
            {tenantsWithoutUnit.map((tenant) => (
              <Card
                key={tenant.id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => onEditTenant(tenant)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{tenant.name}</p>
                    {tenant.phone && (
                      <p className="text-sm text-muted-foreground">{tenant.phone}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
