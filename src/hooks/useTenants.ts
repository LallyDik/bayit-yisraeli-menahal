import { useState, useEffect } from 'react';
import { Tenant } from '@/types';
import { tenantsApi } from '@/services/googleSheetsApi';
import { useAuth } from '@/hooks/useAuth';

function normalizeTenant(tenant: any): Tenant {
  return {
    id: tenant.id,
    name: tenant.name,
    monthlyRent: Number(tenant.monthlyRent) || 0,
    monthlyElectricity: Number(tenant.monthlyElectricity) || 0,
    monthlyWater: Number(tenant.monthlyWater) || 0,
    monthlyCommittee: Number(tenant.monthlyCommittee) || 0,
    monthlyGas: Number(tenant.monthlyGas) || 0,
    waterMeter: Number(tenant.waterMeter) || 0,
    electricityMeter: Number(tenant.electricityMeter) || 0,
    gasMeter: Number(tenant.gasMeter) || 0,
    createdAt: tenant.createdAt ? new Date(tenant.createdAt) : new Date(),
  };
}

export const useTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const { user } = useAuth();

  const fetchTenants = async () => {
    if (!user) return;
    
    try {
      const result = await tenantsApi.getAll(user.id);
      if (result.tenants) {
        setTenants((result.tenants as any[]).map(normalizeTenant));
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTenants();
    }
  }, [user]);

  const addTenant = async (tenant: Omit<Tenant, 'id' | 'createdAt'>) => {
    if (!user) {
      console.error('No logged-in user');
      return;
    }

    try {
      const result = await tenantsApi.add({
        userId: user.id,
        name: tenant.name,
        monthlyRent: Number(tenant.monthlyRent),
        monthlyElectricity: Number(tenant.monthlyElectricity),
        monthlyWater: Number(tenant.monthlyWater),
        monthlyCommittee: Number(tenant.monthlyCommittee),
        monthlyGas: Number(tenant.monthlyGas),
        waterMeter: Number(tenant.waterMeter),
        electricityMeter: Number(tenant.electricityMeter),
        gasMeter: Number(tenant.gasMeter),
      });
      
      if (result.success) {
        await fetchTenants();
      }
    } catch (error) {
      console.error('Error adding tenant:', error);
    }
  };

  const updateTenant = async (id: string, updates: Partial<Tenant>) => {
    try {
      const result = await tenantsApi.update({ id, ...updates });
      if (result.success) {
        await fetchTenants();
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
    }
  };

  const updateTenantMeters = async (
    id: string,
    meters: { waterMeter?: number; electricityMeter?: number; gasMeter?: number }
  ) => {
    try {
      const result = await tenantsApi.update({ id, ...meters });
      if (result.success) {
        await fetchTenants();
      }
    } catch (error) {
      console.error('Meter update error:', error);
    }
  };

  const deleteTenant = async (id: string) => {
    try {
      const result = await tenantsApi.delete(id);
      if (result.success) {
        await fetchTenants();
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
    }
  };

  return {
    tenants,
    addTenant,
    updateTenant,
    updateTenantMeters,
    deleteTenant,
    fetchTenants,
  };
};
