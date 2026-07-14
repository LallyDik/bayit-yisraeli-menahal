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
          <Button onClick={onAddUnit} className="gradient-bg hover:opacity-90 mt-4" size="lg">
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
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className="card-hover cursor-pointer"
          role="button"
          onClick={onGoUnits}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Home className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{units.length}</p>
                <p className="text-sm text-muted-foreground">יחידות</p>
                <p className="text-sm text-muted-foreground">
                  {occupiedUnits} תפוסות · {vacantUnits} פנויות
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="card-hover cursor-pointer"
          role="button"
          onClick={onGoTenants}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-sm text-muted-foreground">שוכרים</p>
                <p className="text-sm text-muted-foreground">
                  {assignedTenants} משויכים · {unassignedTenants} ללא יחידה
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <BarChart className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₪{monthlyIncome.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">הכנסה חודשית</p>
                <p className="text-sm text-muted-foreground">
                  מ-{activeTenancies.length} חוזים פעילים
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button onClick={onAddUnit} className="gradient-bg hover:opacity-90" size="lg">
          <Plus className="w-5 h-5" />
          הוסף יחידה
        </Button>
        <Button onClick={onAddTenant} variant="outline" size="lg">
          <Plus className="w-5 h-5" />
          הוסף שוכר
        </Button>
      </div>

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
                    <div>
                      <p className="font-semibold">{unit.name}</p>
                      {tenancy && (
                        <p className="text-sm text-muted-foreground">
                          {tenancy.tenant_name} · ₪{Number(tenancy.monthly_rent).toLocaleString()} לחודש
                        </p>
                      )}
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
