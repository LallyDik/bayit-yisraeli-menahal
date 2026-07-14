import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Pencil, Archive } from 'lucide-react';
import type { Unit } from '@/types';

interface UnitCardProps {
  unit: Unit;
  activeTenantName: string | null;
  onEdit: (unit: Unit) => void;
  onArchive: (id: string) => void;
}

export const UnitCard: React.FC<UnitCardProps> = ({ unit, activeTenantName, onEdit, onArchive }) => (
  <Card className="card-hover">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Home className="w-5 h-5 text-primary" />
        {unit.name}
      </CardTitle>
      <Badge variant={activeTenantName ? 'default' : 'secondary'}>
        {activeTenantName ?? 'פנויה'}
      </Badge>
    </CardHeader>
    <CardContent className="space-y-4">
      {unit.default_rent !== null && (
        <p className="text-sm text-muted-foreground">
          שכר דירה מבוקש: ₪{Number(unit.default_rent).toLocaleString()}
        </p>
      )}
      {unit.description && <p className="text-sm">{unit.description}</p>}
      {unit.notes && <p className="text-sm text-muted-foreground">{unit.notes}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(unit)}>
          <Pencil className="w-4 h-4 ml-2" />
          ערוך
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onArchive(unit.id)}>
          <Archive className="w-4 h-4 ml-2" />
          העבר לארכיון
        </Button>
      </div>
    </CardContent>
  </Card>
);
