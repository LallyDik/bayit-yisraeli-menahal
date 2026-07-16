import { type FormEvent, useEffect, useState } from 'react';
import { Calculator, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenancyWithNames } from '@/api/tenancies';
import type { AdditionalPaymentType } from '@/api/billing';
import type { PaymentTerm } from '@/types';

interface StartOption {
  sequenceNo: number;
  label: string;
}

interface AddAdditionalPaymentDialogProps {
  open: boolean;
  tenancy: TenancyWithNames | null;
  initialTerm?: PaymentTerm | null;
  startOptions: StartOption[];
  defaultStartSequence?: number;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    tenancy: TenancyWithNames;
    term?: PaymentTerm;
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
}

export function AddAdditionalPaymentDialog({
  open,
  tenancy,
  initialTerm,
  startOptions,
  defaultStartSequence,
  isSaving,
  onOpenChange,
  onSave,
}: AddAdditionalPaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<AdditionalPaymentType>('committee');
  const [label, setLabel] = useState('ועד בית');
  const [calculationType, setCalculationType] = useState<'fixed' | 'meter'>('fixed');
  const [amount, setAmount] = useState('');
  const [previousReading, setPreviousReading] = useState('');
  const [currentReading, setCurrentReading] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [frequency, setFrequency] = useState<1 | 2>(1);
  const [startsOnSequence, setStartsOnSequence] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(initialTerm);

  useEffect(() => {
    if (!open) return;
    setPaymentType((initialTerm?.payment_type as AdditionalPaymentType | undefined) ?? 'committee');
    setLabel(initialTerm?.label ?? 'ועד בית');
    setCalculationType(initialTerm?.calculation_type === 'meter' ? 'meter' : 'fixed');
    setAmount(String(Number(initialTerm?.fixed_amount ?? 0) || ''));
    setPreviousReading('');
    setCurrentReading('');
    setUnitRate(String(Number(initialTerm?.unit_rate ?? 0) || ''));
    setFrequency(initialTerm?.frequency_months === 2 ? 2 : 1);
    setStartsOnSequence(String(initialTerm?.starts_on_sequence ?? defaultStartSequence ?? startOptions[0]?.sequenceNo ?? 1));
    setError(null);
  }, [defaultStartSequence, initialTerm, open, startOptions]);

  if (!tenancy) return null;

  const handleTypeChange = (value: AdditionalPaymentType) => {
    setPaymentType(value);
    if (value === 'gas') setLabel('גז');
    else if (value === 'committee') setLabel('ועד בית');
    else setLabel('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const fixedAmount = Number(amount);
    if (!label.trim()) {
      setError('יש לתת שם לתשלום.');
      return;
    }
    if (calculationType === 'fixed' && (!Number.isFinite(fixedAmount) || fixedAmount <= 0)) {
      setError('יש להזין מחיר קבוע גדול מ־0.');
      return;
    }
    const previous = Number(previousReading);
    const current = Number(currentReading);
    const rate = Number(unitRate);
    if (!isEditing && calculationType === 'meter' && (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0 || current <= 0)) {
      setError('יש להזין מונה אחרון ומונה נוכחי גדולים מ־0.');
      return;
    }
    if (!isEditing && calculationType === 'meter' && current < previous) {
      setError('המונה הנוכחי חייב להיות שווה למונה האחרון או גבוה ממנו.');
      return;
    }
    if (calculationType === 'meter' && (!Number.isFinite(rate) || rate <= 0)) {
      setError('יש להזין מחיר תקין ליחידה.');
      return;
    }

    setError(null);
    try {
      await onSave({
        tenancy,
        term: initialTerm ?? undefined,
        paymentType,
        label: label.trim(),
        calculationType,
        fixedAmount: calculationType === 'fixed' ? fixedAmount : undefined,
        previousReading: !isEditing && calculationType === 'meter' ? previous : undefined,
        currentReading: !isEditing && calculationType === 'meter' ? current : undefined,
        unitRate: calculationType === 'meter' ? rate : undefined,
        frequencyMonths: frequency,
        startsOnSequence: Number(startsOnSequence),
      });
      onOpenChange(false);
    } catch {
      // The billing hook displays the server message.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-md rounded-[2rem] border-0 bg-card p-0 text-right shadow-2xl [&>button]:left-5 [&>button]:right-auto"
      >
        <div className="rounded-t-[2rem] bg-secondary/55 px-6 pb-5 pt-6">
          <DialogHeader className="text-right sm:text-right">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/65">
              <PlusCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl">{isEditing ? 'עריכת תשלום' : 'הוספת תשלום'}</DialogTitle>
            <DialogDescription className="text-foreground/65">
              {tenancy.unit_name} — {tenancy.tenant_name}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="additional-type">סוג התשלום</Label>
            <select
              id="additional-type"
              value={paymentType}
              onChange={(event) => handleTypeChange(event.target.value as AdditionalPaymentType)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="committee">ועד בית</option>
              <option value="gas">גז</option>
              <option value="custom">אחר</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional-label">שם התשלום</Label>
            <Input
              id="additional-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="למשל: ניקיון חדר מדרגות"
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-background p-1" role="group" aria-label="שיטת חישוב">
            <button
              type="button"
              aria-pressed={calculationType === 'fixed'}
              onClick={() => setCalculationType('fixed')}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${calculationType === 'fixed' ? 'bg-foreground text-background' : 'hover:bg-card'}`}
            >
              מחיר קבוע
            </button>
            <button
              type="button"
              aria-pressed={calculationType === 'meter'}
              onClick={() => setCalculationType('meter')}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${calculationType === 'meter' ? 'bg-foreground text-background' : 'hover:bg-card'}`}
            >
              לפי מונה
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {calculationType === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="additional-amount">מחיר קבוע</Label>
                <Input
                  id="additional-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-12 rounded-xl nums"
                  placeholder="₪"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="additional-unit-rate">מחיר ליחידה</Label>
                <Input
                  id="additional-unit-rate"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={unitRate}
                  onChange={(event) => setUnitRate(event.target.value)}
                  className="h-12 rounded-xl nums"
                  placeholder="₪"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="additional-frequency">תדירות</Label>
              <select
                id="additional-frequency"
                value={frequency}
                onChange={(event) => setFrequency(Number(event.target.value) as 1 | 2)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={1}>פעם בחודש</option>
                <option value={2}>פעם בחודשיים</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="additional-start">מתחיל מ־</Label>
              <select
                id="additional-start"
                value={startsOnSequence}
                onChange={(event) => setStartsOnSequence(event.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {startOptions.map((option) => (
                  <option key={option.sequenceNo} value={option.sequenceNo}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {calculationType === 'meter' && !isEditing && (
            <div className="grid grid-cols-1 gap-4 rounded-2xl bg-primary/10 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="additional-previous-reading">מונה אחרון</Label>
                <Input
                  id="additional-previous-reading"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={previousReading}
                  onChange={(event) => setPreviousReading(event.target.value)}
                  className="h-12 rounded-xl bg-white/75 nums"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="additional-current-reading">מונה נוכחי</Label>
                <Input
                  id="additional-current-reading"
                  type="number"
                  min={previousReading || '0.01'}
                  step="0.01"
                  value={currentReading}
                  onChange={(event) => setCurrentReading(event.target.value)}
                  className="h-12 rounded-xl bg-white/75 nums"
                  required
                />
              </div>
              <p className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <Calculator className="h-4 w-4" />
                לתשלום: ₪{Math.max((Number(currentReading || 0) - Number(previousReading || 0)) * Number(unitRate || 0), 0).toLocaleString()}
              </p>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="h-11 flex-1 rounded-full" disabled={isSaving}>
              {isSaving ? 'שומר...' : isEditing ? 'שמור שינויים' : 'הוסף תשלום'}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => onOpenChange(false)} disabled={isSaving}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
