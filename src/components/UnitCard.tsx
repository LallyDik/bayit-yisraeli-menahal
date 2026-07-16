import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Pencil } from 'lucide-react';
import { ConfirmArchive } from '@/components/ConfirmArchive';
import type { Unit } from '@/types';

interface UnitCardProps {
  unit: Unit;
  activeTenantName: string | null;
  onEdit: (unit: Unit) => void;
  onArchive: (id: string) => void;
}

// != null (loose) on purpose: a stale client bundle after a schema change can
// see undefined for a column that no longer exists, and undefined must render
// as "absent", never as the string "undefined".
const unitDetails = (unit: Unit): string[] => {
  const details: string[] = [];
  if (unit.rooms != null) details.push(`${unit.rooms} חדרים`);
  if (unit.area_sqm != null) details.push(`${unit.area_sqm} מ"ר`);
  if (unit.condition != null) details.push(`מצב: ${unit.condition}`);
  if (unit.year_built_or_renovated != null) details.push(`נבנה/שופץ ${unit.year_built_or_renovated}`);
  if (unit.air_conditioned != null) details.push(unit.air_conditioned ? 'ממוזגת' : 'ללא מיזוג');
  if (unit.furnishing != null) details.push(unit.furnishing);
  return details;
};

export const UnitCard: React.FC<UnitCardProps> = ({ unit, activeTenantName, onEdit, onArchive }) => {
  const details = unitDetails(unit);
  return (
    <Card className={`card-hover [border-inline-start-width:4px] ${activeTenantName ? 'border-primary' : 'border-secondary'}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Home className="w-5 h-5 text-primary" />
          {unit.name}
        </CardTitle>
        <Badge variant={activeTenantName ? 'default' : 'secondary'}>
          {activeTenantName ?? 'פנויה'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {unit.default_rent != null && (
          <p className="text-sm text-muted-foreground nums">
            שכר דירה מבוקש: ₪{Number(unit.default_rent).toLocaleString()}
          </p>
        )}
        {details.length > 0 && (
          <p className="text-sm text-muted-foreground">{details.join(' · ')}</p>
        )}
        {unit.description && <p className="text-sm">{unit.description}</p>}
        {unit.notes && <p className="text-sm text-muted-foreground">{unit.notes}</p>}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(unit)}>
            <Pencil className="w-4 h-4" />
            ערוך
          </Button>
          <ConfirmArchive
            entityName={unit.name}
            entityKind="unit"
            activeAssignment={activeTenantName}
            onConfirm={() => onArchive(unit.id)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
