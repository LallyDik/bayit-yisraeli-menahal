import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Where a "סמן כשולם" link from a reminder email lands.
//
// The mark-charge-paid Edge Function does the actual work and then redirects
// here, because Supabase serves every Edge Function response on the default
// *.supabase.co domain as text/plain with nosniff — so a confirmation page
// rendered there arrives as raw source, not as a page. Redirecting means the
// confirmation renders in the app, which also puts the updated data one glance
// away.
//
// These params arrive from the URL and anyone can craft them, so they only ever
// drive a message — never a data change. The payment itself already happened
// server-side, guarded by the single-use token.

type Status = 'ok' | 'already' | 'expired' | 'invalid';

const MESSAGES: Record<Status, { tone: 'ok' | 'warn'; title: string; body: string }> = {
  ok: { tone: 'ok', title: 'סומן כשולם', body: 'החיוב עודכן במערכת.' },
  already: { tone: 'warn', title: 'כבר סומן כשולם', body: 'החיוב עודכן קודם. לא בוצע שינוי נוסף.' },
  expired: { tone: 'warn', title: 'הקישור פג תוקף', body: 'קישורי התזכורת תקפים לשבועיים. אפשר לעדכן את התשלום כאן במערכת.' },
  invalid: { tone: 'warn', title: 'הקישור אינו תקף', body: 'ייתכן שהקישור שגוי או שהחיוב נמחק. אפשר לעדכן את התשלום כאן במערכת.' },
};

const isStatus = (v: string | null): v is Status =>
  v === 'ok' || v === 'already' || v === 'expired' || v === 'invalid';

export const PaidConfirmation: React.FC = () => {
  const [state, setState] = useState<{ status: Status; detail: string | null } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('paid');
    if (!isStatus(status)) return;

    const amount = Number(params.get('amount'));
    const parts = [params.get('label'), params.get('tenant'), params.get('unit')].filter(Boolean);
    const money = Number.isFinite(amount) && amount > 0
      ? `₪${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`
      : null;
    const detail = [parts.join(' · ') || null, money].filter(Boolean).join(' — ') || null;

    setState({ status, detail });

    // Drop the params so a refresh or a shared URL doesn't replay the message.
    params.delete('paid');
    params.delete('label');
    params.delete('tenant');
    params.delete('unit');
    params.delete('amount');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
  }, []);

  if (!state) return null;

  const { tone, title, body } = MESSAGES[state.status];
  const ok = tone === 'ok';

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-4" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-2xl border bg-background p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              ok ? 'bg-primary text-primary-foreground' : 'bg-amber-100 text-amber-700'
            }`}
            aria-hidden="true"
          >
            {ok ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{title}</p>
            {state.detail && <p className="mt-0.5 truncate text-sm font-medium">{state.detail}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setState(null)}
            aria-label="סגירת ההודעה"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
