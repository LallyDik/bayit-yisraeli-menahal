import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  currentRentPeriod,
  currentChargePeriod,
  currentTermPeriod,
  createAdditionalTerm,
  deleteAddedPaymentTerm,
  ensureCharge,
  ensureRentCharge,
  listBillingOccurrences,
  listBillingSettings,
  listCharges,
  listPaymentTerms,
  materializeDueCharges,
  saveTenancyBillingSchedule,
  saveUtilityTerm,
  setChargePaymentState,
  updatePaymentTermSettings,
  updateFixedTermAmount,
  updateMeterTermRate,
  type AdditionalPaymentType,
  type ChargeWithPaid,
  type UtilityPaymentType,
} from '@/api/billing';
import { addMeterReading } from '@/api/meterReadings';
import { useAuth } from '@/hooks/useAuth';
import type { TenancyWithNames } from '@/api/tenancies';
import type { PaymentTerm } from '@/types';
import { generateBillingSchedule, type BillingCalendar } from '@/utils/billingSchedule';
import { localDateISO } from '@/utils/date';

function humanize(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('duplicate key')) return 'החיוב הזה כבר סומן או נוצר. הנתונים מתעדכנים.';
  return msg || 'הפעולה נכשלה';
}

export const useBilling = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const KEY = ['billing', user?.id];
  const pendingIdsRef = useRef(new Set<string>());
  const defaultScheduleIdsRef = useRef(new Set<string>());
  const [pendingTenancyIds, setPendingTenancyIds] = useState<Set<string>>(new Set());

  const {
    data: charges = [], isLoading, error: chargesError, refetch: refetchCharges,
  } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      await materializeDueCharges();
      return listCharges();
    },
    enabled: !!user,
  });

  const {
    data: paymentTerms = [], isLoading: areTermsLoading, error: termsError, refetch: refetchTerms,
  } = useQuery({
    queryKey: ['payment-terms', user?.id],
    queryFn: listPaymentTerms,
    enabled: !!user,
  });

  const {
    data: billingSettings = [], isLoading: areSettingsLoading, isSuccess: areSettingsReady, error: settingsError, refetch: refetchSettings,
  } = useQuery({
    queryKey: ['billing-settings', user?.id],
    queryFn: listBillingSettings,
    enabled: !!user,
  });

  const {
    data: billingOccurrences = [], isLoading: areOccurrencesLoading, error: occurrencesError, refetch: refetchOccurrences,
  } = useQuery({
    queryKey: ['billing-occurrences', user?.id],
    queryFn: listBillingOccurrences,
    enabled: !!user,
  });

  const billingSettingsByTenancyId = useMemo(() => new Map(
    billingSettings.map((setting) => [setting.tenancy_id, setting]),
  ), [billingSettings]);

  const occurrencesByTenancyId = useMemo(() => {
    const map = new Map<string, typeof billingOccurrences>();
    billingOccurrences.forEach((occurrence) => {
      const current = map.get(occurrence.tenancy_id) ?? [];
      current.push(occurrence);
      map.set(occurrence.tenancy_id, current);
    });
    return map;
  }, [billingOccurrences]);

  const currentOccurrenceByTenancyId = useMemo(() => {
    const today = localDateISO();
    const map = new Map<string, (typeof billingOccurrences)[number]>();
    occurrencesByTenancyId.forEach((occurrences, tenancyId) => {
      const pastOrToday = occurrences.filter((item) => item.due_date <= today);
      map.set(tenancyId, pastOrToday[pastOrToday.length - 1] ?? occurrences[0]);
    });
    return map;
  }, [occurrencesByTenancyId]);

  const currentRentByTenancyId = useMemo(() => {
    // Rent must be matched to the *current* billing period, the way term
    // charges already are. Simply taking the newest rent charge meant that at
    // the start of a new month last month's payment kept showing as if it
    // belonged to the new one - the card read "מועד נוכחי: <this month>" while
    // displaying the previous month's paid/owed amounts.
    const map = new Map<string, ChargeWithPaid>();
    const rentCharges = charges.filter((charge) => charge.payment_type === 'rent');
    const legacyKey = currentRentPeriod().periodKey; // pre-schedule `rent:YYYY-MM`
    new Set(rentCharges.map((charge) => charge.tenancy_id)).forEach((tenancyId) => {
      const occurrence = currentOccurrenceByTenancyId.get(tenancyId);
      const periodKeys = new Set([legacyKey]);
      if (occurrence) periodKeys.add(`rent:${occurrence.period_key}`);
      const match = rentCharges.find((charge) => (
        charge.tenancy_id === tenancyId && periodKeys.has(charge.period_key)
      ));
      if (match) map.set(tenancyId, match);
    });
    return map;
  }, [charges, currentOccurrenceByTenancyId]);

  const scheduledPeriod = useCallback((tenancyId: string, frequencyMonths: 1 | 2 = 1, startsOnSequence = 1) => {
    const today = localDateISO();
    const occurrence = frequencyMonths === 1 && startsOnSequence === 1
      ? currentOccurrenceByTenancyId.get(tenancyId)
      : (() => {
        const eligible = (occurrencesByTenancyId.get(tenancyId) ?? [])
          .filter((item) => (
            item.sequence_no >= startsOnSequence
            && (item.sequence_no - startsOnSequence) % frequencyMonths === 0
          ));
        const due = eligible.filter((item) => item.due_date <= today);
        return due[due.length - 1] ?? eligible[0];
      })();
    if (!occurrence) return null;
    return {
      dueDate: occurrence.due_date,
      occurrenceKey: occurrence.period_key,
      label: occurrence.calendar_label,
    };
  }, [currentOccurrenceByTenancyId, occurrencesByTenancyId]);

  const runForTenancy = useCallback(async (
    tenancyId: string,
    operation: () => Promise<void>,
    successMessage: string,
  ) => {
    if (pendingIdsRef.current.has(tenancyId)) return;

    pendingIdsRef.current.add(tenancyId);
    setPendingTenancyIds(new Set(pendingIdsRef.current));

    try {
      await operation();
      await qc.invalidateQueries({ queryKey: ['billing', user?.id] });
      await qc.invalidateQueries({ queryKey: ['payment-terms', user?.id] });
      await qc.invalidateQueries({ queryKey: ['billing-settings', user?.id] });
      await qc.invalidateQueries({ queryKey: ['billing-occurrences', user?.id] });
      toast.success(successMessage);
    } catch (e) {
      toast.error(humanize(e));
      throw e;
    } finally {
      pendingIdsRef.current.delete(tenancyId);
      setPendingTenancyIds(new Set(pendingIdsRef.current));
    }
  }, [qc, user?.id]);

  const saveBillingSettings = useCallback(async (input: {
    tenancy: TenancyWithNames;
    calendar: BillingCalendar;
    dueDay: number;
    startDate: string;
  }) => {
    await runForTenancy(`schedule:${input.tenancy.id}`, async () => {
      const occurrences = generateBillingSchedule({
        calendar: input.calendar,
        dueDay: input.dueDay,
        startDate: input.startDate,
        count: 48,
      });
      await saveTenancyBillingSchedule({
        tenancyId: input.tenancy.id,
        calendar: input.calendar,
        dueDay: input.dueDay,
        startDate: input.startDate,
        occurrences,
      });
      await materializeDueCharges();
    }, 'מועד התשלום נשמר');
  }, [runForTenancy]);

  const ensureDefaultSchedules = useCallback(async (tenancies: TenancyWithNames[]) => {
    if (!user) return;
    const today = localDateISO();
    const missing = tenancies.filter((tenancy) => (
      !billingSettingsByTenancyId.has(tenancy.id)
      && !defaultScheduleIdsRef.current.has(tenancy.id)
    ));
    if (missing.length === 0) return;

    missing.forEach((tenancy) => defaultScheduleIdsRef.current.add(tenancy.id));
    try {
      await Promise.all(missing.map((tenancy) => {
        const startDate = tenancy.start_date > today ? tenancy.start_date : today;
        const occurrences = generateBillingSchedule({
          calendar: 'gregorian',
          dueDay: 1,
          startDate,
          count: 48,
        });
        return saveTenancyBillingSchedule({
          tenancyId: tenancy.id,
          calendar: 'gregorian',
          dueDay: 1,
          startDate,
          occurrences,
        });
      }));
      await materializeDueCharges();
      await qc.invalidateQueries({ queryKey: ['billing', user.id] });
      await qc.invalidateQueries({ queryKey: ['billing-settings', user.id] });
      await qc.invalidateQueries({ queryKey: ['billing-occurrences', user.id] });
    } catch (e) {
      missing.forEach((tenancy) => defaultScheduleIdsRef.current.delete(tenancy.id));
      toast.error(humanize(e));
    }
  }, [billingSettingsByTenancyId, qc, user]);

  const markCurrentRentPaid = useCallback(async (tenancy: TenancyWithNames) => {
    await runForTenancy(tenancy.id, async () => {
      const scheduled = scheduledPeriod(tenancy.id);
      const fallback = currentRentPeriod();
      const period = scheduled ? {
        dueDate: scheduled.dueDate,
        label: `שכר דירה - ${scheduled.label}`,
        periodKey: `rent:${scheduled.occurrenceKey}`,
      } : fallback;
      const existing = currentRentByTenancyId.get(tenancy.id);
      const amountDue = Number(existing?.amount_due ?? tenancy.monthly_rent ?? 0);
      const paidAmount = Number(existing?.paid_amount ?? 0);

      if (amountDue <= paidAmount) return;

      const charge = existing ?? await ensureRentCharge({
        tenancy_id: tenancy.id,
        amount_due: amountDue,
        due_date: period.dueDate,
        label: period.label,
        period_key: period.periodKey,
      });

      await setChargePaymentState({
        charge_id: charge.id,
        amount_due: amountDue,
        paid_amount: amountDue,
      });
    }, 'סומן כשולם');
  }, [currentRentByTenancyId, runForTenancy, scheduledPeriod]);

  const saveCurrentRentPayment = useCallback(async (input: {
    tenancy: TenancyWithNames;
    amountDue: number;
    paidAmount: number;
    paidAt: string;
  }) => {
    await runForTenancy(input.tenancy.id, async () => {
      const scheduled = scheduledPeriod(input.tenancy.id);
      const fallback = currentRentPeriod();
      const period = scheduled ? {
        dueDate: scheduled.dueDate,
        label: `שכר דירה - ${scheduled.label}`,
        periodKey: `rent:${scheduled.occurrenceKey}`,
      } : fallback;
      const existing = currentRentByTenancyId.get(input.tenancy.id);
      const charge = existing ?? await ensureRentCharge({
        tenancy_id: input.tenancy.id,
        amount_due: input.amountDue,
        due_date: period.dueDate,
        label: period.label,
        period_key: period.periodKey,
      });

      await setChargePaymentState({
        charge_id: charge.id,
        amount_due: input.amountDue,
        paid_amount: input.paidAmount,
        paid_at: input.paidAt,
      });
    }, 'התשלום עודכן');
  }, [currentRentByTenancyId, runForTenancy, scheduledPeriod]);

  const saveUtilityCharge = useCallback(async (input: {
    tenancy: TenancyWithNames;
    paymentType: UtilityPaymentType;
    calculationType: 'fixed' | 'meter';
    previousReading?: number;
    currentReading?: number;
    unitRate?: number;
    fixedAmount?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => {
    const operationKey = `${input.paymentType}:${input.tenancy.id}`;
    const title = input.paymentType === 'electricity' ? 'חשמל' : 'מים';

    await runForTenancy(operationKey, async () => {
      let amountDue: number;
      if (input.calculationType === 'meter') {
        const previous = Number(input.previousReading ?? 0);
        const current = Number(input.currentReading ?? 0);
        const rate = Number(input.unitRate ?? 0);
        if (previous <= 0 || current <= 0) throw new Error('יש להזין מונה אחרון ומונה נוכחי גדולים מ־0');
        if (current < previous) throw new Error('המונה הנוכחי לא יכול להיות נמוך מהמונה האחרון');
        if (rate < 0) throw new Error('המחיר ליחידה אינו תקין');
        if (rate <= 0) throw new Error('יש להזין מחיר תקין ליחידה');
        amountDue = Math.round((current - previous) * rate * 100) / 100;
      } else {
        amountDue = Number(input.fixedAmount ?? 0);
        if (amountDue < 0) throw new Error('המחיר הקבוע אינו תקין');
      }

      const term = await saveUtilityTerm({
        tenancyId: input.tenancy.id,
        paymentType: input.paymentType,
        calculationType: input.calculationType,
        fixedAmount: input.calculationType === 'fixed' ? amountDue : null,
        unitRate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
        frequencyMonths: input.frequencyMonths,
        startsOnSequence: input.startsOnSequence,
      });

      const scheduled = scheduledPeriod(input.tenancy.id, input.frequencyMonths, input.startsOnSequence);
      const fallback = currentChargePeriod(input.paymentType);
      const period = scheduled ? {
        dueDate: scheduled.dueDate,
        label: `${title} - ${scheduled.label}`,
        periodKey: `term:${term.id}:${scheduled.occurrenceKey}`,
      } : fallback;
      const existing = charges.find((charge) => (
        charge.tenancy_id === input.tenancy.id
        && charge.payment_type === input.paymentType
        && charge.period_key === period.periodKey
      ));
      const charge = await ensureCharge({
        tenancy_id: input.tenancy.id,
        payment_type: input.paymentType,
        label: period.label,
        period_key: period.periodKey,
        due_date: period.dueDate,
        amount_due: amountDue,
        meter_previous: input.calculationType === 'meter' ? Number(input.previousReading ?? 0) : null,
        meter_current: input.calculationType === 'meter' ? Number(input.currentReading ?? 0) : null,
        meter_rate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
      });

      if (input.calculationType === 'meter' && Number(input.currentReading ?? 0) > 0) {
        await addMeterReading({
          unit_id: input.tenancy.unit_id,
          meter_kind: input.paymentType,
          reading_date: localDateISO(),
          value: Number(input.currentReading),
        });
      }

      // Match the prior payment by charge id (stable), not only by period_key
      // (which can drift): recalculating a charge lower must cap an already
      // recorded payment down to the new amount.
      const priorPaid = Math.max(
        Number(existing?.paid_amount ?? 0),
        Number(charges.find((c) => c.id === charge.id)?.paid_amount ?? 0),
      );
      if (priorPaid > amountDue) {
        await setChargePaymentState({
          charge_id: charge.id,
          amount_due: amountDue,
          paid_amount: amountDue,
        });
      }
    }, `חיוב ${title} חושב ונשמר`);
  }, [charges, runForTenancy, scheduledPeriod]);

  const addAdditionalPayment = useCallback(async (input: {
    tenancy: TenancyWithNames;
    paymentType: AdditionalPaymentType;
    label: string;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    previousReading?: number;
    currentReading?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => {
    await runForTenancy(`additional:${input.tenancy.id}`, async () => {
      const normalizedLabel = input.label.trim().toLocaleLowerCase('he');
      const duplicateTerm = paymentTerms.find((term) => (
        term.tenancy_id === input.tenancy.id
        && term.payment_type === input.paymentType
        && term.label.trim().toLocaleLowerCase('he') === normalizedLabel
      ));
      if (duplicateTerm) throw new Error(`כבר קיימת הגדרת תשלום בשם „${input.label.trim()}”. אפשר לערוך אותה במקום להוסיף שוב`);
      if (input.calculationType === 'meter') {
        const previous = Number(input.previousReading ?? 0);
        const current = Number(input.currentReading ?? 0);
        if (previous <= 0 || current <= 0) throw new Error('יש להזין מונה אחרון ומונה נוכחי גדולים מ־0');
        if (current < previous) throw new Error('המונה הנוכחי לא יכול להיות נמוך מהמונה האחרון');
        if (Number(input.unitRate ?? 0) <= 0) throw new Error('יש להזין מחיר תקין ליחידה');
      }
      const amountDue = input.calculationType === 'meter'
        ? Math.round((Number(input.currentReading ?? 0) - Number(input.previousReading ?? 0)) * Number(input.unitRate ?? 0) * 100) / 100
        : Number(input.fixedAmount ?? 0);
      if (amountDue < 0) throw new Error('נתוני המונה אינם תקינים');

      const term = await createAdditionalTerm({
        tenancyId: input.tenancy.id,
        paymentType: input.paymentType,
        label: input.label,
        calculationType: input.calculationType,
        fixedAmount: input.calculationType === 'fixed' ? amountDue : null,
        unitRate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
        frequencyMonths: input.frequencyMonths,
        startsOnSequence: input.startsOnSequence,
      });
      const scheduled = scheduledPeriod(input.tenancy.id, input.frequencyMonths, input.startsOnSequence);
      const fallback = currentTermPeriod(term.id);
      const period = scheduled ? {
        dueDate: scheduled.dueDate,
        periodKey: `term:${term.id}:${scheduled.occurrenceKey}`,
      } : fallback;
      await ensureCharge({
        tenancy_id: input.tenancy.id,
        payment_type: input.paymentType,
        label: term.label,
        period_key: period.periodKey,
        due_date: period.dueDate,
        amount_due: amountDue,
        meter_previous: input.calculationType === 'meter' ? Number(input.previousReading ?? 0) : null,
        meter_current: input.calculationType === 'meter' ? Number(input.currentReading ?? 0) : null,
        meter_rate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
      });
    }, 'התשלום הנוסף נוסף');
  }, [paymentTerms, runForTenancy, scheduledPeriod]);

  const updateAdditionalPayment = useCallback(async (input: {
    term: PaymentTerm;
    paymentType: AdditionalPaymentType;
    label: string;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => {
    await runForTenancy(`edit-term:${input.term.id}`, async () => {
      const normalizedLabel = input.label.trim().toLocaleLowerCase('he');
      const duplicateTerm = paymentTerms.find((term) => (
        term.id !== input.term.id
        && term.tenancy_id === input.term.tenancy_id
        && term.payment_type === input.paymentType
        && term.label.trim().toLocaleLowerCase('he') === normalizedLabel
      ));
      if (duplicateTerm) throw new Error(`כבר קיימת הגדרת תשלום בשם „${input.label.trim()}”`);
      const updatedTerm = await updatePaymentTermSettings({
        termId: input.term.id,
        paymentType: input.paymentType,
        label: input.label,
        calculationType: input.calculationType,
        fixedAmount: input.calculationType === 'fixed' ? Number(input.fixedAmount ?? 0) : null,
        unitRate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
        frequencyMonths: input.frequencyMonths,
        startsOnSequence: input.startsOnSequence,
      });
      // Keep the already-created current charge in sync when its fixed amount changes.
      if (input.calculationType === 'fixed') {
        const existing = charges.find((charge) => charge.period_key?.startsWith(`term:${updatedTerm.id}:`));
        if (existing) {
          await setChargePaymentState({
            charge_id: existing.id,
            amount_due: Number(input.fixedAmount ?? 0),
            paid_amount: Math.min(Number(existing.paid_amount ?? 0), Number(input.fixedAmount ?? 0)),
          });
        }
      }
      await materializeDueCharges();
    }, 'הגדרת התשלום עודכנה');
  }, [charges, paymentTerms, runForTenancy]);

  const updateUtilityPaymentSettings = useCallback(async (input: {
    term: PaymentTerm;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => {
    await runForTenancy(`edit-term:${input.term.id}`, async () => {
      await saveUtilityTerm({
        tenancyId: input.term.tenancy_id,
        paymentType: input.term.payment_type as UtilityPaymentType,
        calculationType: input.calculationType,
        fixedAmount: input.calculationType === 'fixed' ? Number(input.fixedAmount ?? 0) : null,
        unitRate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
        frequencyMonths: input.frequencyMonths,
        startsOnSequence: input.startsOnSequence,
      });
      await materializeDueCharges();
    }, 'הגדרת התשלום עודכנה');
  }, [runForTenancy]);

  const saveUtilityPaymentSettings = useCallback(async (input: {
    tenancy: TenancyWithNames;
    paymentType: UtilityPaymentType;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => {
    await runForTenancy(`utility-settings:${input.paymentType}:${input.tenancy.id}`, async () => {
      await saveUtilityTerm({
        tenancyId: input.tenancy.id,
        paymentType: input.paymentType,
        calculationType: input.calculationType,
        fixedAmount: input.calculationType === 'fixed' ? Number(input.fixedAmount ?? 0) : null,
        unitRate: input.calculationType === 'meter' ? Number(input.unitRate ?? 0) : null,
        frequencyMonths: input.frequencyMonths,
        startsOnSequence: input.startsOnSequence,
      });
      await materializeDueCharges();
    }, 'הגדרת התשלום נשמרה');
  }, [runForTenancy]);

  const saveMeterTermCharge = useCallback(async (input: {
    term: PaymentTerm;
    previousReading: number;
    currentReading: number;
    unitRate: number;
  }) => {
    await runForTenancy(`term:${input.term.id}`, async () => {
      if (input.previousReading <= 0 || input.currentReading <= 0) throw new Error('יש להזין מונה אחרון ומונה נוכחי גדולים מ־0');
      if (input.unitRate <= 0) throw new Error('יש להזין מחיר תקין ליחידה');
      if (input.currentReading < input.previousReading) throw new Error('המונה הנוכחי לא יכול להיות נמוך מהמונה האחרון');
      const amountDue = Math.round((input.currentReading - input.previousReading) * input.unitRate * 100) / 100;
      const term = await updateMeterTermRate(input.term.id, input.unitRate);
      const scheduled = scheduledPeriod(term.tenancy_id, term.frequency_months === 2 ? 2 : 1, term.starts_on_sequence ?? 1);
      const fallback = currentTermPeriod(term.id);
      const period = scheduled ? {
        dueDate: scheduled.dueDate,
        periodKey: `term:${term.id}:${scheduled.occurrenceKey}`,
      } : fallback;
      const existing = charges.find((charge) => charge.period_key === period.periodKey);
      const charge = await ensureCharge({
        tenancy_id: term.tenancy_id,
        payment_type: term.payment_type,
        label: term.label,
        period_key: period.periodKey,
        due_date: period.dueDate,
        amount_due: amountDue,
        meter_previous: input.previousReading,
        meter_current: input.currentReading,
        meter_rate: input.unitRate,
      });

      // Match the prior payment by charge id (stable), not only by period_key
      // (which can drift): recalculating a charge lower must cap an already
      // recorded payment down to the new amount.
      const priorPaid = Math.max(
        Number(existing?.paid_amount ?? 0),
        Number(charges.find((c) => c.id === charge.id)?.paid_amount ?? 0),
      );
      if (priorPaid > amountDue) {
        await setChargePaymentState({
          charge_id: charge.id,
          amount_due: amountDue,
          paid_amount: amountDue,
        });
      }
    }, 'חיוב המונה חושב ונשמר');
  }, [charges, runForTenancy, scheduledPeriod]);

  const saveFixedTermCharge = useCallback(async (input: {
    term: PaymentTerm;
    fixedAmount: number;
  }) => {
    await runForTenancy(`term:${input.term.id}`, async () => {
      const term = await updateFixedTermAmount(input.term.id, input.fixedAmount);
      const scheduled = scheduledPeriod(term.tenancy_id, term.frequency_months === 2 ? 2 : 1, term.starts_on_sequence ?? 1);
      const fallback = currentTermPeriod(term.id);
      const period = scheduled ? {
        dueDate: scheduled.dueDate,
        periodKey: `term:${term.id}:${scheduled.occurrenceKey}`,
      } : fallback;
      const existing = charges.find((charge) => charge.period_key === period.periodKey);
      const charge = await ensureCharge({
        tenancy_id: term.tenancy_id,
        payment_type: term.payment_type,
        label: term.label,
        period_key: period.periodKey,
        due_date: period.dueDate,
        amount_due: input.fixedAmount,
      });

      const priorPaid = Math.max(
        Number(existing?.paid_amount ?? 0),
        Number(charges.find((c) => c.id === charge.id)?.paid_amount ?? 0),
      );
      if (priorPaid > input.fixedAmount) {
        await setChargePaymentState({
          charge_id: charge.id,
          amount_due: input.fixedAmount,
          paid_amount: input.fixedAmount,
        });
      }
    }, 'החיוב הקבוע עודכן');
  }, [charges, runForTenancy, scheduledPeriod]);

  const markChargePaid = useCallback(async (charge: ChargeWithPaid) => {
    await runForTenancy(`charge:${charge.id}`, async () => {
      await setChargePaymentState({
        charge_id: charge.id,
        amount_due: Number(charge.amount_due),
        paid_amount: Number(charge.amount_due),
      });
    }, `${charge.label} סומן כשולם`);
  }, [runForTenancy]);

  const saveChargePayment = useCallback(async (input: {
    charge: ChargeWithPaid;
    amountDue: number;
    paidAmount: number;
    paidAt: string;
  }) => {
    await runForTenancy(`charge:${input.charge.id}`, async () => {
      await setChargePaymentState({
        charge_id: input.charge.id,
        amount_due: input.amountDue,
        paid_amount: input.paidAmount,
        paid_at: input.paidAt,
      });
    }, 'התשלום עודכן');
  }, [runForTenancy]);

  const removePaymentTerm = useCallback(async (term: PaymentTerm) => {
    await runForTenancy(`delete-term:${term.id}`, async () => {
      await deleteAddedPaymentTerm(term.id);
    }, `${term.label} נמחק`);
  }, [runForTenancy]);

  return {
    charges,
    paymentTerms,
    billingSettings,
    billingOccurrences,
    billingSettingsByTenancyId,
    areSettingsReady,
    occurrencesByTenancyId,
    currentOccurrenceByTenancyId,
    currentRentByTenancyId,
    isLoading: isLoading || areTermsLoading || areSettingsLoading || areOccurrencesLoading,
    error: chargesError ?? termsError ?? settingsError ?? occurrencesError,
    refetch: () => Promise.all([
      refetchCharges(), refetchTerms(), refetchSettings(), refetchOccurrences(),
    ]),
    saveBillingSettings,
    ensureDefaultSchedules,
    markCurrentRentPaid,
    saveCurrentRentPayment,
    saveUtilityCharge,
    addAdditionalPayment,
    updateAdditionalPayment,
    updateUtilityPaymentSettings,
    saveUtilityPaymentSettings,
    saveFixedTermCharge,
    saveMeterTermCharge,
    markChargePaid,
    saveChargePayment,
    removePaymentTerm,
    pendingTenancyIds,
  };
};
