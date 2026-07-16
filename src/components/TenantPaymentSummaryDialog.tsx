import { useState } from 'react';
import { ArrowLeft, CheckCircle2, ReceiptText, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaymentEditorDialog } from '@/components/PaymentEditorDialog';
import type { ChargeWithPaid } from '@/api/billing';
import type { TenancyWithNames } from '@/api/tenancies';
import { formatBillingDate, type BillingCalendar } from '@/utils/billingSchedule';

interface TenantPaymentSummaryDialogProps {
  open: boolean;
  tenancy: TenancyWithNames | null;
  rentCharge: ChargeWithPaid | null;
  additionalCharges: ChargeWithPaid[];
  calendar?: BillingCalendar;
  pendingKeys: Set<string>;
  onOpenChange: (open: boolean) => void;
  onMarkRentPaid: (tenancy: TenancyWithNames) => Promise<void>;
  onSaveRentPayment: (input: {
    tenancy: TenancyWithNames;
    amountDue: number;
    paidAmount: number;
    paidAt: string;
  }) => Promise<void>;
  onMarkChargePaid: (charge: ChargeWithPaid) => Promise<void>;
  onSaveChargePayment: (input: {
    charge: ChargeWithPaid;
    amountDue: number;
    paidAmount: number;
    paidAt: string;
  }) => Promise<void>;
  onGoToDetails: (tenancyId: string) => void;
}

type EditingPayment = { kind: 'rent' } | { kind: 'charge'; charge: ChargeWithPaid };

const amount = (value: number) => `₪${value.toLocaleString()}`;

const chargeSeriesKey = (charge: ChargeWithPaid) => {
  const termMatch = charge.period_key.match(/^term:([^:]+):/);
  return termMatch ? `term:${termMatch[1]}` : `${charge.payment_type}:${charge.label.split(' — ')[0].trim()}`;
};

function PaymentStatus({ due, paid, billed = true }: { due: number; paid: number; billed?: boolean }) {
  if (!billed) return <Badge variant="outline" className="text-muted-foreground">טרם חויב</Badge>;
  if (paid >= due) return <Badge>שולם</Badge>;
  if (paid > 0) return <Badge variant="secondary">חלקי</Badge>;
  return <Badge variant="destructive">פתוח</Badge>;
}

export function TenantPaymentSummaryDialog({
  open,
  tenancy,
  rentCharge,
  additionalCharges,
  calendar = 'gregorian',
  pendingKeys,
  onOpenChange,
  onMarkRentPaid,
  onSaveRentPayment,
  onMarkChargePaid,
  onSaveChargePayment,
  onGoToDetails,
}: TenantPaymentSummaryDialogProps) {
  const [editingPayment, setEditingPayment] = useState<EditingPayment | null>(null);

  if (!tenancy) return null;

  const rentDue = Number(rentCharge?.amount_due ?? tenancy.monthly_rent ?? 0);
  const rentPaid = Number(rentCharge?.paid_amount ?? 0);
  const billedRentDue = rentCharge ? rentDue : 0;
  const additionalDue = additionalCharges.reduce((sum, charge) => sum + Number(charge.amount_due), 0);
  const additionalPaid = additionalCharges.reduce((sum, charge) => sum + Number(charge.paid_amount), 0);
  const totalDue = billedRentDue + additionalDue;
  const totalPaid = rentPaid + additionalPaid;
  const editingCharge = editingPayment?.kind === 'charge' ? editingPayment.charge : null;
  const editorPendingKey = editingCharge ? `charge:${editingCharge.id}` : tenancy.id;
  const latestChargeIdBySeries = new Map<string, string>();
  [...additionalCharges]
    .sort((first, second) => second.due_date.localeCompare(first.due_date))
    .forEach((charge) => {
      const key = chargeSeriesKey(charge);
      if (!latestChargeIdBySeries.has(key)) latestChargeIdBySeries.set(key, charge.id);
    });

  const closeSummary = (nextOpen: boolean) => {
    if (!nextOpen && editingPayment) return;
    onOpenChange(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeSummary}>
        <DialogContent dir="rtl" className="grid max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 text-right sm:rounded-[2rem]">
          <div className="border-b bg-secondary/35 px-5 pb-5 pt-6 sm:px-7">
            <DialogHeader className="items-start pe-8 text-right sm:text-right">
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/65" aria-hidden="true">
                <ReceiptText className="h-5 w-5" />
              </span>
              <DialogTitle className="font-display text-2xl">התשלומים של {tenancy.tenant_name}</DialogTitle>
              <DialogDescription>{tenancy.unit_name} · שכ״ד ותשלומים נוספים במקום אחד</DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-2 text-center">
              <div className="rounded-xl bg-background px-2 py-2.5"><p className="text-xs text-muted-foreground">לתשלום</p><p className="mt-1 font-bold nums">{amount(totalDue)}</p></div>
              <div className="rounded-xl bg-background px-2 py-2.5"><p className="text-xs text-muted-foreground">שולם</p><p className="mt-1 font-bold nums">{amount(totalPaid)}</p></div>
              <div className="rounded-xl bg-background px-2 py-2.5"><p className="text-xs text-muted-foreground">נשאר</p><p className="mt-1 font-bold nums">{amount(Math.max(totalDue - totalPaid, 0))}</p></div>
            </div>

            <section aria-labelledby="quick-rent-title" className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden="true"><WalletCards className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h3 id="quick-rent-title" className="font-display text-lg">שכר דירה</h3>
                    <p className="text-sm text-muted-foreground nums">{rentCharge ? `שולם ${amount(rentPaid)} מתוך ${amount(rentDue)} · נשאר ${amount(Math.max(rentDue - rentPaid, 0))}` : `צפוי ${amount(rentDue)} · החיוב טרם נוצר`}</p>
                  </div>
                </div>
                <PaymentStatus due={rentDue} paid={rentPaid} billed={Boolean(rentCharge)} />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button type="button" size="sm" className="h-10 flex-1 rounded-full" disabled={rentPaid >= rentDue || pendingKeys.has(tenancy.id)} onClick={() => { void onMarkRentPaid(tenancy).catch(() => undefined); }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {pendingKeys.has(tenancy.id) ? 'שומר...' : 'סמן כשולם'}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-10 flex-1 rounded-full" disabled={pendingKeys.has(tenancy.id)} onClick={() => setEditingPayment({ kind: 'rent' })}>תשלום חלקי</Button>
              </div>
            </section>

            <section aria-labelledby="quick-additional-title">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 id="quick-additional-title" className="font-display text-lg">תשלומים נוספים</h3>
                  <p className="text-sm text-muted-foreground">חשמל, מים וחיובים נוספים שהגיע מועד התשלום שלהם</p>
                </div>
                {additionalCharges.length > 0 && <span className="shrink-0 text-sm font-medium nums">נשאר {amount(Math.max(additionalDue - additionalPaid, 0))}</span>}
              </div>

              {additionalCharges.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">אין כרגע חיובים נוספים לתשלום.</div>
              ) : (
                <div className="divide-y overflow-hidden rounded-2xl border">
                  {additionalCharges.map((charge) => {
                    const due = Number(charge.amount_due);
                    const paid = Number(charge.paid_amount);
                    const pending = pendingKeys.has(`charge:${charge.id}`);
                    const isPreviousPeriod = latestChargeIdBySeries.get(chargeSeriesKey(charge)) !== charge.id;
                    return (
                      <article key={charge.id} className="bg-background p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate font-semibold">{charge.label}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">{isPreviousPeriod ? 'חוב מתקופה קודמת' : 'חיוב נוכחי'} · לתשלום עד {formatBillingDate(charge.due_date)}</p>
                            <p className="mt-1 text-sm text-muted-foreground nums">שולם {amount(paid)} מתוך {amount(due)} · נשאר {amount(Math.max(due - paid, 0))}</p>
                          </div>
                          <PaymentStatus due={due} paid={paid} />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button type="button" size="sm" className="h-9 flex-1 rounded-full" disabled={paid >= due || pending} onClick={() => { void onMarkChargePaid(charge).catch(() => undefined); }}>
                            <CheckCircle2 className="h-4 w-4" />
                            {pending ? 'שומר...' : 'סמן כשולם'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-9 flex-1 rounded-full" disabled={pending} onClick={() => setEditingPayment({ kind: 'charge', charge })}>תשלום חלקי</Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="border-t bg-card px-5 py-4 shadow-[0_-12px_30px_-28px_rgba(23,50,77,0.8)] sm:px-7">
            <Button type="button" className="h-11 w-full rounded-full" onClick={() => { onOpenChange(false); onGoToDetails(tenancy.id); }}>
              מעבר לתשלומים המורחבים של {tenancy.tenant_name}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentEditorDialog
        open={editingPayment !== null}
        tenancy={tenancy}
        charge={editingPayment?.kind === 'rent' ? rentCharge : editingCharge}
        calendar={calendar}
        isSaving={pendingKeys.has(editorPendingKey)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setEditingPayment(null); }}
        onSave={async (input) => {
          if (editingPayment?.kind === 'charge') {
            await onSaveChargePayment({
              charge: editingPayment.charge,
              amountDue: input.amountDue,
              paidAmount: input.paidAmount,
              paidAt: input.paidAt,
            });
            return;
          }
          await onSaveRentPayment(input);
        }}
      />
    </>
  );
}
