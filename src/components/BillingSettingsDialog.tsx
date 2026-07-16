import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
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
import type { BillingSettings } from '@/types';
import {
  HEBREW_DAY_LABELS,
  formatBillingDate,
  formatBillingShortDate,
  generateBillingSchedule,
  hebrewDateParts,
  hebrewDateToISO,
  hebrewYearLabel,
  listHebrewMonthsForYear,
  type BillingCalendar,
} from '@/utils/billingSchedule';
import { localDateISO } from '@/utils/date';

interface BillingSettingsDialogProps {
  open: boolean;
  tenancy: TenancyWithNames | null;
  settings?: BillingSettings;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    tenancy: TenancyWithNames;
    calendar: BillingCalendar;
    dueDay: number;
    startDate: string;
  }) => Promise<void>;
}

export function BillingSettingsDialog({
  open,
  tenancy,
  settings,
  isSaving,
  onOpenChange,
  onSave,
}: BillingSettingsDialogProps) {
  const [calendar, setCalendar] = useState<BillingCalendar>('gregorian');
  const [dueDay, setDueDay] = useState('1');
  const [startDate, setStartDate] = useState(localDateISO());
  const [hebrewStartDay, setHebrewStartDay] = useState('1');
  const [hebrewStartMonth, setHebrewStartMonth] = useState('');
  const [hebrewStartYear, setHebrewStartYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !tenancy) return;
    const today = localDateISO();
    const nextStartDate = settings?.schedule_start_date ?? (tenancy.start_date > today ? tenancy.start_date : today);
    const hebrewStart = hebrewDateParts(nextStartDate);
    setCalendar((settings?.calendar_type as BillingCalendar | undefined) ?? 'gregorian');
    setDueDay(String(settings?.due_day ?? 1));
    setStartDate(nextStartDate);
    setHebrewStartDay(String(hebrewStart.day));
    setHebrewStartMonth(hebrewStart.monthKey);
    setHebrewStartYear(String(hebrewStart.year));
    setError(null);
  }, [open, settings, tenancy]);

  const hebrewStartMonths = useMemo(() => (
    listHebrewMonthsForYear(Number(hebrewStartYear || hebrewDateParts(startDate).year))
  ), [hebrewStartYear, startDate]);

  const hebrewStartYearOptions = useMemo(() => {
    const currentYear = hebrewDateParts(localDateISO()).year;
    const selectedYear = Number(hebrewStartYear || currentYear);
    const years = new Set<number>();
    for (let year = currentYear - 1; year <= currentYear + 6; year += 1) years.add(year);
    years.add(selectedYear);
    return Array.from(years).sort((a, b) => a - b);
  }, [hebrewStartYear]);

  const updateHebrewStart = (patch: { day?: string; monthKey?: string; year?: string }) => {
    const year = Number(patch.year ?? hebrewStartYear);
    const months = listHebrewMonthsForYear(year);
    const monthKey = patch.monthKey ?? (months.some((month) => month.key === hebrewStartMonth) ? hebrewStartMonth : months[0]?.key ?? '');
    const day = Number(patch.day ?? hebrewStartDay);
    if (!year || !monthKey || !day) return;
    const nextStartDate = hebrewDateToISO({ year, monthKey, day });
    setHebrewStartYear(String(year));
    setHebrewStartMonth(monthKey);
    setHebrewStartDay(String(day));
    setStartDate(nextStartDate);
  };

  const handleCalendarChange = (value: BillingCalendar) => {
    setCalendar(value);
    if (value !== 'hebrew') return;
    const hebrewStart = hebrewDateParts(startDate);
    setHebrewStartDay(String(hebrewStart.day));
    setHebrewStartMonth(hebrewStart.monthKey);
    setHebrewStartYear(String(hebrewStart.year));
  };

  const preview = useMemo(() => {
    try {
      const next = generateBillingSchedule({
        calendar,
        dueDay: Number(dueDay),
        startDate,
        count: 3,
      });
      return next.map((item) => (
        calendar === 'hebrew'
          ? `${formatBillingShortDate(item.due_date, 'hebrew')} (${formatBillingDate(item.due_date)})`
          : formatBillingDate(item.due_date)
      ));
    } catch {
      return [];
    }
  }, [calendar, dueDay, startDate]);

  if (!tenancy) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const day = Number(dueDay);
    const maxDay = calendar === 'hebrew' ? 30 : 31;
    if (!Number.isInteger(day) || day < 1 || day > maxDay) {
      setError(`יום התשלום חייב להיות בין 1 ל-${maxDay}.`);
      return;
    }
    setError(null);
    try {
      await onSave({ tenancy, calendar, dueDay: day, startDate });
      onOpenChange(false);
    } catch {
      // The hook displays the server message.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-lg rounded-[2rem] border-0 bg-card p-0 text-right shadow-2xl [&>button]:left-5 [&>button]:right-auto"
      >
        <div className="rounded-t-[2rem] bg-primary/20 px-6 pb-5 pt-6">
          <DialogHeader className="text-right sm:text-right">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
              <CalendarClock className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl">מועד תשלום</DialogTitle>
            <DialogDescription className="text-foreground/65">
              {tenancy.unit_name} · {tenancy.tenant_name}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing-calendar">לוח</Label>
              <Select value={calendar} onValueChange={(value) => handleCalendarChange(value as BillingCalendar)}>
                <SelectTrigger id="billing-calendar" className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gregorian">לועזי</SelectItem>
                  <SelectItem value="hebrew">עברי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-day">יום בחודש</Label>
              {calendar === 'hebrew' ? (
                <Select value={dueDay} onValueChange={setDueDay}>
                  <SelectTrigger id="billing-day" className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEBREW_DAY_LABELS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="billing-day"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  className="h-12 rounded-xl nums"
                />
              )}
            </div>
          </div>

          {calendar === 'hebrew' ? (
            <div className="space-y-2">
              <Label>מתאריך עברי</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={hebrewStartDay} onValueChange={(value) => updateHebrewStart({ day: value })}>
                  <SelectTrigger className="h-12 rounded-xl" aria-label="יום ההתחלה העברי"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HEBREW_DAY_LABELS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={hebrewStartMonth} onValueChange={(value) => updateHebrewStart({ monthKey: value })}>
                  <SelectTrigger className="h-12 rounded-xl" aria-label="חודש ההתחלה העברי"><SelectValue placeholder="חודש" /></SelectTrigger>
                  <SelectContent>
                    {hebrewStartMonths.map((month) => (
                      <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={hebrewStartYear} onValueChange={(value) => updateHebrewStart({ year: value })}>
                  <SelectTrigger className="h-12 rounded-xl" aria-label="שנת ההתחלה העברית"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hebrewStartYearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>{hebrewYearLabel(year)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">לועזי: {formatBillingDate(startDate)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="billing-start">מתאריך</Label>
              <Input
                id="billing-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-12 rounded-xl nums"
              />
            </div>
          )}

          {preview.length > 0 && (
            <div className="rounded-2xl bg-background p-4 text-sm">
              <p className="mb-2 font-semibold">התשלומים הקרובים</p>
              <div className="space-y-1 text-muted-foreground">
                {preview.map((item) => <p key={item}>{item}</p>)}
              </div>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="h-11 flex-1 rounded-full" disabled={isSaving}>
              {isSaving ? 'שומר...' : 'שמור מועד'}
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
