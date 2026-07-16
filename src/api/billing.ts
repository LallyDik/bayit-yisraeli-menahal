import { supabase } from '@/lib/supabase';
import type {
  BillingOccurrence, BillingSettings, Charge, ChargeInsert, PaymentTerm,
} from '@/types';
import type { Json } from '@/types/database';
import type { BillingCalendar, GeneratedBillingOccurrence } from '@/utils/billingSchedule';

export type BillablePaymentType = 'rent' | 'electricity' | 'water' | 'gas' | 'committee' | 'custom';
export type UtilityPaymentType = 'electricity' | 'water';
export type AdditionalPaymentType = 'gas' | 'committee' | 'custom';

export type ChargeWithPaid = Charge & { paid_amount: number };

type ChargeRow = Charge & {
  payment_allocations: Array<{ amount: number }> | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const monthParts = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
};

export function currentChargePeriod(paymentType: BillablePaymentType, date = new Date()) {
  const monthKey = monthParts(date);
  const names: Record<BillablePaymentType, string> = {
    rent: 'שכירות',
    electricity: 'חשמל',
    water: 'מים',
    gas: 'גז',
    committee: 'ועד בית',
    custom: 'תשלום נוסף',
  };
  return {
    periodKey: `${paymentType}:${monthKey}`,
    dueDate: `${monthKey}-01`,
    label: `${names[paymentType]} ${date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`,
  };
}

export function currentTermPeriod(termId: string, date = new Date()) {
  const monthKey = monthParts(date);
  return {
    periodKey: `term:${termId}:${monthKey}`,
    dueDate: `${monthKey}-01`,
  };
}

export function currentRentPeriod(date = new Date()) {
  return currentChargePeriod('rent', date);
}

export async function listCharges(): Promise<ChargeWithPaid[]> {
  const { data, error } = await supabase
    .from('charges')
    .select('*, payment_allocations(amount)')
    .order('due_date', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as ChargeRow[]).map(({ payment_allocations, ...charge }) => ({
    ...charge,
    paid_amount: (payment_allocations ?? []).reduce((sum, a) => sum + Number(a.amount), 0),
  }));
}

export async function ensureRentCharge(input: {
  tenancy_id: string;
  amount_due: number;
  due_date: string;
  label: string;
  period_key: string;
}): Promise<Charge> {
  const payload: Omit<ChargeInsert, 'owner_id' | 'id'> = {
    tenancy_id: input.tenancy_id,
    payment_type: 'rent',
    amount_due: input.amount_due,
    due_date: input.due_date,
    label: input.label,
    period_key: input.period_key,
  };

  const { data, error } = await supabase
    .from('charges')
    .upsert(payload, {
      onConflict: 'owner_id,tenancy_id,payment_type,period_key',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function ensureCharge(input: Omit<ChargeInsert, 'owner_id' | 'id'>): Promise<Charge> {
  const { data, error } = await supabase
    .from('charges')
    .upsert(input, {
      onConflict: 'owner_id,tenancy_id,payment_type,period_key',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listPaymentTerms(): Promise<PaymentTerm[]> {
  const { data, error } = await supabase
    .from('tenancy_payment_terms')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listBillingSettings(): Promise<BillingSettings[]> {
  const { data, error } = await supabase
    .from('tenancy_billing_settings')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listBillingOccurrences(): Promise<BillingOccurrence[]> {
  const { data, error } = await supabase
    .from('billing_schedule_occurrences')
    .select('*')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveTenancyBillingSchedule(input: {
  tenancyId: string;
  calendar: BillingCalendar;
  dueDay: number;
  startDate: string;
  occurrences: GeneratedBillingOccurrence[];
}): Promise<void> {
  const { error } = await supabase.rpc('save_tenancy_billing_schedule', {
    p_tenancy_id: input.tenancyId,
    p_calendar_type: input.calendar,
    p_due_day: input.dueDay,
    p_schedule_start_date: input.startDate,
    p_occurrences: input.occurrences as unknown as Json,
  });
  if (error) throw error;
}

export async function materializeDueCharges(): Promise<number> {
  const { data, error } = await supabase.rpc('materialize_due_charges');
  if (error) throw error;
  return data ?? 0;
}

export async function saveUtilityTerm(input: {
  tenancyId: string;
  paymentType: UtilityPaymentType;
  calculationType: 'fixed' | 'meter';
  fixedAmount?: number | null;
  unitRate?: number | null;
  frequencyMonths: 1 | 2;
  startsOnSequence: number;
}): Promise<PaymentTerm> {
  const label = input.paymentType === 'electricity' ? 'חשמל' : 'מים';
  const { data, error } = await supabase
    .from('tenancy_payment_terms')
    .upsert({
      tenancy_id: input.tenancyId,
      payment_type: input.paymentType,
      label,
      calculation_type: input.calculationType,
      frequency_months: input.frequencyMonths,
      fixed_amount: input.fixedAmount ?? null,
      unit_rate: input.unitRate ?? null,
      starts_on_sequence: input.startsOnSequence,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'owner_id,tenancy_id,payment_type,label',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAdditionalTerm(input: {
  tenancyId: string;
  paymentType: AdditionalPaymentType;
  label: string;
  calculationType: 'fixed' | 'meter';
  fixedAmount?: number | null;
  unitRate?: number | null;
  frequencyMonths: 1 | 2;
  startsOnSequence: number;
}): Promise<PaymentTerm> {
  const { data, error } = await supabase
    .from('tenancy_payment_terms')
    .insert({
      tenancy_id: input.tenancyId,
      payment_type: input.paymentType,
      label: input.label.trim(),
      calculation_type: input.calculationType,
      frequency_months: input.frequencyMonths,
      starts_on_sequence: input.startsOnSequence,
      fixed_amount: input.fixedAmount ?? null,
      unit_rate: input.unitRate ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePaymentTermSettings(input: {
  termId: string;
  paymentType: AdditionalPaymentType;
  label: string;
  calculationType: 'fixed' | 'meter';
  fixedAmount?: number | null;
  unitRate?: number | null;
  frequencyMonths: 1 | 2;
  startsOnSequence: number;
}): Promise<PaymentTerm> {
  const { data, error } = await supabase
    .from('tenancy_payment_terms')
    .update({
      payment_type: input.paymentType,
      label: input.label.trim(),
      calculation_type: input.calculationType,
      fixed_amount: input.fixedAmount ?? null,
      unit_rate: input.unitRate ?? null,
      frequency_months: input.frequencyMonths,
      starts_on_sequence: input.startsOnSequence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.termId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMeterTermRate(termId: string, unitRate: number): Promise<PaymentTerm> {
  const { data, error } = await supabase
    .from('tenancy_payment_terms')
    .update({ unit_rate: unitRate, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAddedPaymentTerm(termId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_added_payment_term', { p_term_id: termId });
  if (error) throw error;
}

export async function updateFixedTermAmount(termId: string, fixedAmount: number): Promise<PaymentTerm> {
  const { data, error } = await supabase
    .from('tenancy_payment_terms')
    .update({ fixed_amount: fixedAmount, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setChargePaymentState(input: {
  charge_id: string;
  amount_due: number;
  paid_amount: number;
  paid_at?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('set_charge_payment_state', {
    p_charge_id: input.charge_id,
    p_amount_due: input.amount_due,
    p_paid_amount: input.paid_amount,
    p_paid_at: input.paid_at ?? todayISO(),
  });

  if (error) throw error;
}
