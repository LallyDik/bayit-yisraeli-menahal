
import { useState, useEffect } from 'react';
import { MonthlyPayment, PaymentType } from '@/types';
import { supabase } from '@/supabaseClient';

export const usePayments = () => {
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id, tenantid, hebrewmonth, hebrewyear, rentpaid, electricitypaid, waterpaid, committeepaid, gaspaid, createdat, updatedat');
      
      if (error) {
        console.error('Error fetching payments:', error);
        return [];
      } 
      
      if (data) {
        // Map database column names to our TypeScript interface
        const mappedPayments = data.map(payment => ({
          id: payment.id,
          tenantId: payment.tenantid,
          hebrewMonth: payment.hebrewmonth,
          hebrewYear: payment.hebrewyear,
          rentPaid: payment.rentpaid || 0,
          electricityPaid: payment.electricitypaid || 0,
          waterPaid: payment.waterpaid || 0,
          committeePaid: payment.committeepaid || 0,
          gasPaid: payment.gaspaid || 0,
          createdAt: new Date(payment.createdat),
          updatedAt: new Date(payment.updatedat),
        }));
        
        console.log('Fetched payments:', mappedPayments);
        setPayments(mappedPayments);
        return mappedPayments;
      }
    } catch (error) {
      console.error('Error in fetchPayments:', error);
      return [];
    } finally {
      setLoading(false);
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
    try {
      console.log('Updating payment:', { paymentId, paymentType, amount });
      
      const updatedAt = new Date().toISOString();
      const dbFieldName = `${paymentType}paid`;
      
      const { error } = await supabase
        .from('payments')
        .update({ 
          [dbFieldName]: amount, 
          updatedat: updatedAt 
        })
        .eq('id', paymentId);
      
      if (error) {
        console.error('Error updating payment:', error);
        return { error };
      }
      
      console.log('Payment updated successfully, refreshing data...');
      
      // Force immediate refresh of payments data
      const refreshedPayments = await fetchPayments();
      
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
    try {
      console.log('Creating payment:', paymentData);
      
      const now = new Date().toISOString();

      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        throw new Error('לא ניתן לאחזר משתמש מחובר');
      }

      const dbPaymentData = {
        tenantid: paymentData.tenantId,
        hebrewmonth: paymentData.hebrewMonth,
        hebrewyear: paymentData.hebrewYear,
        rentpaid: paymentData.rentPaid || 0,
        electricitypaid: paymentData.electricityPaid || 0,
        waterpaid: paymentData.waterPaid || 0,
        committeepaid: paymentData.committeePaid || 0,
        gaspaid: paymentData.gasPaid || 0,
        createdat: now,
        updatedat: now,
        userid: userData.user.id,
      };

      const { error } = await supabase
        .from('payments')
        .insert([dbPaymentData]);

      if (error) {
        console.error('Error creating payment:', error);
        return { error };
      }

      console.log('Payment created successfully, refreshing data...');
      
      // Force immediate refresh of payments data
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
