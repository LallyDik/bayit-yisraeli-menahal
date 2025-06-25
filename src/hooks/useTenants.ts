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
  const addTenant = async (tenant: Omit<Tenant, 'id' | 'createdAt' | 'userId'>) => {
    // קבל את המשתמש המחובר
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No logged-in user');
      return;
    }

    const { error } = await supabase.from('tenants').insert([{
      name: tenant.name,
      monthlyrent: Number(tenant.monthlyRent),
      monthlyelectricity: Number(tenant.monthlyElectricity),
      monthlywater: Number(tenant.monthlyWater),
      monthlycommittee: Number(tenant.monthlyCommittee),
      monthlygas: Number(tenant.monthlyGas),
      watermeter: Number(tenant.waterMeter),
      electricitymeter: Number(tenant.electricityMeter),
      gasmeter: Number(tenant.gasMeter),
      userid: user.id, // חובה!
      // createdat: new Date().toISOString(), // לא חובה, יש default
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
