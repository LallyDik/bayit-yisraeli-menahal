import { useState, useEffect } from 'react';
import { Tenant } from '@/types';
import { supabase } from '@/supabaseClient';

function normalizeTenant(tenant: any): Tenant {
  return {
    ...tenant,
    monthlyRent: Number(tenant.monthlyrent),
    monthlyElectricity: Number(tenant.monthlyelectricity),
    monthlyWater: Number(tenant.monthlywater),
    monthlyCommittee: Number(tenant.monthlycommittee),
    monthlyGas: Number(tenant.monthlygas),
    waterMeter: Number(tenant.watermeter),
    electricityMeter: Number(tenant.electricitymeter),
    gasMeter: Number(tenant.gasmeter),
    createdAt: tenant.createdat ? new Date(tenant.createdat) : new Date(),
    id: tenant.id,
    name: tenant.name,
    userId: tenant.userid,
  };
}

export const useTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // טען שוכרים מ-Supabase
  const fetchTenants = async () => {
    const { data, error } = await supabase.from('tenants').select('*');
    if (!error && data) {
      setTenants(data.map(normalizeTenant));
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

  // עדכון מונים בלבד עבור שוכר
  const updateTenantMeters = async (
    id: string,
    meters: { waterMeter?: number; electricityMeter?: number; gasMeter?: number }
  ) => {
    const updates: any = {};
    if (meters.waterMeter !== undefined) updates.watermeter = meters.waterMeter;
    if (meters.electricityMeter !== undefined) updates.electricitymeter = meters.electricityMeter;
    if (meters.gasMeter !== undefined) updates.gasmeter = meters.gasMeter;

    const { error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Meter update error:', error);
    } else {
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
    updateTenantMeters, // הוסף את הפונקציה החדשה ל-export
    deleteTenant,
    fetchTenants,
  };
};


