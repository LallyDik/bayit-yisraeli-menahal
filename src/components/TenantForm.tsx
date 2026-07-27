import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import type { Tenant, Unit } from '@/types';
import { localDateISO } from '@/utils/date';
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from '@/utils/payment';

// Sentinel for "no unit" - Radix Select rejects an empty-string item value,
// and we need an explicit, selectable option for "this tenant has no unit"
// (not just an unset/placeholder state).
const NO_UNIT = 'none';
// Same idea, for "payment method not specified".
const NO_METHOD = 'none';
interface TenantFormProps {
  onSubmit: (values: {
    name: string;
    phone: string | null;
    email: string | null;
    description: string | null;
    notes: string | null;
    unit_id: string | null;
    monthly_rent: number | null;
    start_date: string;
    payment_method: PaymentMethod | null;
  }) => void | Promise<void>;
  units: Unit[];
  // Units with a live tenancy right now (any tenant, not just this one) -
  // used to keep two tenants from being offered the same unit in the Select.
  occupiedUnitIds: Set<string>;
  initialData?: Partial<Tenant> & { unit_id?: string | null; monthly_rent?: number | null; start_date?: string; payment_method?: PaymentMethod | null };
  submitLabel?: string;
  isSubmitting?: boolean;
}

export const TenantForm: React.FC<TenantFormProps> = ({
  onSubmit,
  units,
  occupiedUnitIds,
  initialData = {},
  submitLabel = 'הוסף שוכר',
  isSubmitting = false,
}) => {
  const [name, setName] = useState(initialData.name ?? '');
  const [phone, setPhone] = useState(initialData.phone ?? '');
  const [email, setEmail] = useState(initialData.email ?? '');
  const [description, setDescription] = useState(initialData.description ?? '');
  const [notes, setNotes] = useState(initialData.notes ?? '');
  const [unitId, setUnitId] = useState(initialData.unit_id ?? NO_UNIT);
  const [rent, setRent] = useState(
    initialData.monthly_rent != null ? String(initialData.monthly_rent) : '',
  );
  const [startDate, setStartDate] = useState(initialData.start_date ?? localDateISO());
  const [paymentMethod, setPaymentMethod] = useState<string>(initialData.payment_method ?? NO_METHOD);
  const [error, setError] = useState<string | null>(null);

  // Free units, plus (when editing) this tenant's own currently-assigned
  // unit - so re-saving an unrelated field doesn't force them to move out.
  const availableUnits = units.filter(
    (u) => !occupiedUnitIds.has(u.id) || u.id === initialData.unit_id,
  );

  const handleUnitChange = (id: string) => {
    setUnitId(id);
    setError(null);
    if (id === NO_UNIT) return;
    // Prefill from the unit's template. This is a starting value, not a
    // binding one - see the helper text below the rent field.
    const unit = units.find((u) => u.id === id);
    if (unit?.default_rent != null && rent === '') setRent(String(unit.default_rent));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('יש להזין את שם השוכר.');
      return;
    }
    const hasUnit = unitId !== NO_UNIT;
    if (hasUnit && rent === '') {
      setError('יש להזין את שכר הדירה שסוכם, גם אם הסכום הוא 0.');
      return;
    }
    if (hasUnit && !startDate) {
      setError('יש לבחור תאריך כניסה ליחידה.');
      return;
    }
    // A date field accepts a four-digit year, so a slip on the keyboard can save
    // something like the year 0485 - which then drives the whole billing schedule.
    if (hasUnit && startDate) {
      const year = Number(startDate.slice(0, 4));
      if (!Number.isFinite(year) || year < 1990 || year > 2100) {
        setError('תאריך הכניסה אינו נראה תקין. יש לבחור תאריך אמיתי.');
        return;
      }
    }
    setError(null);
    onSubmit({
      name: name.trim(),
      phone: phone.trim() === '' ? null : phone.trim(),
      email: email.trim() === '' ? null : email.trim(),
      description: description.trim() === '' ? null : description.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
      unit_id: hasUnit ? unitId : null,
      monthly_rent: hasUnit ? (rent === '' ? 0 : Number(rent)) : null,
      start_date: startDate,
      payment_method: hasUnit && paymentMethod !== NO_METHOD ? (paymentMethod as PaymentMethod) : null,
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="bg-primary/20 text-foreground border-b-[3px] border-primary">
        <CardTitle className="flex items-center gap-2 text-xl font-display">
          <Plus className="w-6 h-6" />
          {submitLabel}
        </CardTitle>
        <CardDescription className="text-foreground/70">שומרים פרטי קשר ומשייכים ליחידה עכשיו או בהמשך.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tenant-name" className="text-lg font-medium">שם השוכר <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="tenant-name" value={name} required autoFocus autoComplete="name" className="text-lg p-3"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              זה כל מה שצריך כדי להוסיף שוכר. אפשר לשייך אותו ליחידה עכשיו או מאוחר יותר.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-unit" className="text-lg font-medium">יחידה</Label>
            <Select value={unitId} onValueChange={handleUnitChange}>
              <SelectTrigger id="tenant-unit" className="text-lg p-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_UNIT}>ללא יחידה</SelectItem>
                {availableUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {unitId !== NO_UNIT && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tenant-rent" className="text-lg font-medium">שכר דירה חודשי (₪)</Label>
                  <Input
                    id="tenant-rent" type="number" min="0" value={rent} className="text-lg p-3 ltr"
                    required
                    onChange={(e) => setRent(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    מולא מברירת המחדל של היחידה. אפשר לשנות.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-start-date" className="text-lg font-medium">תאריך כניסה</Label>
                  <Input
                    id="tenant-start-date"
                    type="date"
                    value={startDate}
                    className="text-lg p-3 ltr"
                    required
                    min="1990-01-01"
                    max="2100-12-31"
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    תאריך התשלום מוגדר בנפרד במסך התשלומים.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant-payment-method" className="text-base font-medium">אופן תשלום - אופציונלי</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="tenant-payment-method" className="text-lg p-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_METHOD}>לא צוין</SelectItem>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">קובע את הניסוח של כפתור „סמן כשולם”.</p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="tenant-phone" className="text-base font-medium">טלפון - אופציונלי</Label>
            <Input
              id="tenant-phone" type="tel" value={phone} autoComplete="tel" className="text-lg p-3 ltr"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-email" className="text-base font-medium">מייל - אופציונלי</Label>
            <Input
              id="tenant-email" type="email" value={email} autoComplete="email" className="text-lg p-3 ltr"
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">יידרש בהמשך לתזכורות תשלום.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-description" className="text-base font-medium">תיאור - אופציונלי</Label>
            <Textarea
              id="tenant-description" value={description} className="text-right"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-notes" className="text-base font-medium">הערות - אופציונלי</Label>
            <Textarea
              id="tenant-notes" value={notes} className="text-right"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {initialData.id && <AttachmentsSection tenantId={initialData.id} />}

          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full text-lg py-3" disabled={isSubmitting || !name.trim()} aria-busy={isSubmitting}>
            {isSubmitting ? 'שומר...' : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
