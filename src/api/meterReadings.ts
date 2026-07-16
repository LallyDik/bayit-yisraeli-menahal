import { supabase } from '@/lib/supabase';
import type { MeterReading, MeterReadingInsert } from '@/types';

export type MeterKind = 'electricity' | 'water';

export async function listMeterReadings(unitId: string, meterKind: MeterKind): Promise<MeterReading[]> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('unit_id', unitId)
    .eq('meter_kind', meterKind)
    .order('reading_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addMeterReading(input: Omit<MeterReadingInsert, 'owner_id' | 'id' | 'created_at'>): Promise<MeterReading> {
  const { data, error } = await supabase.from('meter_readings').upsert(input, { onConflict: 'unit_id,meter_kind,reading_date' }).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeterReading(id: string, patch: Partial<Pick<MeterReading, 'reading_date' | 'value' | 'note'>>): Promise<MeterReading> {
  const { data, error } = await supabase.from('meter_readings').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMeterReading(id: string): Promise<void> {
  const { error } = await supabase.from('meter_readings').delete().eq('id', id);
  if (error) throw error;
}

export async function latestMeterReadingBefore(unitId: string, meterKind: MeterKind, date: string): Promise<MeterReading | null> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('unit_id', unitId)
    .eq('meter_kind', meterKind)
    .lt('reading_date', date)
    .order('reading_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
