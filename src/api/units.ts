import { supabase } from '@/lib/supabase';
import type { Unit, UnitInsert } from '@/types';

export async function listUnits(): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createUnit(input: Omit<UnitInsert, 'owner_id' | 'id'>): Promise<Unit> {
  // owner_id is omitted on purpose - the database fills it from the JWT.
  const { data, error } = await supabase.from('units').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateUnit(id: string, patch: Partial<UnitInsert>): Promise<Unit> {
  const { data, error } = await supabase
    .from('units').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveUnit(id: string): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
