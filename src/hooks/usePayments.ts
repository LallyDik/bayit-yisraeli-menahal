
import { useState, useEffect } from 'react';
import { MonthlyPayment, PaymentType } from '@/types';

export const usePayments = () => {
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);

  useEffect(() => {
    // Load payments from localStorage
    const savedPayments = localStorage.getItem('payments');
    if (savedPayments) {
      setPayments(JSON.parse(savedPayments));
    }
  }, []);

  const savePayments = (newPayments: MonthlyPayment[]) => {
    setPayments(newPayments);
    localStorage.setItem('payments', JSON.stringify(newPayments));
  };

  const updatePaymentStatus = (
    paymentId: string, 
    paymentType: PaymentType, 
    amount: number
  ) => {
    const updatedPayments = payments.map(payment => {
      if (payment.id === paymentId) {
        return {
          ...payment,
          [`${paymentType}Paid`]: amount,
          updatedAt: new Date(),
        };
      }
      return payment;
    });
    savePayments(updatedPayments);
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
