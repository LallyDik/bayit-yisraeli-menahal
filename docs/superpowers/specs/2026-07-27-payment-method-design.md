# אופן תשלום + תווית "סמן כשולם" מותאמת — עיצוב

תאריך: 2026-07-27

## מטרה

לאפשר לבעל דירה לציין **אופן תשלום** לתקופת שכירות (מזומן / צ'ק / העברה בנקאית),
ולהתאים בהתאם את תווית פעולת "סמן כשולם" באפליקציה — כדי שהניסוח ישקף איך השוכר
משלם ("בוצעה העברה", "הופקד צ'ק"). **השדה אינו חובה**; ללא בחירה הכל נשאר כמו היום.

## החלטות מסגרת

- **אחסון:** על טבלת `tenancies` (יחד עם `monthly_rent`/`start_date`), לא על השוכר.
- **היקף:** באפליקציה בלבד. קישור "סמן כשולם" שבמייל התזכורת **לא** משתנה בשלב זה (מחוץ לתחום).
- **אופציונלי:** העמודה nullable; `null` = לא הוגדר → תווית ברירת המחדל "סמן כשולם".
- רק ה**תווית** משתנה; פעולת הסימון וההתנהגות זהות.

## נתונים

עמודה חדשה על `public.tenancies`:

```sql
alter table public.tenancies
  add column if not exists payment_method text
  check (payment_method in ('cash', 'check', 'transfer'));
```

- Nullable, ללא ברירת מחדל (שוכרים קיימים = `null`).
- `check` מגביל לשלושת הערכים החוקיים.
- RLS של `tenancies` כבר קיים ומכסה את העמודה — אין policy חדש.
- הטיפוסים ב־`src/types/database.ts` (מיוצרים) יעודכנו ידנית: הוספת `payment_method: 'cash' | 'check' | 'transfer' | null` ל־Row, ו־`payment_method?: ... | null` ל־Insert/Update של `tenancies`.

## רכיבים וקבצים

| קובץ | שינוי | אחריות |
|---|---|---|
| `supabase/migrations/20260727130000_tenancy_payment_method.sql` | **חדש** | העמודה + check |
| `src/types/database.ts` | שינוי | הוספת `payment_method` ל־tenancies (Row/Insert/Update) |
| `src/utils/payment.ts` | **חדש** | `PaymentMethod` type, `markPaidLabel()`, `PAYMENT_METHOD_OPTIONS` |
| `tests/payment.test.ts` | **חדש** | בדיקת יחידה ל־`markPaidLabel` |
| `src/components/TenantForm.tsx` | שינוי | שדה בחירת אופן תשלום (לא חובה) |
| `src/pages/Index.tsx` | שינוי | העברת `payment_method` ב־create/update tenancy |
| `src/hooks/useTenancies.ts` | שינוי (אם צריך) | לוודא ש־`payment_method` נכלל בשאילתה/בטיפוס התקופה |
| `src/components/PaymentsPage.tsx`, `TenantPaymentSummaryDialog.tsx`, `Dashboard.tsx` | שינוי | הצגת `markPaidLabel(payment_method)` בכפתורי הסימון |

## לוגיקה טהורה — `src/utils/payment.ts`

```ts
export type PaymentMethod = 'cash' | 'check' | 'transfer';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'מזומן' },
  { value: 'transfer', label: 'העברה בנקאית' },
  { value: 'check', label: "צ'ק" },
];

/** Label for the "mark as paid" action, tuned to how this tenant pays. */
export function markPaidLabel(method: PaymentMethod | null | undefined): string {
  switch (method) {
    case 'cash':     return 'שולם';
    case 'transfer': return 'בוצעה העברה';
    case 'check':    return "הופקד צ'ק";
    default:         return 'סמן כשולם';
  }
}
```

מיפוי התוויות:

| method | תווית |
|---|---|
| `cash` | שולם |
| `transfer` | בוצעה העברה |
| `check` | הופקד צ'ק |
| `null`/לא הוגדר | סמן כשולם |

## עריכה בטופס השוכר

ב־`TenantForm` יתווסף שדה בחירה **לא חובה** ("אופן תשלום") עם אפשרות ריקה ("לא צוין")
ושלוש האפשרויות מ־`PAYMENT_METHOD_OPTIONS`. הערך נשמר על ה־tenancy דרך אותן זרימות
של `monthly_rent`/`start_date` ב־`Index.tsx` (`createTenancy`/`updateTenancy` ו־
`saveNewTenant`/`saveEditedTenant`). ערך ריק → `null`.

## הצגת התווית

כל מקום שבו כיום מופיע הטקסט הקבוע "סמן כשולם" על כפתור פעולה יחליף אותו ב־
`markPaidLabel(tenancy.payment_method)`. המקומות: `PaymentsPage`,
`TenantPaymentSummaryDialog`, ו־`Dashboard` (סקירה). כל אחד מהם כבר מקבל את אובייקט
ה־tenancy; יש לוודא שהאובייקט נושא את `payment_method` (דרך `useTenancies`).

## טיפול בשגיאות ומקרי קצה

| מצב | התנהגות |
|---|---|
| שוכר קיים ללא אופן תשלום | `null` → "סמן כשולם" (כמו היום) |
| ערך לא חוקי (לא אמור לקרות) | ה־check ב־DB דוחה; ה־switch נופל ל־default |
| שינוי אופן תשלום | נשמר על ה־tenancy; התווית מתעדכנת מיד |

## מחוץ לתחום

- קישור "סמן כשולם" במייל התזכורת (אולי בהמשך).
- רישום אופן התשלום בהערת התשלום.
- אופן תשלום ברמת חיוב בודד (זה ברמת התקופה).

## בדיקות

- `tests/payment.test.ts` — בדיקת יחידה ל־`markPaidLabel` (כל ארבעת המקרים + `undefined`).
- מיגרציה אדיטיבית; אין policy חדש (RLS של tenancies קיים).
- `npx tsc --noEmit`, `npm run build`, ובדיקה ידנית: בחירת אופן תשלום בטופס → הכפתור במסך התשלומים משנה תווית; שוכר בלי אופן תשלום → "סמן כשולם".

## סיכונים

| סיכון | טיפול |
|---|---|
| `payment_method` לא זורם לרכיב הכפתור | הספק מסמן לוודא ב־`useTenancies`; הבדיקה הידנית תתפוס |
| טיפוסים מיוצרים מתנגשים | עדכון ידני של `database.ts` בלבד, לא הרצת regenerate שתדרוס שינויים |
