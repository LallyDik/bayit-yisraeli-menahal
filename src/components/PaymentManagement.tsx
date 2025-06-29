import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, DollarSign, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { Tenant, MonthlyPayment, PaymentType } from '@/types';
import { getCurrentHebrewDate, HEBREW_MONTHS } from '@/utils/hebrewDates';
import { usePayments } from '@/hooks/usePayments';
import { useToast } from '@/hooks/use-toast';

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
  const { payments, updatePaymentStatus, createPayment, getPaymentByTenantAndMonth, refreshPayments } = usePayments();
  const { toast } = useToast();
  const currentDate = getCurrentHebrewDate();
  const [selectedMonth] = useState(currentDate.month);
  const [selectedYear] = useState(currentDate.year);
  const [editingMeters, setEditingMeters] = useState(false);
  const [meterValues, setMeterValues] = useState({
    waterMeter: tenant.waterMeter || 0,
    electricityMeter: tenant.electricityMeter || 0,
    gasMeter: tenant.gasMeter || 0
  });

  // Get current payment data - force refresh when payments change
  const currentPayment = getPaymentByTenantAndMonth(tenant.id, selectedMonth, selectedYear);
  
  console.log('Current payment for tenant:', { 
    tenantId: tenant.id, 
    month: selectedMonth, 
    year: selectedYear, 
    currentPayment,
    allPayments: payments 
  });
  
  // Initialize payment input values - always start with 0 for new entries
  const [editValues, setEditValues] = useState({
    rentPaid: 0,
    electricityPaid: 0,
    waterPaid: 0,
    committeePaid: 0,
    gasPaid: 0,
  });

  // Force refresh of payments data when component mounts or tenant changes
  useEffect(() => {
    console.log('PaymentManagement mounted or tenant changed, refreshing payments...');
    refreshPayments();
  }, [tenant.id, refreshPayments]);

  // Separate saving state for each payment type
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

  const handleMeterUpdate = async () => {
    if (onTenantUpdate) {
      onTenantUpdate(tenant.id, meterValues);
      setEditingMeters(false);
      toast({
        title: "נשמר בהצלחה",
        description: "קריאות המונים עודכנו",
      });
    }
  };

  const handlePaymentSave = async (paymentType: PaymentType) => {
    setSaving(prev => ({ ...prev, [paymentType]: true }));
    
    try {
      const amount = editValues[`${paymentType}Paid`] ?? 0;
      
      console.log('Saving payment:', { paymentType, amount, currentPayment });
      
      if (currentPayment) {
        // Update existing payment
        const { error } = await updatePaymentStatus(currentPayment.id, paymentType, amount);
        if (error) {
          console.error('Update payment error:', error);
          toast({
            title: "שגיאה",
            description: "לא ניתן לעדכן את התשלום",
            variant: "destructive",
          });
        } else {
          toast({
            title: "נשמר בהצלחה",
            description: `התשלום עבור ${paymentLabels[paymentType]} עודכן`,
          });
          // Clear the input field after successful save
          setEditValues(prev => ({
            ...prev,
            [`${paymentType}Paid`]: 0
          }));
        }
      } else {
        // Create new payment
        const { error } = await createPayment({
          tenantId: tenant.id,
          hebrewMonth: selectedMonth,
          hebrewYear: selectedYear,
          [`${paymentType}Paid`]: amount,
        });
        if (error) {
          console.error('Create payment error:', error);
          toast({
            title: "שגיאה",
            description: "לא ניתן ליצור תשלום חדש",
            variant: "destructive",
          });
        } else {
          toast({
            title: "נשמר בהצלחה",
            description: `תשלום חדש עבור ${paymentLabels[paymentType]} נוצר`,
          });
          // Clear the input field after successful save
          setEditValues(prev => ({
            ...prev,
            [`${paymentType}Paid`]: 0
          }));
        }
      }
      
      // Force refresh of payments data to ensure UI updates
      await refreshPayments();
      
    } catch (error) {
      console.error('Payment save error:', error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בשמירת התשלום",
        variant: "destructive",
      });
    }
    
    setSaving(prev => ({ ...prev, [paymentType]: false }));
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onBack} variant="outline" size="sm" className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          חזור
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">ניהול תשלומים</h2>
          <p className="text-gray-600">{tenant.name}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">תקופה נוכחית</p>
                <p className="text-lg font-bold text-gray-900">{selectedMonth} {selectedYear}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">שולם החודש</p>
                <p className="text-lg font-bold text-green-600">₪{paidAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {previousMonthDebt > 0 && (
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">חוב מ{previousMonth}</p>
                  <p className="text-lg font-bold text-orange-600">₪{previousMonthDebt.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">סה"כ נשאר</p>
                <p className="text-lg font-bold text-red-600">₪{remainingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg">קריאות מונים נוכחיות</span>
            <Button
              onClick={() => setEditingMeters(!editingMeters)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {editingMeters ? 'ביטול' : 'עריכה'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingMeters ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="water-meter" className="text-sm font-medium">מונה מים</Label>
                  <Input
                    id="water-meter"
                    type="number"
                    value={meterValues.waterMeter || ''}
                    onChange={(e) => setMeterValues(prev => ({
                      ...prev,
                      waterMeter: Number(e.target.value) || 0
                    }))}
                    className="text-center"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="electricity-meter" className="text-sm font-medium">מונה חשמל</Label>
                  <Input
                    id="electricity-meter"
                    type="number"
                    value={meterValues.electricityMeter || ''}
                    onChange={(e) => setMeterValues(prev => ({
                      ...prev,
                      electricityMeter: Number(e.target.value) || 0
                    }))}
                    className="text-center"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gas-meter" className="text-sm font-medium">מונה גז</Label>
                  <Input
                    id="gas-meter"
                    type="number"
                    value={meterValues.gasMeter || ''}
                    onChange={(e) => setMeterValues(prev => ({
                      ...prev,
                      gasMeter: Number(e.target.value) || 0
                    }))}
                    className="text-center"
                    placeholder="0"
                  />
                </div>
              </div>
              <Button onClick={handleMeterUpdate} className="w-full bg-blue-600 hover:bg-blue-700">
                עדכן קריאות מונים
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">מים</p>
                <p className="text-2xl font-bold text-blue-600">{tenant.waterMeter || 0}</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">חשמל</p>
                <p className="text-2xl font-bold text-yellow-600">{tenant.electricityMeter || 0}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">גז</p>
                <p className="text-2xl font-bold text-green-600">{tenant.gasMeter || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg">פירוט תשלומים - {selectedMonth} {selectedYear}</span>
            <Badge variant={remainingAmount === 0 ? "default" : "destructive"} className="text-sm">
              {remainingAmount === 0 ? "הכל שולם" : `נשאר ₪${remainingAmount.toLocaleString()}`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentItems.map((item) => {
            const remaining = item.amount - item.paid;
            const isFullyPaid = remaining === 0;
            
            return (
              <div key={item.type} className={`p-4 border rounded-lg ${isFullyPaid ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Payment Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{item.label}</h3>
                      {isFullyPaid && <CheckCircle className="w-4 h-4 text-green-600" />}
                    </div>
                    <p className="text-sm text-gray-600">
                      סה"כ: ₪{item.amount.toLocaleString()} | שולם: ₪{item.paid.toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Payment Input */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`payment-${item.type}`} className="text-sm font-medium whitespace-nowrap">
                      תשלום:
                    </Label>
                    <Input
                      id={`payment-${item.type}`}
                      type="number"
                      value={editValues[`${item.type}Paid`] || ""}
                      onChange={e =>
                        setEditValues(prev => ({
                          ...prev,
                          [`${item.type}Paid`]: Number(e.target.value) || 0,
                        }))
                      }
                      min="0"
                      max={item.amount}
                      className="w-24 text-center"
                      placeholder="0"
                    />
                    <Button
                      onClick={() => handlePaymentSave(item.type)}
                      disabled={!!saving[item.type]}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                    >
                      {saving[item.type] ? 'שומר...' : 'שמור'}
                    </Button>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex justify-end">
                    <Badge variant={isFullyPaid ? "default" : "secondary"} className="text-xs">
                      {isFullyPaid ? "הושלם" : `נשאר ₪${remaining.toLocaleString()}`}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Previous Month Debt */}
          {previousMonthDebt > 0 && (
            <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-orange-800">חוב מחודש {previousMonth}</h3>
                    <p className="text-sm text-orange-600">
                      סכום: ₪{previousMonthDebt.toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">
                  לטיפול
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
