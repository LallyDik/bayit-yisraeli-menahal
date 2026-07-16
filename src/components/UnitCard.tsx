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
    <Card className={`card-hover overflow-hidden [border-inline-start-width:4px] ${activeTenantName ? 'border-primary' : 'border-secondary'}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Home className="w-5 h-5 text-primary" />
          {unit.name}
        </CardTitle>
        <Badge variant={activeTenantName ? 'default' : 'secondary'}>
          {activeTenantName ? 'תפוסה' : 'פנויה'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {(activeTenantName || unit.default_rent != null) && (
          <p className="truncate text-sm text-muted-foreground nums">
            {activeTenantName && <>שוכר: <span className="text-foreground">{activeTenantName}</span></>}
            {activeTenantName && unit.default_rent != null && ' · '}
            {unit.default_rent != null && <>₪{Number(unit.default_rent).toLocaleString()} מבוקש</>}
          </p>
        )}
        {details.length > 0 && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{details.join(' · ')}</p>
        )}
        <div className="flex gap-2 border-t pt-3">
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
