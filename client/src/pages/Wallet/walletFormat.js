export const fmtNPR = (n, { digits = 2 } = {}) =>
  `NPR ${Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtNPRFigure = (n) =>
  Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtLedgerDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function postGatewayForm(action, fields, meta = {}) {
  if (meta.intentId) {
    try {
      sessionStorage.setItem(
        'opus_pending_payment',
        JSON.stringify({
          intentId: meta.intentId,
          provider: meta.provider || 'esewa',
          amount: meta.amount || null,
          at: Date.now(),
        }),
      );
    } catch {
      /* ignore private mode */
    }
  }
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

export function readPendingPayment() {
  try {
    const raw = sessionStorage.getItem('opus_pending_payment');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ignore stale entries older than 2 hours
    if (parsed?.at && Date.now() - parsed.at > 2 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    sessionStorage.removeItem('opus_pending_payment');
  } catch {
    /* ignore */
  }
}

export function decodeEsewaDataParam(dataParam) {
  if (!dataParam) return null;
  try {
    let raw = String(dataParam).replace(/ /g, '+');
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* already decoded */
    }
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

export function typeLabel(t) {
  if (t.paymentType === 'withdrawal') return 'Payout';
  if (t.paymentType === 'topup') return 'Top-up';
  if (t.paymentType === 'hiring') return 'Paid out';
  if (t.paymentType === 'platform_fee') return 'OPUS fee';
  if (t.paymentType === 'milestone') return 'Job credit';
  if (t.credit > 0) return 'Credit';
  if (t.debit > 0) return 'Debit';
  return t.paymentType || '';
}

export function txnStatus(t) {
  const s = String(t.transactionStatus || t.paymentStatus || '').toLowerCase();
  if (s === 'processing' || s === 'pending') return 'processing';
  return 'completed';
}

export function txnRef(t) {
  const bits = [];
  if (t.method === 'esewa') bits.push('via eSewa');
  if (t.method === 'khalti') bits.push('via Khalti');
  if (t.projectTitle) bits.push(t.projectTitle);
  else if (t.organizationName) bits.push(t.organizationName);
  else if (t.payoutAccount) bits.push(t.payoutAccount);
  return bits.join(' · ') || typeLabel(t);
}
