
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
      } else if (data) {
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
        setPayments(mappedPayments);
      }
    } catch (error) {
      console.error('Error in fetchPayments:', error);
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
    try {
      const updatedAt = new Date().toISOString();
      const dbFieldName = `${paymentType}paid`; // Convert to lowercase for database
      const { error } = await supabase
        .from('payments')
        .update({ [dbFieldName]: amount, updatedat: updatedAt })
        .eq('id', paymentId);
      
      if (error) {
        console.error('Error updating payment:', error);
        return { error };
      }
      
      // Refresh payments immediately after update
      await fetchPayments();
      return { error: null };
    } catch (error) {
      console.error('Error in updatePaymentStatus:', error);
      return { error };
    }
  };

  const createPayment = async (paymentData: Partial<MonthlyPayment>) => {
  try {
    const now = new Date().toISOString();

    // שליפת המשתמש הנוכחי
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
      userid: userData.user.id, // ✅ תוספת נדרשת
    };

    const { error } = await supabase
      .from('payments')
      .insert([dbPaymentData]);

    if (error) {
      console.error('Error creating payment:', error);
      return { error };
    }

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
