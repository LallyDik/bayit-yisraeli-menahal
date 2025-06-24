
import { useState, useEffect } from 'react';
import { Tenant } from '@/types';

export const useTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    // Load tenants from localStorage
    const savedTenants = localStorage.getItem('tenants');
    if (savedTenants) {
      setTenants(JSON.parse(savedTenants));
    }
  }, []);

  const saveTenants = (newTenants: Tenant[]) => {
    setTenants(newTenants);
    localStorage.setItem('tenants', JSON.stringify(newTenants));
  };

  const addTenant = (tenant: Omit<Tenant, 'id' | 'createdAt'>) => {
    const newTenant: Tenant = {
      ...tenant,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    saveTenants([...tenants, newTenant]);
  };

  const updateTenant = (id: string, updates: Partial<Tenant>) => {
    const updatedTenants = tenants.map(tenant =>
      tenant.id === id ? { ...tenant, ...updates } : tenant
    );
    saveTenants(updatedTenants);
  };

  const deleteTenant = (id: string) => {
    const filteredTenants = tenants.filter(tenant => tenant.id !== id);
    saveTenants(filteredTenants);
  };

  return {
    tenants,
    addTenant,
    updateTenant,
    deleteTenant,
  };
};
