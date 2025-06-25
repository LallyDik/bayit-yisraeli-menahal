import { useState, useEffect } from 'react';
import { Tenant } from '@/types';
import { supabase } from '@/supabaseClient';

export const useTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // טען שוכרים מ-Supabase
  const fetchTenants = async () => {
    const { data, error } = await supabase.from('tenants').select('*');
    if (!error && data) {
      setTenants(data as Tenant[]);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // הוספת שוכר חדש ל-Supabase
  const addTenant = async (tenant: Omit<Tenant, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('tenants').insert([{
      name: tenant.name,
      monthlyRent: Number(tenant.monthlyRent),
      monthlyElectricity: Number(tenant.monthlyElectricity),
      monthlyWater: Number(tenant.monthlyWater),
      monthlyCommittee: Number(tenant.monthlyCommittee),
      monthlyGas: Number(tenant.monthlyGas),
      waterMeter: Number(tenant.waterMeter),
      electricityMeter: Number(tenant.electricityMeter),
      gasMeter: Number(tenant.gasMeter),
      // אל תשלח createdAt אם אין עמודה כזו!
    }]);
    if (!error) {
      await fetchTenants();
    } else {
      console.error('Supabase insert error:', error);
    }
  };

  // עדכון שוכר קיים ב-Supabase
  const updateTenant = async (id: string, updates: Partial<Tenant>) => {
    const { error } = await supabase
      .from('tenants')
      .update({ ...updates })
      .eq('id', id);
    if (!error) {
      await fetchTenants();
    }
  };

  // מחיקת שוכר מ-Supabase
  const deleteTenant = async (id: string) => {
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);
    if (!error) {
      await fetchTenants();
    }
  };

  return {
    tenants,
    addTenant,
    updateTenant,
    deleteTenant,
    fetchTenants,
  };
};
