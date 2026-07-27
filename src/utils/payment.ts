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
