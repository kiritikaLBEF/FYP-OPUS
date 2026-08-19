export const fmtNPR = (n, { digits = 2 } = {}) =>
  `NPR ${Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtLedgerDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
};

export function postGatewayForm(action, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  Object.entries(fields || {}).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value == null ? '' : String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export function typeLabel(t) {
  if (t.paymentType === 'withdrawal') return 'Payout';
  if (t.paymentType === 'topup') return 'Top-up';
  if (t.paymentType === 'hiring') return 'Paid out';
  if (t.paymentType === 'platform_fee') return 'OPUS fee';
  if (t.credit > 0) return 'Credit';
  if (t.debit > 0) return 'Debit';
  return t.paymentType || '';
}
