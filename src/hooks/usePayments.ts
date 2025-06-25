import { useState, useEffect } from 'react';
import { MonthlyPayment, PaymentType } from '@/types';
import { supabase } from '@/supabaseClient';

export const usePayments = () => {
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*');
    if (!error && data) {
      setPayments(data as MonthlyPayment[]);
    }
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
      await fetchPayments();
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
    return payments.find(
      payment =>
        payment.tenantId === tenantId &&
        payment.hebrewMonth === month &&
        payment.hebrewYear === year
    );
  };

  return {
    payments,
    updatePaymentStatus,
    getPaymentsByTenant,
    getPaymentByTenantAndMonth,
  };
};