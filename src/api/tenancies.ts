import { supabase } from '@/lib/supabase';
import type { Tenancy, TenancyInsert } from '@/types';

export type TenancyWithNames = Tenancy & { unit_name: string; tenant_name: string };

export async function listTenancies(): Promise<TenancyWithNames[]> {
  const { data, error } = await supabase
    .from('tenancies')
    .select('*, units(name), tenants(name)')
    .order('start_date', { ascending: false });
  if (error) throw error;

  return (data as unknown as Array<Tenancy & {
    units: { name: string } | null;
    tenants: { name: string } | null;
  }>).map(({ units, tenants, ...t }) => ({
    ...t,
    unit_name: units?.name ?? '',
    tenant_name: tenants?.name ?? '',
  }));
}

export async function createTenancy(
  input: Omit<TenancyInsert, 'owner_id' | 'id'>,
): Promise<Tenancy> {
  const { data, error } = await supabase.from('tenancies').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function endTenancy(id: string, endDate: string): Promise<void> {
  const { error } = await supabase
    .from('tenancies').update({ end_date: endDate }).eq('id', id);
  if (error) throw error;
}
