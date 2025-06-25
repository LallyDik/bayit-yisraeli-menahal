import React, { useState } from 'react';
import { usePayments } from '@/hooks/usePayments';

const paymentTypes = [
  { key: 'rent', label: "שכ״ד" },
  { key: 'electricity', label: 'חשמל' },
  { key: 'water', label: 'מים' },
  { key: 'committee', label: 'ועד' },
  { key: 'gas', label: 'גז' },
];

const PaymentInputs = ({ payment }) => {
  const { updatePaymentStatus } = usePayments();
  const [values, setValues] = useState({
    rent: payment.rentPaid ?? 0,
    electricity: payment.electricityPaid ?? 0,
    water: payment.waterPaid ?? 0,
    committee: payment.committeePaid ?? 0,
    gas: payment.gasPaid ?? 0,
  });
  const [saving, setSaving] = useState({});

  const handleSave = async (type) => {
    setSaving(prev => ({ ...prev, [type]: true }));
    await updatePaymentStatus(payment.id, type, values[type]);
    setSaving(prev => ({ ...prev, [type]: false }));
  };

  return (
    <div>
      {paymentTypes.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <label>{label}: </label>
          <input
            type="number"
            value={values[key]}
            min={0}
            onChange={e => setValues(v => ({ ...v, [key]: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
          <button
            onClick={() => handleSave(key)}
            disabled={saving[key]}
            style={{ marginRight: 8 }}
          >
            שמור
          </button>
        </div>
      ))}
    </div>
  );
};

export default PaymentInputs;