import crypto from 'crypto';
import { esewaConfig } from './config.js';

const amountString = (amount) => {
  const n = Number(amount);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

export function signEsewaFields({ totalAmount, transactionUuid, productCode, secret }) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}

export function buildEsewaPayment({ amount, transactionUuid, successUrl, failureUrl }) {
  const cfg = esewaConfig();
  if (!cfg.enabled) {
    const err = new Error('eSewa is not configured. Add ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY.');
    err.status = 503;
    throw err;
  }
  const totalAmount = amountString(amount);
  const signature = signEsewaFields({
    totalAmount,
    transactionUuid,
    productCode: cfg.productCode,
    secret: cfg.secret,
  });
  return {
    action: cfg.formUrl,
    fields: {
      amount: totalAmount,
      tax_amount: '0',
      total_amount: totalAmount,
      transaction_uuid: transactionUuid,
      product_code: cfg.productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature,
    },
  };
}

export function decodeEsewaCallback(dataParam) {
  if (!dataParam) return null;
  try {
    const json = Buffer.from(String(dataParam), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function verifyEsewaSignature(payload) {
  const cfg = esewaConfig();
  if (!payload || !cfg.secret) return false;
  const signed = String(payload.signed_field_names || 'total_amount,transaction_uuid,product_code')
    .split(',')
    .map((field) => `${field.trim()}=${payload[field.trim()]}`)
    .join(',');
  const expected = crypto.createHmac('sha256', cfg.secret).update(signed).digest('base64');
  const given = String(payload.signature || '');
  if (!given || expected.length !== given.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export async function lookupEsewaPayment({ transactionUuid, totalAmount }) {
  const cfg = esewaConfig();
  if (!cfg.enabled) {
    const err = new Error('eSewa is not configured');
    err.status = 503;
    throw err;
  }
  const url = new URL(cfg.statusUrl);
  url.searchParams.set('product_code', cfg.productCode);
  url.searchParams.set('total_amount', amountString(totalAmount));
  url.searchParams.set('transaction_uuid', transactionUuid);

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Could not verify eSewa payment');
    err.status = 502;
    throw err;
  }
  return data;
}
