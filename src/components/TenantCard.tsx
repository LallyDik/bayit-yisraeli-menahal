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
  <Card className={`card-hover overflow-hidden [border-inline-start-width:4px] ${unitName ? 'border-primary' : 'border-secondary'}`}>
    <CardHeader className="flex flex-row items-center justify-between gap-3 p-5 pb-3">
      <CardTitle className="flex items-center gap-2 text-lg font-display">
        <User className="w-5 h-5 text-primary" />
        {tenant.name}
      </CardTitle>
      <Badge variant={unitName ? 'default' : 'secondary'}>
        {unitName ?? 'ללא דירה'}
      </Badge>
    </CardHeader>
    <CardContent className="space-y-3 p-5 pt-0">
      {monthlyRent != null && (
        <p className="text-sm text-muted-foreground nums">
          ₪{Number(monthlyRent).toLocaleString()} לחודש
        </p>
      )}
      {(tenant.phone || tenant.email) && (
        <p className="truncate text-sm text-muted-foreground" dir="ltr">
          {tenant.phone}{tenant.phone && tenant.email && ' · '}{tenant.email}
        </p>
      )}
      <div className="flex gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={() => onEdit(tenant)}>
          <Pencil className="w-4 h-4" />
          ערוך
        </Button>
        <ConfirmArchive
          entityName={tenant.name}
          entityKind="tenant"
          activeAssignment={unitName}
          onConfirm={() => onArchive(tenant.id)}
        />
      </div>
    </CardContent>
  </Card>
);
