import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ChargeWithPaid } from '@/api/billing';
import type { TenancyWithNames } from '@/api/tenancies';
import { formatBillingDate } from '@/utils/billingSchedule';

interface PaymentHistoryDialogProps {
  open: boolean;
  charges: ChargeWithPaid[];
  tenancies: TenancyWithNames[];
  onOpenChange: (open: boolean) => void;
  onEditCharge: (tenancy: TenancyWithNames, charge: ChargeWithPaid) => void;
}

const remaining = (charge: ChargeWithPaid) => Math.max(Number(charge.amount_due) - Number(charge.paid_amount), 0);

const stateLabel = (charge: ChargeWithPaid) => {
  if (remaining(charge) === 0) return 'שולם';
  if (Number(charge.paid_amount) > 0) return 'חלקי';
  return 'פתוח';
};

export function PaymentHistoryDialog({
  open,
  charges,
  tenancies,
  onOpenChange,
  onEditCharge,
}: PaymentHistoryDialogProps) {
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const tenancyById = useMemo(
    () => new Map(tenancies.map((tenancy) => [tenancy.id, tenancy])),
    [tenancies],
  );
  const dueCharges = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return charges
      .filter((charge) => charge.due_date <= today)
      .filter((charge) => !showOpenOnly || remaining(charge) > 0)
      .sort((a, b) => b.due_date.localeCompare(a.due_date));
  }, [charges, showOpenOnly]);

  const totals = dueCharges.reduce((acc, charge) => ({
    due: acc.due + Number(charge.amount_due),
    paid: acc.paid + Number(charge.paid_amount),
    open: acc.open + remaining(charge),
  }), { due: 0, paid: 0, open: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[86vh] max-w-4xl overflow-hidden rounded-[2rem] border-0 bg-card p-0 text-right shadow-2xl [&>button]:left-5 [&>button]:right-auto"
      >
        <div className="rounded-t-[2rem] bg-secondary/45 px-6 pb-5 pt-6">
          <DialogHeader className="text-right sm:text-right">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
              <History className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl">היסטוריית תשלומים</DialogTitle>
            <DialogDescription className="text-foreground/65">
              כל החיובים שכבר הגיע זמנם, כולל חובות שנשארו מחודשים קודמים.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-background p-2 text-center">
            <div className="px-3 py-2"><p className="text-xs text-muted-foreground">לחיוב</p><p className="nums font-bold">₪{totals.due.toLocaleString()}</p></div>
            <div className="px-3 py-2"><p className="text-xs text-muted-foreground">שולם</p><p className="nums font-bold">₪{totals.paid.toLocaleString()}</p></div>
            <div className="px-3 py-2"><p className="text-xs text-muted-foreground">נשאר</p><p className="nums font-bold">₪{totals.open.toLocaleString()}</p></div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant={showOpenOnly ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setShowOpenOnly((value) => !value)}
            >
              {showOpenOnly ? 'מציג פתוחים' : 'הצג רק פתוחים'}
            </Button>
          </div>

          <div className="space-y-2">
            {dueCharges.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">אין חיובים להצגה.</p>
            ) : dueCharges.map((charge) => {
              const tenancy = tenancyById.get(charge.tenancy_id);
              return (
                <div key={charge.id} className="grid gap-3 rounded-2xl border bg-background/70 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{charge.label}</p>
                      <Badge variant={remaining(charge) === 0 ? 'default' : Number(charge.paid_amount) > 0 ? 'secondary' : 'destructive'}>
                        {stateLabel(charge)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tenancy ? `${tenancy.unit_name} · ${tenancy.tenant_name}` : 'שכירות שהסתיימה'} · {formatBillingDate(charge.due_date)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <p className="nums text-sm">
                      ₪{Number(charge.paid_amount).toLocaleString()} מתוך ₪{Number(charge.amount_due).toLocaleString()}
                    </p>
                    {tenancy && (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => onEditCharge(tenancy, charge)}>
                        ערוך
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
