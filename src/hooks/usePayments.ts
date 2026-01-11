import { useState, useEffect } from 'react';
import { MonthlyPayment, PaymentType } from '@/types';
import { paymentsApi } from '@/services/googleSheetsApi';
import { useAuth } from '@/hooks/useAuth';

function normalizePayment(payment: any): MonthlyPayment {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    hebrewMonth: payment.hebrewMonth,
    hebrewYear: payment.hebrewYear,
    rentPaid: Number(payment.rentPaid) || 0,
    electricityPaid: Number(payment.electricityPaid) || 0,
    waterPaid: Number(payment.waterPaid) || 0,
    committeePaid: Number(payment.committeePaid) || 0,
    gasPaid: Number(payment.gasPaid) || 0,
    createdAt: payment.createdAt ? new Date(payment.createdAt) : new Date(),
    updatedAt: payment.updatedAt ? new Date(payment.updatedAt) : new Date(),
  };
}

export const usePayments = () => {
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchPayments = async () => {
    if (!user) return [];
    
    setLoading(true);
    try {
      const result = await paymentsApi.getAll(user.id);
      if (result.payments) {
        const mappedPayments = (result.payments as any[]).map(normalizePayment);
        setPayments(mappedPayments);
        return mappedPayments;
      }
      return [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const updatePaymentStatus = async (
    paymentId: string,
    paymentType: PaymentType,
    amount: number
  ) => {
    try {
      console.log('Updating payment:', { paymentId, paymentType, amount });
      
      const updateData: any = { id: paymentId };
      updateData[`${paymentType}Paid`] = amount;
      
      const result = await paymentsApi.update(updateData);
      
      if (result.error) {
        console.error('Error updating payment:', result.error);
        return { error: result.error };
      }
      
      // Refresh payments data
      await fetchPayments();
      
      // Also update local state immediately for better UX
      setPayments(prevPayments => 
        prevPayments.map(payment => 
          payment.id === paymentId 
            ? { ...payment, [`${paymentType}Paid`]: amount, updatedAt: new Date() }
            : payment
        )
      );
      
      return { error: null };
    } catch (error) {
      console.error('Error in updatePaymentStatus:', error);
      return { error };
    }
  };

  const createPayment = async (paymentData: Partial<MonthlyPayment>) => {
    if (!user) {
      return { error: 'לא ניתן לאחזר משתמש מחובר' };
    }
    
    try {
      console.log('Creating payment:', paymentData);
      
      const result = await paymentsApi.create({
        tenantId: paymentData.tenantId,
        userId: user.id,
        hebrewMonth: paymentData.hebrewMonth,
        hebrewYear: paymentData.hebrewYear,
        rentPaid: paymentData.rentPaid || 0,
        electricityPaid: paymentData.electricityPaid || 0,
        waterPaid: paymentData.waterPaid || 0,
        committeePaid: paymentData.committeePaid || 0,
        gasPaid: paymentData.gasPaid || 0,
      });

      if (result.error) {
        console.error('Error creating payment:', result.error);
        return { error: result.error };
      }

      // Refresh payments data
      await fetchPayments();
      
      return { error: null };
    } catch (error) {
      console.error('Error in createPayment:', error);
      return { error };
    }
  };

  const getPaymentsByTenant = (tenantId: string) => {
    return payments.filter(payment => payment.tenantId === tenantId);
  };

  const getPaymentByTenantAndMonth = (
    tenantId: string,
    month: string,
    year: string
  ) => {
    const payment = payments.find(
      payment =>
        payment.tenantId === tenantId &&
        payment.hebrewMonth === month &&
        payment.hebrewYear === year
    );
    console.log('Found payment for tenant/month:', { tenantId, month, year, payment });
    return payment;
  };

  return {
    payments,
    loading,
    updatePaymentStatus,
    createPayment,
    getPaymentsByTenant,
    getPaymentByTenantAndMonth,
    refreshPayments: fetchPayments,
  };
};
