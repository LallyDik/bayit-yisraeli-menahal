
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, DollarSign } from 'lucide-react';
import { Tenant, MonthlyPayment, PaymentType } from '@/types';
import { getCurrentHebrewDate, getPaymentTypeLabel } from '@/utils/hebrewDates';
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
      amount: tenant.monthlyRent,
      paid: currentPayment?.rentPaid || false
    },
    {
      type: 'electricity' as PaymentType,
      label: 'חשמל',
      amount: tenant.monthlyElectricity,
      paid: currentPayment?.electricityPaid || false
    },
    {
      type: 'water' as PaymentType,
      label: 'מים',
      amount: tenant.monthlyWater,
      paid: currentPayment?.waterPaid || false
    },
    {
      type: 'committee' as PaymentType,
      label: 'ועד בית',
      amount: tenant.monthlyCommittee,
      paid: currentPayment?.committeePaid || false
    }
  ];

  const totalAmount = paymentItems.reduce((sum, item) => sum + item.amount, 0);
  const paidAmount = paymentItems.reduce((sum, item) => sum + (item.paid ? item.amount : 0), 0);
  const unpaidAmount = totalAmount - paidAmount;

  const handlePaymentToggle = (paymentType: PaymentType, checked: boolean) => {
    // Create payment record if it doesn't exist
    if (!currentPayment) {
      const newPayment: MonthlyPayment = {
        id: Date.now().toString(),
        tenantId: tenant.id,
        hebrewMonth: selectedMonth,
        hebrewYear: selectedYear,
        rentPaid: paymentType === 'rent' ? checked : false,
        electricityPaid: paymentType === 'electricity' ? checked : false,
        waterPaid: paymentType === 'water' ? checked : false,
        committeePaid: paymentType === 'committee' ? checked : false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const currentPayments = JSON.parse(localStorage.getItem('payments') || '[]');
      currentPayments.push(newPayment);
      localStorage.setItem('payments', JSON.stringify(currentPayments));
      window.location.reload(); // Trigger re-render
    } else {
      updatePaymentStatus(currentPayment.id, paymentType, checked);
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
                <p className="text-sm text-muted-foreground">לא שולם</p>
                <p className="font-semibold text-red-600">₪{unpaidAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            פירוט תשלומים
            <Badge variant={unpaidAmount === 0 ? "default" : "destructive"}>
              {unpaidAmount === 0 ? "הכל שולם" : `חסר ₪${unpaidAmount.toLocaleString()}`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentItems.map((item) => (
            <div key={item.type} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={item.paid}
                  onCheckedChange={(checked) => 
                    handlePaymentToggle(item.type, checked as boolean)
                  }
                  className="w-5 h-5"
                />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    ₪{item.amount.toLocaleString()}
                  </p>
                </div>
              </div>
              <Badge variant={item.paid ? "default" : "secondary"}>
                {item.paid ? "שולם" : "לא שולם"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
