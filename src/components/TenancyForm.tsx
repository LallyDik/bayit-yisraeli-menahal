import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Link } from 'lucide-react';
import type { Unit, Tenant } from '@/types';

interface TenancyFormProps {
  units: Unit[];
  tenants: Tenant[];
  occupiedUnitIds: Set<string>;
  housedTenantIds: Set<string>;
  onSubmit: (values: {
    unit_id: string;
    tenant_id: string;
    monthly_rent: number;
    start_date: string;
  }) => void;
}

export const TenancyForm: React.FC<TenancyFormProps> = ({
  units, tenants, occupiedUnitIds, housedTenantIds, onSubmit,
}) => {
  const [unitId, setUnitId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [rent, setRent] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const freeUnits = units.filter((u) => !occupiedUnitIds.has(u.id));
  const freeTenants = tenants.filter((t) => !housedTenantIds.has(t.id));

  const handleUnitChange = (id: string) => {
    setUnitId(id);
    // Prefill from the unit's template. This is a starting value, not a binding one.
    const unit = units.find((u) => u.id === id);
    if (unit?.default_rent != null && rent === '') setRent(String(unit.default_rent));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId || !tenantId) return;
    onSubmit({
      unit_id: unitId,
      tenant_id: tenantId,
      monthly_rent: rent === '' ? 0 : Number(rent),
      start_date: startDate,
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="gradient-bg text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Link className="w-6 h-6" />
          שייך שוכר ליחידה
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {freeUnits.length === 0 || freeTenants.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {freeUnits.length === 0
              ? 'כל היחידות תפוסות. סיים תקופת שכירות קיימת כדי לפנות יחידה.'
              : 'כל השוכרים כבר משויכים ליחידה. הוסף שוכר חדש תחילה.'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-lg font-medium">יחידה</Label>
              <Select value={unitId} onValueChange={handleUnitChange}>
                <SelectTrigger className="text-lg p-3"><SelectValue placeholder="בחר יחידה פנויה" /></SelectTrigger>
                <SelectContent>
                  {freeUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-lg font-medium">שוכר</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="text-lg p-3"><SelectValue placeholder="בחר שוכר" /></SelectTrigger>
                <SelectContent>
                  {freeTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenancy-rent" className="text-lg font-medium">שכר דירה חודשי (₪)</Label>
              <Input
                id="tenancy-rent" type="number" min="0" value={rent} className="text-lg p-3 ltr"
                onChange={(e) => setRent(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                מולא מברירת המחדל של היחידה. אפשר לשנות — מרגע זה הסכום שייך לשוכר הזה בלבד.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenancy-start" className="text-base font-medium">תאריך כניסה</Label>
              <Input
                id="tenancy-start" type="date" value={startDate} className="text-lg p-3 ltr"
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full text-lg py-3 gradient-bg hover:opacity-90"
              disabled={!unitId || !tenantId}
            >
              שייך שוכר
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
