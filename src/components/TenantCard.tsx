
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Receipt, Edit3, Trash2 } from 'lucide-react';
import { Tenant } from '@/types';

interface TenantCardProps {
  tenant: Tenant;
  onEdit?: (tenant: Tenant) => void;
  onDelete?: (tenantId: string) => void;
  onViewPayments?: (tenant: Tenant) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({
  tenant,
  onEdit,
  onDelete,
  onViewPayments
}) => {
  const totalMonthly = 
    (tenant.monthlyRent || 0) + 
    (tenant.monthlyElectricity || 0) + 
    (tenant.monthlyWater || 0) + 
    (tenant.monthlyCommittee || 0) +
    (tenant.monthlyGas || 0);

  return (
    <Card className="w-full card-hover">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">{tenant.name}</span>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            ₪{totalMonthly.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">שכירות:</span>
            <span className="font-semibold">₪{(tenant.monthlyRent || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">חשמל:</span>
            <span className="font-semibold">₪{(tenant.monthlyElectricity || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">מים:</span>
            <span className="font-semibold">₪{(tenant.monthlyWater || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ועד בית:</span>
            <span className="font-semibold">₪{(tenant.monthlyCommittee || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">גז:</span>
            <span className="font-semibold">₪{(tenant.monthlyGas || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t pt-3">
          <h4 className="text-sm font-medium mb-2">קריאות מונים:</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <span className="text-muted-foreground block">מים</span>
              <span className="font-semibold">{tenant.waterMeter || 0}</span>
            </div>
            <div className="text-center">
              <span className="text-muted-foreground block">חשמל</span>
              <span className="font-semibold">{tenant.electricityMeter || 0}</span>
            </div>
            <div className="text-center">
              <span className="text-muted-foreground block">גז</span>
              <span className="font-semibold">{tenant.gasMeter || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {onViewPayments && (
            <Button
              onClick={() => onViewPayments(tenant)}
              variant="default"
              size="sm"
              className="flex-1"
            >
              <Receipt className="w-4 h-4 ml-2" />
              ניהול תשלומים
            </Button>
          )}
          
          {onEdit && (
            <Button
              onClick={() => onEdit(tenant)}
              variant="outline"
              size="sm"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          )}
          
          {onDelete && (
            <Button
              onClick={() => onDelete(tenant.id)}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
