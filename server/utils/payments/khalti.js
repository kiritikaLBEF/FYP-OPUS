import { khaltiConfig } from './config.js';

export async function initiateKhaltiPayment({
  amount,
  purchaseOrderId,
  purchaseOrderName,
  returnUrl,
  websiteUrl,
  customer,
}) {
  const cfg = khaltiConfig();
  if (!cfg.enabled) {
    const err = new Error('Khalti is not configured. Add KHALTI_SECRET_KEY in the server environment.');
    err.status = 503;
    throw err;
  }

  const paisa = Math.round(Number(amount) * 100);
  if (!Number.isFinite(paisa) || paisa < 1000) {
    const err = new Error('Khalti amount must be at least NPR 10');
    err.status = 400;
    throw err;
  }

  const payload = {
    return_url: returnUrl,
    website_url: websiteUrl,
    amount: paisa,
    purchase_order_id: purchaseOrderId,
    purchase_order_name: purchaseOrderName || 'OPUS payment',
  };
  if (customer?.name || customer?.email || customer?.phone) {
    payload.customer_info = {
      name: customer.name || 'OPUS user',
      email: customer.email || '',
      phone: customer.phone || '',
    };
  }

  const res = await fetch(cfg.initiateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${cfg.secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.payment_url) {
    const err = new Error(data.detail || data.error_key || data.message || 'Could not start Khalti checkout');
    err.status = 502;
    throw err;
  }
  return data;
}

export async function lookupKhaltiPayment(pidx) {
  const cfg = khaltiConfig();
  if (!cfg.enabled) {
    const err = new Error('Khalti is not configured');
    err.status = 503;
    throw err;
  }
  const res = await fetch(cfg.lookupUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${cfg.secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pidx }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || data.message || 'Could not verify Khalti payment');
    err.status = 502;
    throw err;
  }
  return data;
}
