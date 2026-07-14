import { supabase } from '@/lib/supabase';
import type { Tenant, TenantInsert } from '@/types';

export async function listTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTenant(input: Omit<TenantInsert, 'owner_id' | 'id'>): Promise<Tenant> {
  // owner_id is omitted on purpose — the database fills it from the JWT.
  const { data, error } = await supabase.from('tenants').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTenant(id: string, patch: Partial<TenantInsert>): Promise<Tenant> {
  const { data, error } = await supabase
    .from('tenants').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveTenant(id: string): Promise<void> {
  const { error } = await supabase
    .from('tenants')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
