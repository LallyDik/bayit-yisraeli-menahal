import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  CircleHelp,
  Gauge,
  Home,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type GuideView = 'overview' | 'payments' | 'units' | 'tenants';

type GuideStep = {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Home;
  selectors?: string[];
  view?: GuideView;
  example?: string;
  tips?: string[];
  demo?: 'settings' | 'reading' | 'paid' | 'partial';
};

const STEPS: GuideStep[] = [
  {
    eyebrow: 'ברוכים הבאים',
    title: 'עושים סדר בשכירות, צעד אחר צעד',
    description: 'עכשיו נעבור יחד בין הכפתורים האמיתיים במערכת. בכל שלב תראו גם דוגמה, כדי שיהיה ברור מה ממלאים ומה קורה אחר כך.',
    icon: Sparkles,
  },
  {
    eyebrow: '1 · דירות',
    title: 'כאן מוסיפים את הנכס',
    description: 'לחיצה על „הוספת דירה” פותחת טופס קצר. שם הדירה הוא השדה היחיד שחייבים למלא; את שאר הפרטים אפשר להשלים בהמשך.',
    icon: Home,
    selectors: ['[data-guide="add-unit"]', '[data-guide="units-tab"]'],
    view: 'units',
    example: 'דוגמה: דירה 3, קומה ב׳ · שכ״ד מבוקש ₪4,800',
  },
  {
    eyebrow: '2 · שוכרים',
    title: 'מכאן מוסיפים שוכר ומשייכים לדירה',
    description: 'בטופס השוכר בוחרים את הדירה, שכר הדירה שסוכם ותאריך הכניסה. אפשר גם לשמור שוכר ללא דירה ולשייך אותו מאוחר יותר.',
    icon: UserRound,
    selectors: ['[data-guide="add-tenant"]', '[data-guide="tenants-tab"]'],
    view: 'tenants',
    example: 'דוגמה: נועה כהן · דירה 3 · ₪4,800 · כניסה 01.08.2026',
  },
  {
    eyebrow: '3 · תשלומים',
    title: 'כאן מנהלים את כל החיובים',
    description: 'במסך התשלומים מגדירים מועד חיוב, מסמנים שכ״ד ששולם ומנהלים חשמל, מים וחיובים נוספים - בסכום קבוע או לפי מונה.',
    icon: ReceiptText,
    selectors: ['[data-guide="payments-tab"]'],
    view: 'payments',
    example: 'דוגמה: שכ״ד ₪4,800 · מועד חיוב: 1 בחודש · שולם במלואו',
  },
  {
    eyebrow: '4 · הגדרות חשמל',
    title: 'מתחילים בכפתור „הגדרות” בכרטיס החשמל',
    description: 'בפעם הראשונה בוחרים „לפי מונה” ומגדירים את המחיר לקוט״ש. ההגדרה נשמרת, ולכן לא צריך להזין אותה מחדש בכל חודש.',
    icon: ReceiptText,
    selectors: ['[data-guide="electricity-settings"]', '[data-guide="electricity-card"]', '[data-guide="payments-page"]'],
    view: 'payments',
    tips: ['לוחצים על „הגדרות” בראש כרטיס החשמל', 'בוחרים „לפי מונה”', 'מזינים מחיר ליחידה, למשל ₪0.62 לקוט״ש'],
    demo: 'settings',
    example: 'דוגמה: שיטת חישוב לפי מונה · מחיר ליחידה ₪0.62',
  },
  {
    eyebrow: '5 · יצירת חיוב חשמל',
    title: 'כאן מזינים את קריאת המונה הנוכחית',
    description: 'המערכת מציגה את קריאת המונה הקודמת. מזינים רק את הקריאה החדשה, והיא מחשבת אוטומטית את הצריכה ואת סכום החיוב.',
    icon: Calculator,
    selectors: ['[data-guide="electricity-reading"]', '[data-guide="electricity-card"]', '[data-guide="payments-page"]'],
    view: 'payments',
    tips: ['מוודאים שהמונה הנוכחי גבוה מהמונה הקודם', 'המערכת מחשבת את ההפרש', 'בודקים את צפי החיוב שמופיע מתחת לשדות'],
    demo: 'reading',
    example: 'דוגמה: מונה 1,240 ← 1,315 · צריכה 75 × ₪0.62 = חיוב ₪46.50',
  },
  {
    eyebrow: '6 · יצירת החיוב',
    title: 'כאן לוחצים „צור חיוב”',
    description: 'רק אחרי שבדקתם את הקריאה ואת צפי הסכום, לוחצים על הכפתור הזה. החיוב יתווסף לכרטיס החשמל ואז יופיעו פעולות התשלום.',
    icon: Calculator,
    selectors: ['[data-guide="electricity-create-charge"]', '[data-guide="electricity-card"]', '[data-guide="payments-page"]'],
    view: 'payments',
    tips: ['הכפתור פעיל כשיש קריאות תקינות ומחיר ליחידה', 'לאחר הלחיצה יופיע סכום החיוב', 'מתחתיו יופיעו „סמן כשולם” ו„תשלום חלקי”'],
    demo: 'reading',
    example: 'דוגמה: צפי ₪46.50 → צור חיוב → חיוב חשמל פתוח ₪46.50',
  },
  {
    eyebrow: '7 · תשלום מלא',
    title: 'קיבלתם את כל הסכום? לוחצים „סמן כשולם”',
    description: 'הכפתור נמצא גם בכרטיס שכר הדירה וגם בכל חיוב נוסף. הוא רושם מיד שהתקבל מלוא סכום החיוב ומאפס את היתרה.',
    icon: Check,
    selectors: ['[data-guide="electricity-mark-paid"]', '[data-guide="rent-mark-paid"]', '[data-guide="electricity-payment-actions"]', '[data-guide="rent-payment-actions"]', '[data-guide="payments-page"]'],
    view: 'payments',
    tips: ['משתמשים בכפתור רק כשהסכום המלא התקבל', 'המצב משתנה מיד ל„שולם”', 'אותה פעולה זמינה לשכ״ד, חשמל וכל חיוב נוסף'],
    demo: 'paid',
    example: 'דוגמה: חיוב שכ״ד ₪4,800 · התקבל ₪4,800 → שולם · יתרה ₪0',
  },
  {
    eyebrow: '8 · תשלום חלקי',
    title: 'התקבל רק חלק? לוחצים „תשלום חלקי”',
    description: 'נפתח חלון שבו רושמים כמה התקבל ובאיזה תאריך. המערכת מחשבת את היתרה, ואפשר לעדכן שוב כשמגיע תשלום נוסף.',
    icon: Check,
    selectors: ['[data-guide="electricity-partial"]', '[data-guide="rent-partial"]', '[data-guide="electricity-payment-actions"]', '[data-guide="rent-payment-actions"]', '[data-guide="payments-page"]'],
    view: 'payments',
    tips: ['מזינים את הסכום המצטבר ששולם עד עכשיו', 'בוחרים את תאריך התשלום', 'שומרים ורואים מיד כמה עדיין נשאר'],
    demo: 'partial',
    example: 'דוגמה: חיוב ₪4,800 · התקבל ₪3,000 → חלקי · נשאר ₪1,800',
  },
  {
    eyebrow: '9 · סקירה',
    title: 'הסקירה מראה מה דורש תשומת לב',
    description: 'זה המסך שכדאי לפתוח בתחילת העבודה: תפוסה, הכנסה חודשית וחיובים פתוחים, עם קיצורי דרך לפעולה הבאה.',
    icon: LayoutDashboard,
    selectors: ['[data-guide="overview-tab"]'],
    view: 'overview',
    example: 'דוגמה: 3 דירות · 2 תפוסות · חיוב פתוח אחד בסך ₪650',
  },
  {
    eyebrow: 'זה הכול',
    title: 'אפשר לפתוח את המדריך שוב בכל רגע',
    description: 'כפתור „מדריך” מחזיר את הסיור הזה מההתחלה, בלי לשנות או למחוק שום נתון.',
    icon: CircleHelp,
    selectors: ['[data-guide="help"]'],
    view: 'overview',
    example: 'טיפ: אם משהו לא ברור, פותחים את המדריך וחוזרים ישר לכפתור הרלוונטי.',
  },
];

function GuideDemo({ type }: { type: NonNullable<GuideStep['demo']> }) {
  if (type === 'settings') {
    return (
      <div className="mt-4 rounded-2xl border bg-background p-3" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display">⚡ חשמל</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-secondary bg-muted px-3 py-1.5 text-xs font-semibold"><Settings className="h-3.5 w-3.5" />הגדרות</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">לפי מונה · ₪0.62 לקוט״ש</p>
      </div>
    );
  }

  if (type === 'reading') {
    return (
      <div className="mt-4 rounded-2xl border bg-background p-3" aria-hidden="true">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-xl bg-muted px-3 py-2"><span className="block text-muted-foreground">מונה קודם</span><span className="font-bold nums">1,240</span></span>
          <span className="rounded-xl border-2 border-secondary px-3 py-2"><span className="block text-muted-foreground">מונה נוכחי</span><span className="font-bold nums">1,315</span></span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="nums">צפי חיוב: <strong>₪46.50</strong></span><span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground"><Calculator className="h-3.5 w-3.5" />צור חיוב</span></div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border bg-background p-3" aria-hidden="true">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="h-3.5 w-3.5" />שכר דירה · נשאר ₪{type === 'partial' ? '1,800' : '4,800'}</div>
      <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
        <span className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 ${type === 'paid' ? 'ring-2 ring-secondary bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}`}><CheckCircle2 className="h-3.5 w-3.5" />סמן כשולם</span>
        <span className={`inline-flex items-center justify-center rounded-full border px-3 py-2 ${type === 'partial' ? 'border-secondary ring-2 ring-secondary' : ''}`}>תשלום חלקי</span>
      </div>
    </div>
  );
}

interface FirstLoginGuideProps {
  open: boolean;
  hasUnits: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: GuideView) => void;
  onComplete: () => Promise<void>;
  onStart: () => Promise<void>;
}

type TargetRect = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>;

export function FirstLoginGuide({
  open,
  hasUnits,
  saving = false,
  onOpenChange,
  onNavigate,
  onComplete,
  onStart,
}: FirstLoginGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isLocatingTarget, setIsLocatingTarget] = useState(false);
  const coachmarkRef = useRef<HTMLDivElement>(null);
  const onNavigateRef = useRef(onNavigate);
  const step = STEPS[stepIndex];
  const isIntro = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const progressLabel = useMemo(() => `שלב ${stepIndex + 1} מתוך ${STEPS.length}`, [stepIndex]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => setStepIndex(0), 200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open || isIntro || !step.selectors) {
      setTargetRect(null);
      setIsLocatingTarget(false);
      return undefined;
    }

    setIsLocatingTarget(true);
    if (step.view) onNavigateRef.current(step.view);
    let cancelled = false;
    let retryTimer = 0;

    const syncTarget = (attempt = 0) => {
      if (cancelled) return;
      const element = step.selectors!
        .map((selector) => document.querySelector<HTMLElement>(selector))
        .find((candidate) => candidate && candidate.getBoundingClientRect().width > 0);
      if (!element) {
        if (attempt < 12) retryTimer = window.setTimeout(() => syncTarget(attempt + 1), 80);
        else {
          setTargetRect(null);
          setIsLocatingTarget(false);
        }
        return;
      }

      if (attempt === 0) {
        const isMobile = window.innerWidth < 640;
        element.scrollIntoView({
          block: isMobile ? 'start' : 'nearest',
          inline: 'nearest',
          behavior: 'auto',
        });
        if (isMobile) window.scrollBy({ top: -76, behavior: 'auto' });
      }
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (element.dataset.guide === 'payments-page') setTargetRect(null);
          else setTargetRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height });
          setIsLocatingTarget(false);
          return;
        }
        // The node can be swapped out from under us by the very tab switch this
        // effect just triggered (and the payments view is lazy-loaded), leaving a
        // detached 0x0 element. Retry - and always clear the locating flag, or the
        // coachmark stays opacity-0 behind the backdrop and the guide looks frozen.
        if (attempt < 12) {
          retryTimer = window.setTimeout(() => syncTarget(attempt + 1), 80);
        } else {
          setTargetRect(null);
          setIsLocatingTarget(false);
        }
      });
    };

    retryTimer = window.setTimeout(() => syncTarget(), 100);
    const handleViewportChange = () => syncTarget(1);
    window.addEventListener('resize', handleViewportChange);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isIntro, open, step.selectors, step.view]);

  useEffect(() => {
    if (!open || isIntro) return undefined;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const rootWasInert = appRoot?.hasAttribute('inert') ?? false;
    document.body.style.overflow = 'hidden';
    appRoot?.setAttribute('inert', '');
    const focusTimer = window.setTimeout(() => coachmarkRef.current?.focus(), 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (saving || event.repeat) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
      if (event.key === 'ArrowLeft' && !isLast) {
        event.preventDefault();
        setStepIndex((current) => current + 1);
      }
      if (event.key === 'ArrowRight' && stepIndex > 0) {
        event.preventDefault();
        setStepIndex((current) => current - 1);
      }
      if (event.key === 'Tab' && coachmarkRef.current) {
        const focusable = Array.from(coachmarkRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      if (!rootWasInert) appRoot?.removeAttribute('inert');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isIntro, isLast, onOpenChange, open, saving, stepIndex]);

  const finish = async () => {
    if (hasUnits) await onComplete();
    else await onStart();
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onOpenChange(false);
  };

  const coachmarkPosition = (() => {
    if (!targetRect || typeof window === 'undefined') return undefined;
    const gutter = 16;
    const width = Math.min(380, window.innerWidth - gutter * 2);
    const placeAtBottom = targetRect.bottom <= window.innerHeight / 2;
    if (window.innerWidth < 640) {
      return {
        right: 12,
        left: 12,
        ...(placeAtBottom ? { bottom: 12 } : { top: 12 }),
        width: 'auto',
        maxHeight: '44dvh',
      };
    }
    return {
      left: '50%',
      transform: 'translateX(-50%)',
      ...(placeAtBottom ? { bottom: gutter } : { top: gutter }),
      width,
      maxHeight: '46dvh',
    };
  })();

  // The spotlight waits until the target is measured, but the panel itself must
  // never be hidden: hiding it meant any hiccup while locating left the user
  // staring at the dark backdrop with nothing to read and nothing to click.
  const visibleTargetRect = isLocatingTarget ? null : targetRect;

  const coachmark = open && !isIntro ? createPortal(
    <div className="fixed inset-0 z-[70]" aria-hidden={false}>
      <div className={`absolute inset-0 ${visibleTargetRect ? '' : 'bg-foreground/65'}`} aria-hidden="true" />
      {visibleTargetRect && (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-secondary"
          style={{
            top: visibleTargetRect.top - 7,
            left: visibleTargetRect.left - 7,
            width: visibleTargetRect.width + 14,
            height: visibleTargetRect.height + 14,
            boxShadow: '0 0 0 9999px rgba(23, 50, 77, 0.66)',
          }}
          aria-hidden="true"
        />
      )}

      <div
        ref={coachmarkRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-step-title"
        aria-describedby="guide-step-description"
        tabIndex={-1}
        className={`fixed max-h-[55dvh] overflow-y-auto rounded-[1.75rem] border bg-card p-5 text-start shadow-2xl outline-none sm:max-h-[calc(100dvh-2rem)] ${coachmarkPosition ? '' : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2'}`}
        style={coachmarkPosition}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden="true"><step.icon className="h-5 w-5" /></span>
          <span className="me-auto text-xs font-bold text-muted-foreground" aria-live="polite">{progressLabel}</span>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onOpenChange(false)} aria-label="סגירת המדריך"><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-sm font-bold text-primary">{step.eyebrow}</p>
        <h2 id="guide-step-title" className="mt-1 font-display text-2xl leading-tight">{step.title}</h2>
        <p id="guide-step-description" className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
        {step.demo && <GuideDemo type={step.demo} />}
        {step.tips && (
          <ol className="mt-4 space-y-2">
            {step.tips.map((tip, index) => (
              <li key={tip} className="flex items-start gap-2 text-sm leading-5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary" aria-hidden="true">{index + 1}</span>
                {tip}
              </li>
            ))}
          </ol>
        )}
        {step.example && (
          <div className="mt-4 rounded-2xl bg-secondary/35 p-3">
            <p className="text-xs font-bold text-foreground/65">כך זה נראה לדוגמה</p>
            <p className="mt-1 text-sm font-medium">{step.example.replace('דוגמה: ', '')}</p>
          </div>
        )}
        <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={saving} onClick={() => void onComplete()}>דלגו</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={saving} onClick={() => setStepIndex((current) => current - 1)}><ArrowRight className="h-4 w-4" />חזרה</Button>
            <Button type="button" size="sm" className="rounded-full" disabled={saving} onClick={() => { if (isLast) void finish(); else setStepIndex((current) => current + 1); }}>
              {saving ? 'שומר...' : isLast ? (hasUnits ? 'סיום' : 'בואו נתחיל') : 'הבא'}
              {!isLast && <ArrowLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        {isIntro && <DialogContent className="gap-0 overflow-y-auto border-0 p-0 shadow-2xl sm:max-w-xl sm:rounded-[2rem]">
          <div className="border-b bg-card px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
            <div className="mb-6 flex items-center justify-between gap-4 pe-8">
              <p className="text-sm font-semibold text-muted-foreground">{progressLabel}</p>
              <div className="flex flex-1 justify-end gap-1.5" aria-hidden="true">
                {STEPS.map((item, index) => <span key={item.eyebrow} className={`h-1.5 max-w-10 flex-1 rounded-full ${index <= stepIndex ? 'bg-primary' : 'bg-border'}`} />)}
              </div>
            </div>
            <DialogHeader className="items-start text-start">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden="true"><Sparkles className="h-7 w-7" /></span>
              <p className="text-sm font-bold text-primary">{step.eyebrow}</p>
              <DialogTitle className="font-display text-3xl leading-tight">{step.title}</DialogTitle>
              <DialogDescription className="max-w-lg pt-2 text-base leading-7">{step.description}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="bg-background px-5 py-5 sm:px-8 sm:py-6">
            <ol className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-4" aria-label="סדר העבודה במערכת">
              {[
                { icon: Home, label: 'דירה' },
                { icon: UserRound, label: 'שוכר' },
                { icon: ReceiptText, label: 'תשלום' },
              ].map((item, index) => (
                <li key={item.label} className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><item.icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="truncate text-sm font-medium">{item.label}</span>
                  {index < 2 && <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3 border-t bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <Button type="button" variant="ghost" className="order-2 text-muted-foreground sm:order-1" disabled={saving} onClick={() => void onComplete()}>דלגו על המדריך</Button>
            <Button type="button" className="order-1 rounded-full sm:order-2" disabled={saving} onClick={() => setStepIndex(1)}>התחלת הסיור <ArrowLeft className="h-4 w-4" /></Button>
          </div>
        </DialogContent>}
      </Dialog>
      {coachmark}
    </>
  );
}
