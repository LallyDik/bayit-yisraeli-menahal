import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AddAdditionalPaymentDialog } from '@/components/AddAdditionalPaymentDialog';
import { useMeterReadings } from '@/hooks/useMeterReadings';
import { BillingSettingsDialog } from '@/components/BillingSettingsDialog';
import { PaymentEditorDialog } from '@/components/PaymentEditorDialog';
import { PaymentHistoryDialog } from '@/components/PaymentHistoryDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calculator,
  CalendarClock,
  CheckCircle,
  Droplets,
  Flame,
  Gauge,
  History,
  PencilLine,
  Plus,
  ReceiptText,
  Settings,
  Trash2,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import {
  type AdditionalPaymentType,
  type ChargeWithPaid,
  type UtilityPaymentType,
} from '@/api/billing';
import type { TenancyWithNames } from '@/api/tenancies';
import type { BillingOccurrence, BillingSettings, PaymentTerm } from '@/types';
import type { BillingCalendar } from '@/utils/billingSchedule';
import { formatBillingDate, formatBillingShortDate } from '@/utils/billingSchedule';
import { localDateISO } from '@/utils/date';
import { markPaidLabel } from '@/utils/payment';

type PaymentState = 'paid' | 'partial' | 'unpaid';

const paymentState = (charge: ChargeWithPaid | undefined): PaymentState => {
  if (!charge || Number(charge.paid_amount) <= 0) return 'unpaid';
  if (Number(charge.paid_amount) >= Number(charge.amount_due)) return 'paid';
  return 'partial';
};

const STATUS_STYLES: Record<PaymentState, { label: string; pill: string; dot: string; bar: string }> = {
  paid: { label: 'שולם', pill: 'bg-primary/15 text-primary', dot: 'bg-primary', bar: 'bg-primary' },
  partial: { label: 'חלקי', pill: 'bg-secondary/60 text-secondary-foreground', dot: 'bg-secondary-foreground/70', bar: 'bg-secondary-foreground/80' },
  unpaid: { label: 'לא שולם', pill: 'bg-destructive/10 text-destructive', dot: 'bg-destructive', bar: 'bg-destructive/40' },
};

const PaymentBadge = ({ charge }: { charge?: ChargeWithPaid }) => {
  // No charge yet means "not billed", not "unpaid" - a screen of red debt
  // warnings on day one reads as alarm. Reserve the red for a real unpaid charge.
  if (!charge) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        טרם חויב
      </span>
    );
  }
  const style = STATUS_STYLES[paymentState(charge)];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
};

// A recorded payment can exceed a charge after the charge is recalculated lower
// (e.g. a lower meter rate applied after it was already marked paid). Never show
// "paid" as more than what is owed.
const shownPaid = (paid: number, due: number) => Math.min(Math.max(paid, 0), Math.max(due, 0));

// The page's signature element: a slim paid-vs-owed meter tying every card
// together around what this screen is actually about - money in vs money due.
const PaidMeter = ({ paid, due }: { paid: number; due: number }) => {
  const state: PaymentState = paid <= 0 ? 'unpaid' : paid >= due ? 'paid' : 'partial';
  const pct = due > 0 ? Math.min(Math.round((paid / due) * 100), 100) : 0;
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${STATUS_STYLES[state].bar} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
};

interface UtilityCardProps {
  tenancy: TenancyWithNames;
  type: UtilityPaymentType;
  term?: PaymentTerm;
  currentCharge?: ChargeWithPaid;
  lastReading: number;
  dueDateLabel: string;
  startOptions: Array<{ sequenceNo: number; label: string }>;
  pendingKeys: Set<string>;
  onCalculate: (input: {
    tenancy: TenancyWithNames;
    paymentType: UtilityPaymentType;
    calculationType: 'fixed' | 'meter';
    previousReading?: number;
    currentReading?: number;
    unitRate?: number;
    fixedAmount?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => Promise<void>;
  onMarkPaid: (charge: ChargeWithPaid) => Promise<void>;
  onEditCharge: (charge: ChargeWithPaid) => void;
  onEditSettings: () => void;
}

function UtilityCard({
  tenancy,
  type,
  term,
  currentCharge,
  lastReading,
  dueDateLabel,
  startOptions,
  pendingKeys,
  onCalculate,
  onMarkPaid,
  onEditCharge,
  onEditSettings,
}: UtilityCardProps) {
  const title = type === 'electricity' ? 'חשמל' : 'מים';
  const Icon = type === 'electricity' ? Zap : Droplets;
  const [calculationType, setCalculationType] = useState<'meter' | 'fixed'>('meter');
  const [previousReading, setPreviousReading] = useState('');
  const [currentReading, setCurrentReading] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [frequencyMonths, setFrequencyMonths] = useState<1 | 2>(2);
  const [startsOnSequence, setStartsOnSequence] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const { readings, updateReading, deleteReading } = useMeterReadings(tenancy.unit_id, type);
  const latestMeterReading = readings[0]?.value;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingCompute, setEditingCompute] = useState(false);
  const operationKey = `${type}:${tenancy.id}`;
  const isCalculating = pendingKeys.has(operationKey);
  const isMarking = currentCharge ? pendingKeys.has(`charge:${currentCharge.id}`) : false;

  useEffect(() => {
    const mode = term?.calculation_type === 'fixed' ? 'fixed' : 'meter';
    setCalculationType(mode);
    setUnitRate(String(Number(term?.unit_rate ?? currentCharge?.meter_rate ?? 0) || ''));
    setFixedAmount(String(Number(term?.fixed_amount ?? currentCharge?.amount_due ?? 0) || ''));
    setFrequencyMonths((term?.frequency_months === 1 ? 1 : 2));
    setStartsOnSequence(String(term?.starts_on_sequence ?? startOptions[0]?.sequenceNo ?? 1));
    setPreviousReading(String(Number(currentCharge?.meter_previous ?? latestMeterReading ?? lastReading) || ''));
    setCurrentReading(String(currentCharge?.meter_current ?? ''));
    setError(null);
  }, [currentCharge, lastReading, latestMeterReading, startOptions, term]);

  const calculatedAmount = calculationType === 'meter'
    ? Math.max((Number(currentReading || 0) - Number(previousReading || 0)) * Number(unitRate || 0), 0)
    : Number(fixedAmount || 0);
  const canCalculateMeter = Number(previousReading) > 0
    && Number(currentReading) > Number(previousReading)
    && Number(unitRate) > 0;
  const hasRate = Number(unitRate) > 0;
  // The first-ever cycle on a unit has no meter history to auto-fill the
  // previous reading, so let it be entered by hand as an opening reading.
  const isFirstReading = readings.length === 0 && !currentCharge && !(Number(previousReading) > 0);
  // Setting the ₪/unit is the real first step - surface it instead of a dead
  // compute button when the rate hasn't been configured yet.
  const needsRateSetup = calculationType === 'meter' && !hasRate && !currentCharge;
  const canCompute = calculationType === 'meter' ? canCalculateMeter : Number(fixedAmount) > 0;

  const handleCalculate = async () => {
    if (calculationType === 'meter' && (Number(previousReading) <= 0 || Number(currentReading) <= 0)) {
      setError('יש להזין מונה אחרון ומונה נוכחי גדולים מ־0.');
      return;
    }
    if (calculationType === 'meter' && Number(currentReading) <= Number(previousReading)) {
      setError('המונה הנוכחי חייב להיות שווה למונה האחרון או גבוה ממנו.');
      return;
    }
    if (calculationType === 'meter' && (!unitRate || Number(unitRate) <= 0)) {
      setError('יש להזין מחיר תקין ליחידה.');
      return;
    }
    if (calculationType === 'fixed' && Number(fixedAmount) <= 0) {
      setError('יש להזין מחיר קבוע גדול מ־0.');
      return;
    }

    setError(null);
    try {
      await onCalculate({
        tenancy,
        paymentType: type,
        calculationType,
        previousReading: Number(previousReading),
        currentReading: Number(currentReading),
        unitRate: Number(unitRate),
        fixedAmount: Number(fixedAmount),
        frequencyMonths,
        startsOnSequence: Number(startsOnSequence),
      });
    } catch {
      // The hook shows the server error.
    }
  };

  return (
    <div className="payments-card flex flex-col self-start rounded-2xl border bg-card p-4 shadow-sm" data-guide={`${type}-card`}>
      {/* Header - identity, status, and the quiet settings control */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h4 className="font-display text-lg leading-tight">{title}</h4>
            <p className="text-xs text-muted-foreground">{dueDateLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PaymentBadge charge={currentCharge} />
          <Button type="button" size="sm" variant="outline" className="rounded-full bg-muted" onClick={onEditSettings} aria-label={`הגדרות ${title}`} data-guide={type === 'electricity' ? 'electricity-settings' : undefined}>
            <Settings className="h-4 w-4" />
            הגדרות
          </Button>
        </div>
      </div>

      {needsRateSetup ? (
        <div className="mt-4 rounded-xl bg-muted/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">כדי לחשב חיוב {title} צריך קודם להגדיר מחיר ליחידה.</p>
          <Button className="mt-3 h-11 w-full rounded-full sm:h-10" onClick={onEditSettings}>
            <Settings className="h-4 w-4" />
            הגדירו מחיר ליחידה
          </Button>
        </div>
      ) : (
        <>
          {/* Compute - full editor while creating/editing, else a calm summary line */}
          <div className="mt-4">
            {!currentCharge || editingCompute ? (
              <>
                <p className="mb-2 text-xs font-bold text-primary">{currentCharge ? 'עריכת חישוב' : 'שלב 1 · חישוב החיוב'}</p>
                {calculationType === 'meter' ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`${type}-${tenancy.id}-previous`}>{isFirstReading ? 'מונה פתיחה' : 'מונה אחרון (אוטומטי)'}</Label>
                        <div className="relative">
                          <Gauge className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id={`${type}-${tenancy.id}-previous`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={previousReading}
                            onChange={isFirstReading ? (event) => setPreviousReading(event.target.value) : undefined}
                            readOnly={!isFirstReading}
                            aria-describedby={`${type}-${tenancy.id}-previous-help`}
                            className={`h-11 rounded-xl pr-9 nums ${isFirstReading ? '' : 'bg-muted'}`}
                          />
                        </div>
                        <p id={`${type}-${tenancy.id}-previous-help`} className="text-xs text-muted-foreground">{isFirstReading ? 'קריאת המונה בתחילת השכירות' : 'נשלף מהיסטוריית היחידה'}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${type}-${tenancy.id}-reading`}>הזיני מונה נוכחי</Label>
                        <Input
                          id={`${type}-${tenancy.id}-reading`}
                          type="number"
                          min={previousReading || '0.01'}
                          step="0.01"
                          value={currentReading}
                          onChange={(event) => setCurrentReading(event.target.value)}
                            className="h-11 rounded-xl nums"
                            data-guide={type === 'electricity' ? 'electricity-reading' : undefined}
                        />
                      </div>
                    </div>
                    {Number(currentReading) > 0 && Number(currentReading) <= Number(previousReading) && (
                      <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">הקריאה הנוכחית צריכה להיות גבוהה מהקודמת כדי לחשב.</p>
                    )}
                    <div className="mt-3">
                      <Button type="button" size="sm" variant="ghost" className="rounded-full bg-muted text-muted-foreground" onClick={() => setHistoryOpen((open) => !open)}>
                        {historyOpen ? 'הסתר היסטוריה' : `היסטוריית מונים (${readings.length})`}
                      </Button>
                      {historyOpen && (
                        <div className="mt-2 space-y-2 rounded-xl bg-muted/60 p-3">
                          {readings.length === 0 ? <p className="text-sm text-muted-foreground">אין עדיין קריאות שמורות.</p> : readings.slice(0, 8).map((reading) => (
                            <div key={reading.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="min-w-24 text-muted-foreground">{new Date(`${reading.reading_date}T12:00:00`).toLocaleDateString('he-IL')}</span>
                              <Input type="number" min="0" step="0.001" defaultValue={String(reading.value)} className="h-9 min-w-0 flex-1 rounded-lg nums" onBlur={(event) => { const value = Number(event.target.value); if (value >= 0 && value !== Number(reading.value)) void updateReading({ id: reading.id, patch: { value } }); }} />
                              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full text-destructive" onClick={() => void deleteReading(reading.id)} aria-label="מחק קריאה"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">הסכום הקבוע נקבע דרך ההגדרות (⚙️ בראש הכרטיס).</p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="nums text-sm text-muted-foreground">
                    {calculatedAmount > 0 ? <>צפי חיוב: <span className="font-semibold text-foreground">₪{calculatedAmount.toLocaleString()}</span></> : 'טרם נוצר חיוב'}{calculationType === 'meter' && hasRate ? ` · ₪${Number(unitRate).toLocaleString()} ליחידה` : ''}
                  </p>
                  {currentCharge ? (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => setEditingCompute(false)}>בטל</Button>
                      <Button type="button" size="sm" className="rounded-full" onClick={() => { void handleCalculate(); setEditingCompute(false); }} disabled={isCalculating || !canCompute} data-guide={type === 'electricity' ? 'electricity-create-charge' : undefined}>
                        <Calculator className="h-4 w-4" />
                        {isCalculating ? 'שומר...' : 'עדכן חיוב'}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="h-11 rounded-full sm:h-9" onClick={() => { void handleCalculate(); }} disabled={isCalculating || !canCompute} data-guide={type === 'electricity' ? 'electricity-create-charge' : undefined}>
                      <Plus className="h-4 w-4" />
                      {isCalculating ? 'שומר...' : 'צור חיוב'}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <span className="nums text-muted-foreground">
                  {calculationType === 'meter'
                    ? <>מונה <span className="font-medium text-foreground">{Number(currentCharge.meter_previous ?? 0).toLocaleString()}</span> ← <span className="font-medium text-foreground">{Number(currentCharge.meter_current ?? 0).toLocaleString()}</span>{hasRate ? ` · ₪${Number(unitRate).toLocaleString()} ליחידה` : ''}</>
                    : 'חיוב קבוע'}
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-muted-foreground" onClick={() => setEditingCompute(true)}>
                  <Calculator className="h-4 w-4" />
                  ערוך חישוב
                </Button>
              </div>
            )}
          </div>

          {/* Payment (only once a charge exists) */}
          {currentCharge && (
            <div className="mt-4 border-t pt-4">
              <p className="nums text-sm text-muted-foreground">
                שולם ₪{shownPaid(Number(currentCharge.paid_amount), Number(currentCharge.amount_due)).toLocaleString()} מתוך ₪{Number(currentCharge.amount_due).toLocaleString()}
              </p>
              <PaidMeter paid={Number(currentCharge.paid_amount)} due={Number(currentCharge.amount_due)} />
              <div className="mt-3 flex flex-wrap gap-2" data-guide={`${type}-payment-actions`}>
                <Button size="sm" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={paymentState(currentCharge) === 'paid' || isMarking} onClick={() => { void onMarkPaid(currentCharge).catch(() => undefined); }} data-guide={type === 'electricity' ? 'electricity-mark-paid' : undefined}>
                  <CheckCircle className="h-4 w-4" />
                  {isMarking ? 'שומר...' : 'סמן כשולם'}
                </Button>
                <Button size="sm" variant="outline" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={isMarking} onClick={() => onEditCharge(currentCharge)} data-guide={type === 'electricity' ? 'electricity-partial' : undefined}>
                  תשלום חלקי
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

interface PaymentsPageProps {
  tenancies: TenancyWithNames[];
  allTenancies: TenancyWithNames[];
  charges: ChargeWithPaid[];
  paymentTerms: PaymentTerm[];
  billingSettingsByTenancyId: Map<string, BillingSettings>;
  occurrencesByTenancyId: Map<string, BillingOccurrence[]>;
  currentOccurrenceByTenancyId: Map<string, BillingOccurrence>;
  currentRentByTenancyId: Map<string, ChargeWithPaid>;
  isLoading: boolean;
  pendingKeys: Set<string>;
  focusedTenancyId?: string | null;
  onClearFocus: () => void;
  onAddTenant: () => void;
  onMarkRentPaid: (tenancy: TenancyWithNames) => Promise<void>;
  /** Opens the tenancy for editing - the only place the monthly rent can be set. */
  onEditTenancy: (tenancy: TenancyWithNames) => void;
  onSaveRentPayment: (input: { tenancy: TenancyWithNames; amountDue: number; paidAmount: number; paidAt: string }) => Promise<void>;
  onSaveUtilityCharge: UtilityCardProps['onCalculate'];
  onMarkChargePaid: (charge: ChargeWithPaid) => Promise<void>;
  onSaveChargePayment: (input: { charge: ChargeWithPaid; amountDue: number; paidAmount: number; paidAt: string }) => Promise<void>;
  onAddAdditionalPayment: (input: {
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
  }) => Promise<void>;
  onUpdateAdditionalPayment: (input: {
    term: PaymentTerm;
    paymentType: AdditionalPaymentType;
    label: string;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => Promise<void>;
  onUpdateUtilityPaymentSettings: (input: {
    term: PaymentTerm;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => Promise<void>;
  onSaveUtilityPaymentSettings: (input: {
    tenancy: TenancyWithNames;
    paymentType: UtilityPaymentType;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => Promise<void>;
  onSaveFixedTermCharge: (input: { term: PaymentTerm; fixedAmount: number }) => Promise<void>;
  onSaveMeterTermCharge: (input: { term: PaymentTerm; previousReading: number; currentReading: number; unitRate: number }) => Promise<void>;
  onDeletePaymentTerm: (term: PaymentTerm) => Promise<void>;
  onSaveBillingSettings: (input: {
    tenancy: TenancyWithNames;
    calendar: BillingCalendar;
    dueDay: number;
    startDate: string;
  }) => Promise<void>;
}

export function PaymentsPage({
  tenancies,
  allTenancies,
  charges,
  paymentTerms,
  billingSettingsByTenancyId,
  occurrencesByTenancyId,
  currentOccurrenceByTenancyId,
  currentRentByTenancyId,
  isLoading,
  pendingKeys,
  focusedTenancyId = null,
  onClearFocus,
  onAddTenant,
  onMarkRentPaid,
  onEditTenancy,
  onSaveRentPayment,
  onSaveUtilityCharge,
  onMarkChargePaid,
  onSaveChargePayment,
  onAddAdditionalPayment,
  onUpdateAdditionalPayment,
  onUpdateUtilityPaymentSettings,
  onSaveUtilityPaymentSettings,
  onSaveFixedTermCharge,
  onSaveMeterTermCharge,
  onDeletePaymentTerm,
  onSaveBillingSettings,
}: PaymentsPageProps) {
  const [editingRent, setEditingRent] = useState<TenancyWithNames | null>(null);
  const [editingCharge, setEditingCharge] = useState<{ tenancy: TenancyWithNames; charge: ChargeWithPaid } | null>(null);
  const [addingFor, setAddingFor] = useState<TenancyWithNames | null>(null);
  const [editingTerm, setEditingTerm] = useState<{ tenancy: TenancyWithNames; term: PaymentTerm } | null>(null);
  const [editingUtility, setEditingUtility] = useState<{ tenancy: TenancyWithNames; type: UtilityPaymentType; term?: PaymentTerm } | null>(null);
  const [termToDelete, setTermToDelete] = useState<PaymentTerm | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<TenancyWithNames | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const focusedTenancy = useMemo(
    () => tenancies.find((tenancy) => tenancy.id === focusedTenancyId) ?? null,
    [focusedTenancyId, tenancies],
  );
  const visibleTenancies = useMemo(
    () => (focusedTenancy ? [focusedTenancy] : tenancies),
    [focusedTenancy, tenancies],
  );
  const visibleTenancyIds = useMemo(() => new Set(visibleTenancies.map((tenancy) => tenancy.id)), [visibleTenancies]);
  const historyCharges = focusedTenancy
    ? charges.filter((charge) => charge.tenancy_id === focusedTenancy.id)
    : charges;
  const historyTenancies = focusedTenancy ? [focusedTenancy] : allTenancies;

  const { dueCharges, pastDebt } = useMemo(() => {
    const today = localDateISO();
    const due = charges.filter((charge) => visibleTenancyIds.has(charge.tenancy_id) && charge.due_date <= today);
    // The summary reflects the CURRENT period only: keep the latest-due charge
    // of each recurring series per tenant (rent by payment_type, extras by their
    // term id), so the totals show this month - not the whole accumulated
    // history. Full history stays available under "היסטוריה וחובות".
    const seriesKey = (charge: ChargeWithPaid) => {
      const term = charge.period_key?.match(/^term:([^:]+):/);
      return `${charge.tenancy_id}|${term ? `term:${term[1]}` : charge.payment_type}`;
    };
    const current = new Map<string, ChargeWithPaid>();
    for (const charge of due) {
      const key = seriesKey(charge);
      const existing = current.get(key);
      if (!existing || charge.due_date > existing.due_date) current.set(key, charge);
    }
    const currentIds = new Set([...current.values()].map((charge) => charge.id));
    // Debt carried from earlier periods: due charges that aren't the current one
    // in their series and still have an open balance.
    const debt = due
      .filter((charge) => !currentIds.has(charge.id))
      .reduce((sum, charge) => sum + Math.max(Number(charge.amount_due) - Number(charge.paid_amount), 0), 0);
    return { dueCharges: [...current.values()], pastDebt: debt };
  }, [charges, visibleTenancyIds]);
  const totalDue = dueCharges.reduce((sum, charge) => sum + Number(charge.amount_due), 0);
  const totalPaid = dueCharges.reduce((sum, charge) => sum + Number(charge.paid_amount), 0);
  const startOptionsForTenancy = (tenancy: TenancyWithNames | null) => {
    if (!tenancy) return [{ sequenceNo: 1, label: 'המועד הראשון' }];
    const calendar = (billingSettingsByTenancyId.get(tenancy.id)?.calendar_type as BillingCalendar | undefined) ?? 'gregorian';
    const options = (occurrencesByTenancyId.get(tenancy.id) ?? []).slice(0, 18).map((item) => ({
      sequenceNo: item.sequence_no,
      label: formatBillingShortDate(item.due_date, calendar),
    }));
    return options.length > 0 ? options : [{ sequenceNo: 1, label: 'המועד הראשון' }];
  };

  if (isLoading) return <p className="py-12 text-center text-muted-foreground">טוען תשלומים...</p>;

  return (
    <div className="space-y-6" data-guide="payments-page">
      <section className="rounded-[2rem] border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <ReceiptText className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-display">כל התשלומים במקום אחד</h2>
            <p className="mt-1 text-muted-foreground">שכירות, מונים וחיובים קבועים - לפי יחידה ושוכר.</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-2 text-center">
              <div className="px-3 py-2"><p className="text-xs text-muted-foreground">לתשלום החודש</p><p className="nums font-bold">₪{totalDue.toLocaleString()}</p></div>
              <div className="px-3 py-2"><p className="text-xs text-muted-foreground">שולם</p><p className="nums font-bold">₪{totalPaid.toLocaleString()}</p></div>
              <div className="px-3 py-2"><p className="text-xs text-muted-foreground">נשאר</p><p className="nums font-bold">₪{Math.max(totalDue - totalPaid, 0).toLocaleString()}</p></div>
            </div>
            {pastDebt > 0 && (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
                <span>חוב מחודשים קודמים</span>
                <span className="nums font-bold">₪{pastDebt.toLocaleString()}</span>
              </div>
            )}
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" />
              היסטוריה וחובות
            </Button>
          </div>
        </div>
      </section>

      {focusedTenancy && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold text-primary">תצוגה ממוקדת</p>
            <p className="truncate font-semibold">{focusedTenancy.tenant_name} · {focusedTenancy.unit_name}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full bg-background" onClick={onClearFocus}>
            <Users className="h-4 w-4" />
            הצגת כל השוכרים
          </Button>
        </div>
      )}

      {visibleTenancies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-display text-lg">כדי לנהל תשלומים צריך שכירות פעילה</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">הוסיפו שוכר ושייכו אותו ליחידה. מסך התשלומים ייפתח עבורו אוטומטית.</p>
            <Button type="button" className="mt-5 rounded-full" onClick={onAddTenant}><Plus className="h-4 w-4" />הוספת שוכר</Button>
          </CardContent>
        </Card>
      ) : visibleTenancies.map((tenancy) => {
        const rentCharge = currentRentByTenancyId.get(tenancy.id);
        const tenantTerms = paymentTerms.filter((term) => term.tenancy_id === tenancy.id);
        const additionalTerms = tenantTerms.filter((term) => !['electricity', 'water'].includes(term.payment_type));
        const today = localDateISO();
        const occurrence = currentOccurrenceByTenancyId.get(tenancy.id);
        const occurrenceIsDue = occurrence ? occurrence.due_date <= today : false;
        const schedule = billingSettingsByTenancyId.get(tenancy.id);
        const calendar = (schedule?.calendar_type as BillingCalendar | undefined) ?? 'gregorian';
        const upcoming = occurrencesByTenancyId.get(tenancy.id)?.find((item) => item.due_date > today && item.due_date !== occurrence?.due_date);
        const occurrences = occurrencesByTenancyId.get(tenancy.id) ?? [];
        const startOptions = occurrences.slice(0, 18).map((item) => ({
          sequenceNo: item.sequence_no,
          label: formatBillingShortDate(item.due_date, calendar),
        }));
        const occurrenceForFrequency = (frequencyMonths: 1 | 2, startsOnSequence = 1) => {
          const eligible = occurrences.filter((item) => (
            item.sequence_no >= startsOnSequence
            && (item.sequence_no - startsOnSequence) % frequencyMonths === 0
          ));
          const due = eligible.filter((item) => item.due_date <= today);
          return due[due.length - 1] ?? eligible[0] ?? null;
        };
        const dueDateLabelForFrequency = (frequencyMonths: 1 | 2, startsOnSequence = 1) => {
          const item = occurrenceForFrequency(frequencyMonths, startsOnSequence);
          if (!item) return 'מועד חיוב יוגדר אוטומטית';
          return `${item.due_date <= today ? 'מועד חיוב' : 'מועד הבא'}: ${formatBillingShortDate(item.due_date, calendar)}`;
        };
        const dueDateLabel = dueDateLabelForFrequency(1);
        const activeOccurrenceKeyForFrequency = (frequencyMonths: 1 | 2, startsOnSequence = 1) => {
          const item = occurrenceForFrequency(frequencyMonths, startsOnSequence);
          return item && item.due_date <= today ? item.period_key : null;
        };
        const latestChargeForTerm = (term: PaymentTerm) => charges.find((charge) => (
          charge.tenancy_id === tenancy.id && charge.period_key.startsWith(`term:${term.id}:`)
        ));
        const currentChargeForTerm = (term: PaymentTerm) => {
          const activeOccurrenceKey = activeOccurrenceKeyForFrequency(term.frequency_months === 2 ? 2 : 1, term.starts_on_sequence ?? 1);
          if (!activeOccurrenceKey) return latestChargeForTerm(term);
          return charges.find((charge) => (
            charge.tenancy_id === tenancy.id
            && charge.period_key === `term:${term.id}:${activeOccurrenceKey}`
          ));
        };
        const utilityData = (type: UtilityPaymentType) => {
          const term = tenantTerms.find((item) => item.payment_type === type);
          const currentCharge = term
            ? currentChargeForTerm(term)
            : charges.find((charge) => charge.tenancy_id === tenancy.id && charge.payment_type === type);
          const prior = charges.find((charge) => (
            charge.tenancy_id === tenancy.id
            && charge.payment_type === type
            && charge.id !== currentCharge?.id
            && charge.meter_current !== null
          ));
          return {
            term,
            currentCharge,
            lastReading: Number(currentCharge?.meter_previous ?? prior?.meter_current ?? 0),
            dueDateLabel: dueDateLabelForFrequency(term?.frequency_months === 1 ? 1 : 2, term?.starts_on_sequence ?? 1),
            startOptions,
          };
        };
        const electricity = utilityData('electricity');
        const water = utilityData('water');
        const rentDue = Number(rentCharge?.amount_due ?? tenancy.monthly_rent ?? 0);
        const rentPaid = Number(rentCharge?.paid_amount ?? 0);

        return (
          <section key={tenancy.id} className="overflow-hidden rounded-[2rem] border bg-card">
            <div className="flex flex-col gap-3 border-b bg-muted/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-display">{tenancy.unit_name} - {tenancy.tenant_name}</h3>
                <p className="text-sm text-muted-foreground">כל החיובים של השכירות הפעילה</p>
              </div>
              <Button variant="outline" className="rounded-full" onClick={() => setAddingFor(tenancy)}>
                <Plus className="h-4 w-4" />
                הוסף תשלום נוסף
              </Button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><WalletCards className="h-7 w-7" /></span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-2xl leading-tight">שכר דירה</h4>
                        <PaymentBadge charge={rentCharge} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {occurrence && occurrenceIsDue ? `מועד נוכחי: ${formatBillingShortDate(occurrence.due_date, calendar)}` : ''}
                        {occurrence && !occurrenceIsDue ? `מועד הבא: ${formatBillingShortDate(occurrence.due_date, calendar)}` : ''}
                        {upcoming && occurrenceIsDue ? ` · הבא: ${formatBillingShortDate(upcoming.due_date, calendar)}` : ''}
                        {!occurrence ? 'מועד התשלום יוגדר אוטומטית' : ''}
                      </p>
                    </div>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" onClick={() => setEditingSchedule(tenancy)} disabled={pendingKeys.has(`schedule:${tenancy.id}`)} aria-label={schedule ? 'מועד תשלום' : 'הגדר מועד תשלום'}>
                    <CalendarClock className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="flex items-baseline gap-1.5 nums text-2xl font-semibold">
                      <span>₪{shownPaid(rentPaid, rentDue).toLocaleString()}</span>
                      <span className="text-base font-normal text-muted-foreground">מתוך ₪{rentDue.toLocaleString()}</span>
                    </p>
                    <p className="nums text-sm text-muted-foreground">נשאר ₪{Math.max(rentDue - rentPaid, 0).toLocaleString()}</p>
                  </div>
                  <PaidMeter paid={rentPaid} due={rentDue} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2" data-guide="rent-payment-actions">
                  {rentDue <= 0 ? (
                    // Without a rent amount every payment action is a no-op
                    // (0 <= 0 disables "mark paid", and the hook returns early),
                    // so say why and point at the one screen that can fix it
                    // instead of leaving a dead button with no explanation.
                    <div className="w-full rounded-xl bg-muted/60 p-3">
                      <p className="text-sm text-muted-foreground">עדיין לא הוגדר שכר דירה לשכירות הזו, ולכן אי אפשר לרשום תשלום.</p>
                      <Button size="sm" className="mt-3 h-11 rounded-full sm:h-9" onClick={() => onEditTenancy(tenancy)}>
                        <PencilLine className="h-4 w-4" />
                        הגדירו שכר דירה
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button size="sm" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" onClick={() => { void onMarkRentPaid(tenancy).catch(() => undefined); }} disabled={rentDue <= rentPaid || pendingKeys.has(tenancy.id)} data-guide="rent-mark-paid">
                        <CheckCircle className="h-4 w-4" />
                        {pendingKeys.has(tenancy.id) ? 'שומר...' : markPaidLabel(tenancy.payment_method)}
                      </Button>
                      <Button size="sm" variant="outline" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" onClick={() => setEditingRent(tenancy)} disabled={pendingKeys.has(tenancy.id)} data-guide="rent-partial">
                        תשלום חלקי
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                <UtilityCard tenancy={tenancy} type="electricity" {...electricity} pendingKeys={pendingKeys} onCalculate={onSaveUtilityCharge} onMarkPaid={onMarkChargePaid} onEditCharge={(charge) => setEditingCharge({ tenancy, charge })} onEditSettings={() => setEditingUtility({ tenancy, type: 'electricity', term: electricity.term })} />
                <UtilityCard tenancy={tenancy} type="water" {...water} pendingKeys={pendingKeys} onCalculate={onSaveUtilityCharge} onMarkPaid={onMarkChargePaid} onEditCharge={(charge) => setEditingCharge({ tenancy, charge })} onEditSettings={() => setEditingUtility({ tenancy, type: 'water', term: water.term })} />
                {additionalTerms.map((term) => {
                  const charge = currentChargeForTerm(term);
                  if (term.calculation_type === 'meter') {
                    const prior = charges.find((item) => (
                      item.period_key.startsWith(`term:${term.id}:`)
                      && item.id !== charge?.id
                      && item.meter_current !== null
                    ));
                    return (
                      <MeterTermRow
                        key={term.id}
                        term={term}
                        charge={charge}
                        lastReading={Number(charge?.meter_previous ?? prior?.meter_current ?? 0)}
                        dueDateLabel={dueDateLabelForFrequency(term.frequency_months === 2 ? 2 : 1, term.starts_on_sequence ?? 1)}
                        isSaving={pendingKeys.has(`term:${term.id}`)}
                        isMarking={charge ? pendingKeys.has(`charge:${charge.id}`) : false}
                        onSave={onSaveMeterTermCharge}
                        onMarkPaid={onMarkChargePaid}
                        onPartialPaid={(selectedCharge) => setEditingCharge({ tenancy, charge: selectedCharge })}
                        onEdit={() => setEditingTerm({ tenancy, term })}
                        onDelete={() => setTermToDelete(term)}
                      />
                    );
                  }
                  return (
                    <FixedTermRow
                      key={term.id}
                      term={term}
                      charge={charge}
                      dueDateLabel={dueDateLabelForFrequency(term.frequency_months === 2 ? 2 : 1, term.starts_on_sequence ?? 1)}
                      isSaving={pendingKeys.has(`term:${term.id}`)}
                      isMarking={charge ? pendingKeys.has(`charge:${charge.id}`) : false}
                      onSave={onSaveFixedTermCharge}
                      onMarkPaid={onMarkChargePaid}
                      onPartialPaid={(selectedCharge) => setEditingCharge({ tenancy, charge: selectedCharge })}
                      onEdit={() => setEditingTerm({ tenancy, term })}
                      onDelete={() => setTermToDelete(term)}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <PaymentEditorDialog
        open={editingRent !== null}
        tenancy={editingRent}
        charge={editingRent ? currentRentByTenancyId.get(editingRent.id) ?? null : null}
        calendar={editingRent ? (billingSettingsByTenancyId.get(editingRent.id)?.calendar_type as BillingCalendar | undefined) ?? 'gregorian' : 'gregorian'}
        isSaving={editingRent ? pendingKeys.has(editingRent.id) : false}
        onOpenChange={(open) => { if (!open) setEditingRent(null); }}
        onSave={onSaveRentPayment}
      />
      <AddAdditionalPaymentDialog
        open={addingFor !== null}
        tenancy={addingFor}
        initialTerm={null}
        startOptions={startOptionsForTenancy(addingFor)}
        defaultStartSequence={addingFor ? currentOccurrenceByTenancyId.get(addingFor.id)?.sequence_no : undefined}
        isSaving={addingFor ? pendingKeys.has(`additional:${addingFor.id}`) : false}
        onOpenChange={(open) => { if (!open) setAddingFor(null); }}
        onSave={onAddAdditionalPayment}
      />
      <AddAdditionalPaymentDialog
        open={editingTerm !== null}
        tenancy={editingTerm?.tenancy ?? null}
        initialTerm={editingTerm?.term ?? null}
        startOptions={startOptionsForTenancy(editingTerm?.tenancy ?? null)}
        isSaving={editingTerm ? pendingKeys.has(`edit-term:${editingTerm.term.id}`) : false}
        onOpenChange={(open) => { if (!open) setEditingTerm(null); }}
        onSave={async (input) => {
          if (!input.term) return;
          await onUpdateAdditionalPayment({
            term: input.term,
            paymentType: input.paymentType,
            label: input.label,
            calculationType: input.calculationType,
            fixedAmount: input.fixedAmount,
            unitRate: input.unitRate,
            frequencyMonths: input.frequencyMonths,
            startsOnSequence: input.startsOnSequence,
          });
          setEditingTerm(null);
        }}
      />
      <UtilitySettingsDialog
        open={editingUtility !== null}
        term={editingUtility?.term ?? null}
        paymentType={editingUtility?.type ?? 'electricity'}
        startOptions={startOptionsForTenancy(editingUtility?.tenancy ?? null)}
        isSaving={editingUtility ? pendingKeys.has(editingUtility.term ? `edit-term:${editingUtility.term.id}` : `utility-settings:${editingUtility.type}:${editingUtility.tenancy.id}`) : false}
        onOpenChange={(open) => { if (!open) setEditingUtility(null); }}
        onSave={async (input) => {
          if (!editingUtility) return;
          if (input.term) {
            await onUpdateUtilityPaymentSettings({
              term: input.term,
              calculationType: input.calculationType,
              fixedAmount: input.fixedAmount,
              unitRate: input.unitRate,
              frequencyMonths: input.frequencyMonths,
              startsOnSequence: input.startsOnSequence,
            });
          } else {
            await onSaveUtilityPaymentSettings({
              tenancy: editingUtility.tenancy,
              paymentType: editingUtility.type,
              calculationType: input.calculationType,
              fixedAmount: input.fixedAmount,
              unitRate: input.unitRate,
              frequencyMonths: input.frequencyMonths,
              startsOnSequence: input.startsOnSequence,
            });
          }
          setEditingUtility(null);
        }}
      />
      <BillingSettingsDialog
        open={editingSchedule !== null}
        tenancy={editingSchedule}
        settings={editingSchedule ? billingSettingsByTenancyId.get(editingSchedule.id) : undefined}
        isSaving={editingSchedule ? pendingKeys.has(`schedule:${editingSchedule.id}`) : false}
        onOpenChange={(open) => { if (!open) setEditingSchedule(null); }}
        onSave={onSaveBillingSettings}
      />
      <PaymentHistoryDialog
        open={historyOpen}
        charges={historyCharges}
        tenancies={historyTenancies}
        onOpenChange={setHistoryOpen}
        onEditCharge={(tenancy, charge) => {
          setHistoryOpen(false);
          setEditingCharge({ tenancy, charge });
        }}
      />
      <PaymentEditorDialog
        open={editingCharge !== null}
        tenancy={editingCharge?.tenancy ?? null}
        charge={editingCharge?.charge ?? null}
        calendar={editingCharge ? (billingSettingsByTenancyId.get(editingCharge.tenancy.id)?.calendar_type as BillingCalendar | undefined) ?? 'gregorian' : 'gregorian'}
        isSaving={editingCharge ? pendingKeys.has(`charge:${editingCharge.charge.id}`) : false}
        onOpenChange={(open) => { if (!open) setEditingCharge(null); }}
        onSave={async ({ amountDue, paidAmount, paidAt }) => {
          if (!editingCharge) return;
          await onSaveChargePayment({ charge: editingCharge.charge, amountDue, paidAmount, paidAt });
        }}
      />
      <AlertDialog open={termToDelete !== null} onOpenChange={(open) => { if (!open) setTermToDelete(null); }}>
        <AlertDialogContent dir="rtl" className="rounded-[2rem] text-right [&>button]:left-4 [&>button]:right-auto">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>למחוק את “{termToDelete?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              הפעולה תמחק את התשלום הנוסף ואת החיובים שנוצרו ממנו. אי אפשר לבטל את המחיקה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className="rounded-full">ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={termToDelete ? pendingKeys.has(`delete-term:${termToDelete.id}`) : false}
              onClick={(event) => {
                event.preventDefault();
                if (!termToDelete) return;
                void onDeletePaymentTerm(termToDelete).then(() => setTermToDelete(null)).catch(() => undefined);
              }}
            >
              מחק תשלום
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MeterTermRow({
  term,
  charge,
  lastReading,
  dueDateLabel,
  isSaving,
  isMarking,
  onSave,
  onMarkPaid,
  onPartialPaid,
  onEdit,
  onDelete,
}: {
  term: PaymentTerm;
  charge?: ChargeWithPaid;
  lastReading: number;
  dueDateLabel: string;
  isSaving: boolean;
  isMarking: boolean;
  onSave: (input: { term: PaymentTerm; previousReading: number; currentReading: number; unitRate: number }) => Promise<void>;
  onMarkPaid: (charge: ChargeWithPaid) => Promise<void>;
  onPartialPaid: (charge: ChargeWithPaid) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [previousReading, setPreviousReading] = useState(String(Number(charge?.meter_previous ?? lastReading) || ''));
  const [currentReading, setCurrentReading] = useState(String(charge?.meter_current ?? ''));
  const [unitRate, setUnitRate] = useState(String(Number(term.unit_rate ?? charge?.meter_rate ?? 0) || ''));
  const amount = Math.max((Number(currentReading || 0) - Number(previousReading || 0)) * Number(unitRate || 0), 0);
  const hasRate = Number(unitRate) > 0;
  const canSave = Number(previousReading) > 0 && Number(currentReading) > 0
    && Number(unitRate) > 0 && Number(currentReading) >= Number(previousReading);
  const [editingCompute, setEditingCompute] = useState(false);

  useEffect(() => {
    setPreviousReading(String(Number(charge?.meter_previous ?? lastReading) || ''));
    setCurrentReading(String(charge?.meter_current ?? ''));
    setUnitRate(String(Number(term.unit_rate ?? charge?.meter_rate ?? 0) || ''));
  }, [charge, lastReading, term]);

  return (
    <div className="flex flex-col self-start rounded-2xl border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <h4 className="font-display text-lg leading-tight">{term.label}</h4>
            <p className="text-xs text-muted-foreground">{dueDateLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PaymentBadge charge={charge} />
          <Button type="button" size="sm" variant="outline" className="rounded-full bg-muted" onClick={onEdit} aria-label={`הגדרות ${term.label}`}>
            <Settings className="h-4 w-4" />
            הגדרות
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} aria-label={`מחק ${term.label}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Compute - full editor while creating/editing, else a calm summary line */}
      <div className="mt-4">
        {!charge || editingCompute ? (
          <>
            <p className="mb-2 text-xs font-bold text-primary">{charge ? 'עריכת חישוב' : 'שלב 1 · חישוב החיוב'}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input type="number" min="0.01" step="0.01" value={previousReading} onChange={(event) => setPreviousReading(event.target.value)} className="h-10 rounded-xl nums" placeholder="מונה אחרון" />
              <Input type="number" min={previousReading || '0.01'} step="0.01" value={currentReading} onChange={(event) => setCurrentReading(event.target.value)} className="h-10 rounded-xl nums" placeholder="מונה נוכחי" />
            </div>
            {!hasRate && (
              <p className="mt-2 text-xs text-muted-foreground">יש להגדיר מחיר ליחידה דרך ההגדרות (⚙️ בראש הכרטיס) כדי לחשב.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="nums text-sm text-muted-foreground">{amount > 0 ? <>צפי חיוב: <span className="font-semibold text-foreground">₪{amount.toLocaleString()}</span></> : 'טרם נוצר חיוב'}{hasRate ? ` · ₪${Number(unitRate).toLocaleString()} ליחידה` : ''}</p>
              {charge ? (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => setEditingCompute(false)}>בטל</Button>
                  <Button type="button" size="sm" className="rounded-full" disabled={isSaving || !canSave} onClick={() => { void onSave({ term, previousReading: Number(previousReading), currentReading: Number(currentReading), unitRate: Number(unitRate) }).then(() => setEditingCompute(false)).catch(() => undefined); }}>
                    <Calculator className="h-4 w-4" />
                    {isSaving ? 'שומר...' : 'עדכן חיוב'}
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="h-11 rounded-full sm:h-9" disabled={isSaving || !canSave} onClick={() => { void onSave({ term, previousReading: Number(previousReading), currentReading: Number(currentReading), unitRate: Number(unitRate) }).catch(() => undefined); }}>
                  <Plus className="h-4 w-4" />
                  {isSaving ? 'שומר...' : 'צור חיוב'}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span className="nums text-muted-foreground">מונה <span className="font-medium text-foreground">{Number(charge.meter_previous ?? 0).toLocaleString()}</span> ← <span className="font-medium text-foreground">{Number(charge.meter_current ?? 0).toLocaleString()}</span>{hasRate ? ` · ₪${Number(unitRate).toLocaleString()} ליחידה` : ''}</span>
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-muted-foreground" onClick={() => setEditingCompute(true)}>
              <Calculator className="h-4 w-4" />
              ערוך חישוב
            </Button>
          </div>
        )}
      </div>

      {/* Payment */}
      {charge && (
        <div className="mt-4 border-t pt-4">
          <p className="nums text-sm text-muted-foreground">שולם ₪{shownPaid(Number(charge.paid_amount), Number(charge.amount_due)).toLocaleString()} מתוך ₪{Number(charge.amount_due).toLocaleString()}</p>
          <PaidMeter paid={Number(charge.paid_amount)} due={Number(charge.amount_due)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={paymentState(charge) === 'paid' || isMarking} onClick={() => { void onMarkPaid(charge).catch(() => undefined); }}>
              <CheckCircle className="h-4 w-4" />
              {isMarking ? 'שומר...' : 'סמן כשולם'}
            </Button>
            <Button size="sm" variant="outline" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={isMarking} onClick={() => onPartialPaid(charge)}>
              תשלום חלקי
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FixedTermRow({
  term,
  charge,
  dueDateLabel,
  isSaving,
  isMarking,
  onSave,
  onMarkPaid,
  onPartialPaid,
  onEdit,
  onDelete,
}: {
  term: PaymentTerm;
  charge?: ChargeWithPaid;
  dueDateLabel: string;
  isSaving: boolean;
  isMarking: boolean;
  onSave: (input: { term: PaymentTerm; fixedAmount: number }) => Promise<void>;
  onMarkPaid: (charge: ChargeWithPaid) => Promise<void>;
  onPartialPaid: (charge: ChargeWithPaid) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const amount = Number(term.fixed_amount ?? charge?.amount_due ?? 0);
  const Icon = term.payment_type === 'gas' ? Flame : ReceiptText;
  const paidAmount = Number(charge?.paid_amount ?? 0);

  return (
    <div className="flex flex-col self-start rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h4 className="font-display text-lg leading-tight">{term.label}</h4>
            <p className="text-xs text-muted-foreground">{dueDateLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PaymentBadge charge={charge} />
          <Button type="button" size="sm" variant="outline" className="rounded-full bg-muted" onClick={onEdit} aria-label={`הגדרות ${term.label}`}>
            <Settings className="h-4 w-4" />
            הגדרות
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} aria-label={`מחק ${term.label}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted p-3">
        <p className="text-xs text-muted-foreground">סכום החיוב</p>
        <p className="nums mt-1 text-3xl font-semibold text-foreground">₪{amount.toLocaleString()}</p>
        {charge ? (
          <>
            <p className="nums mt-2 text-xs text-muted-foreground">שולם ₪{shownPaid(paidAmount, Number(charge.amount_due)).toLocaleString()} מתוך ₪{Number(charge.amount_due).toLocaleString()}</p>
            <PaidMeter paid={paidAmount} due={Number(charge.amount_due)} />
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">עדיין לא נוצר חיוב למועד הזה</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!charge ? (
          <Button size="sm" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={isSaving || amount <= 0} onClick={() => { void onSave({ term, fixedAmount: amount }).catch(() => undefined); }}>
            <Plus className="h-4 w-4" />
            {isSaving ? 'שומר...' : 'צור חיוב'}
          </Button>
        ) : (
          <>
            <Button size="sm" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={paymentState(charge) === 'paid' || isMarking} onClick={() => { void onMarkPaid(charge).catch(() => undefined); }}>
              <CheckCircle className="h-4 w-4" />
              {isMarking ? 'שומר...' : 'סמן כשולם'}
            </Button>
            <Button size="sm" variant="outline" className="h-11 flex-1 rounded-full sm:h-9 sm:flex-none" disabled={isMarking} onClick={() => onPartialPaid(charge)}>
              תשלום חלקי
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function UtilitySettingsDialog({
  open,
  term,
  paymentType,
  startOptions,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  term: PaymentTerm | null;
  paymentType: UtilityPaymentType;
  startOptions: Array<{ sequenceNo: number; label: string }>;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    term: PaymentTerm | null;
    calculationType: 'fixed' | 'meter';
    fixedAmount?: number;
    unitRate?: number;
    frequencyMonths: 1 | 2;
    startsOnSequence: number;
  }) => Promise<void>;
}) {
  const [calculationType, setCalculationType] = useState<'fixed' | 'meter'>('meter');
  const [fixedAmount, setFixedAmount] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [frequencyMonths, setFrequencyMonths] = useState<1 | 2>(2);
  const [startsOnSequence, setStartsOnSequence] = useState('1');

  useEffect(() => {
    if (!open) return;
    setCalculationType(term?.calculation_type === 'fixed' ? 'fixed' : 'meter');
    setFixedAmount(String(Number(term?.fixed_amount ?? 0) || ''));
    setUnitRate(String(Number(term?.unit_rate ?? 0) || ''));
    setFrequencyMonths(term?.frequency_months === 1 ? 1 : 2);
    setStartsOnSequence(String(term?.starts_on_sequence ?? startOptions[0]?.sequenceNo ?? 1));
  }, [open, startOptions, term]);

  const title = paymentType === 'electricity' ? 'חשמל' : 'מים';
  const fieldId = term?.id ?? paymentType;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="rounded-[2rem] text-right [&>button]:left-4 [&>button]:right-auto">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>עריכת הגדרת {title}</AlertDialogTitle>
          <AlertDialogDescription>
            כאן משנים תדירות, התחלה וסוג חישוב. קריאת מונה עצמה נשארת בכרטיס.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-background p-1" role="group" aria-label={`שיטת חישוב ${title}`}>
            <button
              type="button"
              aria-pressed={calculationType === 'meter'}
              onClick={() => setCalculationType('meter')}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${calculationType === 'meter' ? 'bg-foreground text-background' : 'hover:bg-card'}`}
            >
              לפי מונה
            </button>
            <button
              type="button"
              aria-pressed={calculationType === 'fixed'}
              onClick={() => setCalculationType('fixed')}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${calculationType === 'fixed' ? 'bg-foreground text-background' : 'hover:bg-card'}`}
            >
              מחיר קבוע
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`utility-frequency-${fieldId}`}>תדירות</Label>
              <Select value={String(frequencyMonths)} onValueChange={(value) => setFrequencyMonths(Number(value) as 1 | 2)}>
                <SelectTrigger id={`utility-frequency-${fieldId}`} className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">פעם בחודש</SelectItem>
                  <SelectItem value="2">פעם בחודשיים</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`utility-start-${fieldId}`}>מתחיל מ־</Label>
              <Select value={startsOnSequence} onValueChange={setStartsOnSequence}>
                <SelectTrigger id={`utility-start-${fieldId}`} className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {startOptions.map((option) => (
                    <SelectItem key={option.sequenceNo} value={String(option.sequenceNo)}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {calculationType === 'fixed' ? (
            <div className="space-y-2">
              <Label htmlFor={`utility-fixed-${fieldId}`}>מחיר קבוע</Label>
              <Input id={`utility-fixed-${fieldId}`} type="number" min="0.01" step="0.01" value={fixedAmount} onChange={(event) => setFixedAmount(event.target.value)} className="h-11 rounded-xl nums" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`utility-rate-${fieldId}`}>מחיר ליחידה</Label>
              <Input id={`utility-rate-${fieldId}`} type="number" min="0.0001" step="0.0001" value={unitRate} onChange={(event) => setUnitRate(event.target.value)} className="h-11 rounded-xl nums" />
            </div>
          )}
        </div>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel className="rounded-full" disabled={isSaving}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-full"
            disabled={isSaving || (calculationType === 'fixed' ? Number(fixedAmount) <= 0 : Number(unitRate) <= 0)}
            onClick={(event) => {
              event.preventDefault();
              void onSave({
                term,
                calculationType,
                fixedAmount: Number(fixedAmount),
                unitRate: Number(unitRate),
                frequencyMonths,
                startsOnSequence: Number(startsOnSequence),
              }).catch(() => undefined);
            }}
          >
            {isSaving ? 'שומר...' : 'שמור הגדרה'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
