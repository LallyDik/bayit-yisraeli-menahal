
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, DollarSign } from 'lucide-react';
import { Tenant, MonthlyPayment, PaymentType } from '@/types';
import { getCurrentHebrewDate } from '@/utils/hebrewDates';
import { usePayments } from '@/hooks/usePayments';

interface PaymentManagementProps {
  tenant: Tenant;
  onBack: () => void;
}

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  tenant,
  onBack
}) => {
  const { payments, updatePaymentStatus, getPaymentByTenantAndMonth } = usePayments();
  const currentDate = getCurrentHebrewDate();
  const [selectedMonth] = useState(currentDate.month);
  const [selectedYear] = useState(currentDate.year);

  // Get or create current month payment
  const currentPayment = getPaymentByTenantAndMonth(tenant.id, selectedMonth, selectedYear);

  const paymentItems = [
    {
      type: 'rent' as PaymentType,
      label: 'שכירות',
      amount: tenant.monthlyRent || 0,
      paid: currentPayment?.rentPaid || 0
    },
    {
      type: 'electricity' as PaymentType,
      label: 'חשמל',
      amount: tenant.monthlyElectricity || 0,
      paid: currentPayment?.electricityPaid || 0
    },
    {
      type: 'water' as PaymentType,
      label: 'מים',
      amount: tenant.monthlyWater || 0,
      paid: currentPayment?.waterPaid || 0
    },
    {
      type: 'committee' as PaymentType,
      label: 'ועד בית',
      amount: tenant.monthlyCommittee || 0,
      paid: currentPayment?.committeePaid || 0
    },
    {
      type: 'gas' as PaymentType,
      label: 'גז',
      amount: tenant.monthlyGas || 0,
      paid: currentPayment?.gasPaid || 0
    }
  ];

  const totalAmount = paymentItems.reduce((sum, item) => sum + item.amount, 0);
  const paidAmount = paymentItems.reduce((sum, item) => sum + item.paid, 0);
  const remainingAmount = totalAmount - paidAmount;

  const handlePaymentChange = (paymentType: PaymentType, amount: number) => {
    // Create payment record if it doesn't exist
    if (!currentPayment) {
      const newPayment: MonthlyPayment = {
        id: Date.now().toString(),
        tenantId: tenant.id,
        hebrewMonth: selectedMonth,
        hebrewYear: selectedYear,
        rentPaid: paymentType === 'rent' ? amount : 0,
        electricityPaid: paymentType === 'electricity' ? amount : 0,
        waterPaid: paymentType === 'water' ? amount : 0,
        committeePaid: paymentType === 'committee' ? amount : 0,
        gasPaid: paymentType === 'gas' ? amount : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const currentPayments = JSON.parse(localStorage.getItem('payments') || '[]');
      currentPayments.push(newPayment);
      localStorage.setItem('payments', JSON.stringify(currentPayments));
      window.location.reload(); // Trigger re-render
    } else {
      updatePaymentStatus(currentPayment.id, paymentType, amount);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
        <h2 className="text-2xl font-bold">ניהול תשלומים - {tenant.name}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">תקופה</p>
                <p className="font-semibold">{selectedMonth} {selectedYear}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">שולם</p>
                <p className="font-semibold text-green-600">₪{paidAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">נשאר לשלם</p>
                <p className="font-semibold text-red-600">₪{remainingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            פירוט תשלומים
            <Badge variant={remainingAmount === 0 ? "default" : "destructive"}>
              {remainingAmount === 0 ? "הכל שולם" : `נשאר ₪${remainingAmount.toLocaleString()}`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentItems.map((item) => {
            const remaining = item.amount - item.paid;
            return (
              <div key={item.type} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">
                      סה"כ: ₪{item.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`payment-${item.type}`} className="text-sm">
                      שולם:
                    </Label>
                    <Input
                      id={`payment-${item.type}`}
                      type="number"
                      value={item.paid}
                      onChange={(e) => 
                        handlePaymentChange(item.type, Number(e.target.value))
                      }
                      min="0"
                      max={item.amount}
                      className="w-24 text-sm ltr"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={remaining === 0 ? "default" : "secondary"}>
                    {remaining === 0 ? "הושלם" : `נשאר ₪${remaining.toLocaleString()}`}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
