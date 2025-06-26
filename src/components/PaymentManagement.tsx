import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, DollarSign, Settings, AlertCircle } from 'lucide-react';
import { Tenant, MonthlyPayment, PaymentType } from '@/types';
import { getCurrentHebrewDate, HEBREW_MONTHS } from '@/utils/hebrewDates';
import { usePayments } from '@/hooks/usePayments';

interface PaymentManagementProps {
  tenant: Tenant;
  onBack: () => void;
  onTenantUpdate?: (id: string, updates: Partial<Tenant>) => void;
}

const paymentLabels: Record<PaymentType, string> = {
  rent: 'שכירות',
  electricity: 'חשמל',
  water: 'מים',
  committee: 'ועד בית',
  gas: 'גז',
};

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  tenant,
  onBack,
  onTenantUpdate
}) => {
  const { payments, updatePaymentStatus, getPaymentByTenantAndMonth } = usePayments();
  const currentDate = getCurrentHebrewDate();
  const [selectedMonth] = useState(currentDate.month);
  const [selectedYear] = useState(currentDate.year);
  const [editingMeters, setEditingMeters] = useState(false);
  const [meterValues, setMeterValues] = useState({
    waterMeter: tenant.waterMeter || 0,
    electricityMeter: tenant.electricityMeter || 0,
    gasMeter: tenant.gasMeter || 0
  });

  // --- ערכי תשלום לעריכה ---
  const currentPayment = getPaymentByTenantAndMonth(tenant.id, selectedMonth, selectedYear);
  const [editValues, setEditValues] = useState({
    rentPaid: currentPayment?.rentPaid || 0,
    electricityPaid: currentPayment?.electricityPaid || 0,
    waterPaid: currentPayment?.waterPaid || 0,
    committeePaid: currentPayment?.committeePaid || 0,
    gasPaid: currentPayment?.gasPaid || 0,
  });

  // אתחול ערכים מחדש אם currentPayment משתנה
  useEffect(() => {
    setEditValues({
      rentPaid: currentPayment?.rentPaid || 0,
      electricityPaid: currentPayment?.electricityPaid || 0,
      waterPaid: currentPayment?.waterPaid || 0,
      committeePaid: currentPayment?.committeePaid || 0,
      gasPaid: currentPayment?.gasPaid || 0,
    });
  }, [currentPayment]);

  // סטייט שמירה נפרד לכל שדה
  const [saving, setSaving] = useState<{ [key in PaymentType]?: boolean }>({});

  // Get previous month payment for debt calculation
  const getPreviousMonthIndex = (currentIndex: number) => {
    return currentIndex === 0 ? 11 : currentIndex - 1;
  };

  const previousMonthIndex = getPreviousMonthIndex(currentDate.monthIndex);
  const previousMonth = HEBREW_MONTHS[previousMonthIndex];
  const previousMonthPayment = getPaymentByTenantAndMonth(tenant.id, previousMonth, selectedYear);

  // Calculate previous month debt
  const calculatePreviousMonthDebt = () => {
    if (!previousMonthPayment) return 0;
    const totalAmount = (tenant.monthlyRent || 0) + (tenant.monthlyElectricity || 0) +
      (tenant.monthlyWater || 0) + (tenant.monthlyCommittee || 0) + (tenant.monthlyGas || 0);
    const paidAmount = (previousMonthPayment.rentPaid || 0) + (previousMonthPayment.electricityPaid || 0) +
      (previousMonthPayment.waterPaid || 0) + (previousMonthPayment.committeePaid || 0) +
      (previousMonthPayment.gasPaid || 0);
    return Math.max(0, totalAmount - paidAmount);
  };

  const previousMonthDebt = calculatePreviousMonthDebt();

  const paymentItems = [
    {
      type: 'rent' as PaymentType,
      label: 'שכירות',
      amount: tenant.monthlyRent,
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
  const remainingAmount = totalAmount - paidAmount + previousMonthDebt;

  const handleMeterUpdate = () => {
    if (onTenantUpdate) {
      onTenantUpdate(tenant.id, meterValues);
      setEditingMeters(false);
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">תקופה נוכחית</p>
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
                <p className="text-sm text-muted-foreground">שולם החודש</p>
                <p className="font-semibold text-green-600">₪{paidAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {previousMonthDebt > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">חוב מ{previousMonth}</p>
                  <p className="font-semibold text-orange-600">₪{previousMonthDebt.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">סה"כ נשאר</p>
                <p className="font-semibold text-red-600">₪{remainingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            קריאות מונים נוכחיות
            <Button
              onClick={() => setEditingMeters(!editingMeters)}
              variant="outline"
              size="sm"
            >
              <Settings className="w-4 h-4 ml-2" />
              {editingMeters ? 'ביטול' : 'עריכה'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingMeters ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="water-meter">מונה מים</Label>
                  <Input
                    id="water-meter"
                    type="number"
                    value={meterValues.waterMeter || ''}
                    onChange={(e) => setMeterValues(prev => ({
                      ...prev,
                      waterMeter: Number(e.target.value) || 0
                    }))}
                    className="ltr no-arrows"
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="electricity-meter">מונה חשמל</Label>
                  <Input
                    id="electricity-meter"
                    type="number"
                    value={meterValues.electricityMeter || ''}
                    onChange={(e) => setMeterValues(prev => ({
                      ...prev,
                      electricityMeter: Number(e.target.value) || 0
                    }))}
                    className="ltr no-arrows"
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gas-meter">מונה גז</Label>
                  <Input
                    id="gas-meter"
                    type="number"
                    value={meterValues.gasMeter || ''}
                    onChange={(e) => setMeterValues(prev => ({
                      ...prev,
                      gasMeter: Number(e.target.value) || 0
                    }))}
                    className="ltr no-arrows"
                    placeholder=""
                  />
                </div>
              </div>
              <Button onClick={handleMeterUpdate} className="w-full">
                עדכן קריאות מונים
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">מים</p>
                <p className="text-2xl font-bold">{tenant.waterMeter || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">חשמל</p>
                <p className="text-2xl font-bold">{tenant.electricityMeter || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">גז</p>
                <p className="text-2xl font-bold">{tenant.gasMeter || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            פירוט תשלומים - {selectedMonth} {selectedYear}
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
                </div>
                <div className="flex items-center gap-4 justify-center flex-1">
                  <Label htmlFor={`payment-${item.type}`} className="text-sm whitespace-nowrap">
                    שולם:
                  </Label>
                  <Input
                    id={`payment-${item.type}`}
                    type="number"
                    value={editValues[`${item.type}Paid`] ?? ""}
                    onChange={e =>
                      setEditValues(prev => ({
                        ...prev,
                        [`${item.type}Paid`]: Number(e.target.value) || 0,
                      }))
                    }
                    min="0"
                    max={item.amount}
                    className="w-32 text-sm ltr no-arrows text-center"
                  />
                  <Button
                    onClick={async () => {
                      setSaving(prev => ({ ...prev, [item.type]: true }));
                      if (currentPayment) {
                        await updatePaymentStatus(
                          currentPayment.id,
                          item.type,
                          editValues[`${item.type}Paid`] ?? 0
                        );
                      } else {
                        await supabase.from('payments').insert([{
                          tenantId: tenant.id,
                          hebrewMonth: selectedMonth,
                          hebrewYear: selectedYear,
                          [`${item.type}Paid`]: editValues[`${item.type}Paid`] ?? 0,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        }]);
                      }
                      setSaving(prev => ({ ...prev, [item.type]: false }));
                    }}
                    disabled={!!saving[item.type]}
                    className="ml-2"
                  >
                    שמור
                  </Button>
                </div>
                <div className="text-right flex-1 flex justify-end">
                  <Badge variant={remaining === 0 ? "default" : "secondary"}>
                    {remaining === 0 ? "הושלם" : `נשאר ₪${remaining.toLocaleString()}`}
                  </Badge>
                </div>
              </div>
            );
          })}

          {previousMonthDebt > 0 && (
            <div className="flex items-center justify-between p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
              <div className="flex items-center gap-4 flex-1">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-orange-800">חוב מחודש {previousMonth}</p>
                  <p className="text-sm text-orange-600">
                    סכום: ₪{previousMonthDebt.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right flex-1 flex justify-end">
                <Badge variant="destructive">
                  לטיפול
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Row Component - For Editing Payments */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">עריכת תשלומים</h3>
        {payments.map((payment) => (
          <PaymentRow key={payment.id} payment={payment} totalSum={totalAmount} />
        ))}
      </div>
    </div>
  );
};

export const PaymentRow: React.FC<PaymentRowProps> = ({ payment, totalSum }) => {
  const [editValues, setEditValues] = useState({
    rentPaid: payment.rentPaid,
    electricityPaid: payment.electricityPaid,
    waterPaid: payment.waterPaid,
    committeePaid: payment.committeePaid,
    gasPaid: payment.gasPaid,
  });
  const [saving, setSaving] = useState(false);

  const paidSum =
    editValues.rentPaid +
    editValues.electricityPaid +
    editValues.waterPaid +
    editValues.committeePaid +
    editValues.gasPaid;

  const handleChange = (type: keyof typeof editValues, value: number) => {
    setEditValues((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('payments')
      .update({
        ...editValues,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', payment.id);
    setSaving(false);
    // אפשר להוסיף הודעת הצלחה
  };

  return (
    <div className="border rounded-lg p-4 mb-2">
      <div className="flex flex-col gap-2">
        {Object.entries(paymentLabels).map(([type, label]) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-20">{label}:</span>
            <input
              type="number"
              min={0}
              value={editValues[`${type}Paid` as keyof typeof editValues]}
              onChange={e =>
                handleChange(`${type}Paid` as keyof typeof editValues, Number(e.target.value) || 0)
              }
              className="border rounded px-2 py-1 w-24 text-center"
            />
          </div>
        ))}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            <b>סטטוס:</b>{' '}
            {totalSum > 0
              ? paidSum >= totalSum
                ? 'שולם במלואו'
                : `שולם חלקית (נשאר ₪${totalSum - paidSum})`
              : ''}
          </span>
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
};

type PaymentRowProps = {
  payment: MonthlyPayment;
  totalSum: number; // סכום יעד לחודש הזה
};
