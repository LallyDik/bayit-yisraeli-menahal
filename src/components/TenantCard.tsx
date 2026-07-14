import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Pencil } from 'lucide-react';
import { ConfirmArchive } from '@/components/ConfirmArchive';
import type { Tenant } from '@/types';

interface TenantCardProps {
  tenant: Tenant;
  unitName: string | null;
  monthlyRent: number | null;
  onEdit: (tenant: Tenant) => void;
  onArchive: (id: string) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({
  tenant, unitName, monthlyRent, onEdit, onArchive,
}) => (
  <Card className="card-hover">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-lg">
        <User className="w-5 h-5 text-primary" />
        {tenant.name}
      </CardTitle>
      <Badge variant={unitName ? 'default' : 'secondary'}>
        {unitName ?? 'ללא יחידה'}
      </Badge>
    </CardHeader>
    <CardContent className="space-y-4">
      {monthlyRent != null && (
        <p className="text-sm text-muted-foreground">
          שכר דירה: ₪{Number(monthlyRent).toLocaleString()} לחודש
        </p>
      )}
      {tenant.phone && <p className="text-sm text-muted-foreground ltr text-right">{tenant.phone}</p>}
      {tenant.email && <p className="text-sm text-muted-foreground ltr text-right">{tenant.email}</p>}
      {tenant.description && <p className="text-sm">{tenant.description}</p>}
      {tenant.notes && <p className="text-sm text-muted-foreground">{tenant.notes}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(tenant)}>
          <Pencil className="w-4 h-4" />
          ערוך
        </Button>
        <ConfirmArchive entityName={tenant.name} onConfirm={() => onArchive(tenant.id)} />
      </div>
    </CardContent>
  </Card>
);
