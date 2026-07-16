import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle, PencilLine } from 'lucide-react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TenancyWithNames } from '@/api/tenancies';
import type { ChargeWithPaid } from '@/api/billing';
import {
  HEBREW_DAY_LABELS,
  formatBillingDate,
  hebrewDateParts,
  hebrewDateToISO,
  hebrewYearLabel,
  listHebrewMonthsForYear,
  type BillingCalendar,
} from '@/utils/billingSchedule';
import { localDateISO } from '@/utils/date';

interface PaymentEditorDialogProps {
  open: boolean;
  tenancy: TenancyWithNames | null;
  charge: ChargeWithPaid | null;
  // Follows the tenancy's billing calendar so the date is shown and picked the
  // same way rent is: Hebrew tenancy → Hebrew date, Gregorian → Gregorian.
  calendar?: BillingCalendar;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    tenancy: TenancyWithNames;
    amountDue: number;
    paidAmount: number;
    paidAt: string;
  }) => Promise<void>;
}

export function PaymentEditorDialog({
  open,
  tenancy,
  charge,
  calendar = 'gregorian',
  isSaving,
  onOpenChange,
  onSave,
}: PaymentEditorDialogProps) {
  const [amountDue, setAmountDue] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paidAt, setPaidAt] = useState(localDateISO());
  const [hebrewDay, setHebrewDay] = useState('1');
  const [hebrewMonth, setHebrewMonth] = useState('');
  const [hebrewYear, setHebrewYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !tenancy) return;
    const initial = localDateISO();
    const parts = hebrewDateParts(initial);
    setAmountDue(String(Number(charge?.amount_due ?? tenancy.monthly_rent ?? 0)));
    setPaidAmount(String(Number(charge?.paid_amount ?? 0)));
    setPaidAt(initial);
    setHebrewDay(String(parts.day));
    setHebrewMonth(parts.monthKey);
    setHebrewYear(String(parts.year));
    setError(null);
  }, [charge, open, tenancy]);

  const hebrewMonths = useMemo(() => (
    listHebrewMonthsForYear(Number(hebrewYear || hebrewDateParts(paidAt).year))
  ), [hebrewYear, paidAt]);

  const hebrewYearOptions = useMemo(() => {
    const currentYear = hebrewDateParts(localDateISO()).year;
    const selectedYear = Number(hebrewYear || currentYear);
    const years = new Set<number>();
    for (let year = currentYear - 1; year <= currentYear + 6; year += 1) years.add(year);
    years.add(selectedYear);
    return Array.from(years).sort((a, b) => a - b);
  }, [hebrewYear]);

  const updateHebrewDate = (patch: { day?: string; monthKey?: string; year?: string }) => {
    const year = Number(patch.year ?? hebrewYear);
    const months = listHebrewMonthsForYear(year);
    const monthKey = patch.monthKey ?? (months.some((month) => month.key === hebrewMonth) ? hebrewMonth : months[0]?.key ?? '');
    const day = Number(patch.day ?? hebrewDay);
    if (!year || !monthKey || !day) return;
    const nextISO = hebrewDateToISO({ year, monthKey, day });
    setHebrewYear(String(year));
    setHebrewMonth(monthKey);
    setHebrewDay(String(day));
    setPaidAt(nextISO);
  };

  if (!tenancy) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const due = Number(amountDue);
    const paid = Number(paidAmount);

    if (!Number.isFinite(due) || due < 0 || !Number.isFinite(paid) || paid < 0) {
      setError('יש להזין סכומים תקינים שאינם שליליים.');
      return;
    }
    if (paid > due) {
      setError('הסכום ששולם לא יכול להיות גבוה מסכום החיוב.');
      return;
    }
    if (!paidAt) {
      setError('יש לבחור תאריך תשלום.');
      return;
    }

    setError(null);
    try {
      await onSave({ tenancy, amountDue: due, paidAmount: paid, paidAt });
      onOpenChange(false);
    } catch {
      // The hook shows the server error and keeps the dialog open for correction.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-md rounded-[2rem] border-0 bg-card p-0 text-right shadow-2xl [&>button]:left-5 [&>button]:right-auto"
      >
        <div className="rounded-t-[2rem] bg-primary/20 px-6 pb-5 pt-6">
          <DialogHeader className="text-right sm:text-right">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/30">
              <PencilLine className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl">עדכון תשלום</DialogTitle>
            <DialogDescription className="text-foreground/65">
              {charge?.label ?? 'שכר דירה'} · {tenancy.tenant_name} · {tenancy.unit_name}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 pb-6">
          <p className="text-sm leading-6 text-muted-foreground">
            כאן רושמים תשלום מלא או חלקי. סכום החיוב נקבע בהגדרות, ו„שולם” הוא הסכום המצטבר לחודש הזה.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>סכום החיוב</Label>
              <div className="flex h-12 items-center justify-between rounded-xl bg-muted/45 px-4 nums" dir="ltr">
                <span className="text-muted-foreground">₪</span>
                <span className="text-lg font-semibold">{Number(amountDue).toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">הסכום נקבע בהגדרות התשלום</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-paid-amount">שולם עד עכשיו</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">₪</span>
                <Input
                  id="payment-paid-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  className="h-12 rounded-xl pe-8 nums"
                  dir="ltr"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-paid-at">תאריך התשלום</Label>
            {calendar === 'hebrew' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={hebrewDay} onValueChange={(value) => updateHebrewDate({ day: value })}>
                    <SelectTrigger className="h-12 rounded-xl" aria-label="יום התשלום העברי"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HEBREW_DAY_LABELS.map((label, index) => (
                        <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={hebrewMonth} onValueChange={(value) => updateHebrewDate({ monthKey: value })}>
                    <SelectTrigger className="h-12 rounded-xl" aria-label="חודש התשלום העברי"><SelectValue placeholder="חודש" /></SelectTrigger>
                    <SelectContent>
                      {hebrewMonths.map((month) => (
                        <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={hebrewYear} onValueChange={(value) => updateHebrewDate({ year: value })}>
                    <SelectTrigger className="h-12 rounded-xl" aria-label="שנת התשלום העברית"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {hebrewYearOptions.map((year) => (
                        <SelectItem key={year} value={String(year)}>{hebrewYearLabel(year)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {paidAt && <p className="text-xs text-muted-foreground">לועזי: {formatBillingDate(paidAt)}</p>}
              </>
            ) : (
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input
                  id="payment-paid-at"
                  type="date"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  className="h-12 rounded-xl pe-10 nums"
                  dir="rtl"
                  required
                />
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="h-11 flex-1 rounded-full" disabled={isSaving}>
              <CheckCircle className="h-4 w-4" />
              {isSaving ? 'שומר...' : 'שמור תשלום'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
