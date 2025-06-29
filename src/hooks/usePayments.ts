
import { useState, useEffect } from 'react';
import { MonthlyPayment, PaymentType } from '@/types';
import { supabase } from '@/supabaseClient';

export const usePayments = () => {
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select('*');
    if (!error && data) {
      setPayments(data as MonthlyPayment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const updatePaymentStatus = async (
    paymentId: string,
    paymentType: PaymentType,
    amount: number
  ) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('payments')
      .update({ [`${paymentType}Paid`]: amount, updatedAt })
      .eq('id', paymentId);
    
    if (!error) {
      // Refresh payments immediately after update
      await fetchPayments();
    }
    return { error };
  };

  const createPayment = async (paymentData: Partial<MonthlyPayment>) => {
    const { error } = await supabase
      .from('payments')
      .insert([{
        ...paymentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]);
    
    if (!error) {
      // Refresh payments immediately after creation
      await fetchPayments();
    }
    return { error };
  };

  const getPaymentsByTenant = (tenantId: string) => {
    return payments.filter(payment => payment.tenantId === tenantId);
  };

  const getPaymentByTenantAndMonth = (
    tenantId: string,
    month: string,
    year: string
  ) => {
    return payments.find(
      payment =>
        payment.tenantId === tenantId &&
        payment.hebrewMonth === month &&
        payment.hebrewYear === year
    );
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
