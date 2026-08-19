export const isPaymentSandbox = () => process.env.PAYMENT_SANDBOX !== 'false';

export function khaltiConfig() {
  const secret = process.env.KHALTI_SECRET_KEY?.trim() || '';
  const defaultBase = isPaymentSandbox()
    ? 'https://dev.khalti.com/api/v2'
    : 'https://khalti.com/api/v2';
  const base = (process.env.KHALTI_BASE_URL || defaultBase).replace(/\/$/, '');
  return {
    secret,
    publicKey: process.env.KHALTI_PUBLIC_KEY?.trim() || '',
    initiateUrl: `${base}/epayment/initiate/`,
    lookupUrl: `${base}/epayment/lookup/`,
    enabled: Boolean(secret),
  };
}

export function esewaConfig() {
  const sandbox = isPaymentSandbox();
  const productCode = process.env.ESEWA_PRODUCT_CODE?.trim() || (sandbox ? 'EPAYTEST' : '');
  const secret = process.env.ESEWA_SECRET_KEY || (sandbox ? '8gBm/:&EnhH.1/q' : '');
  const formUrl = process.env.ESEWA_FORM_URL
    || (sandbox
      ? 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
      : 'https://epay.esewa.com.np/api/epay/main/v2/form');
  const statusUrl = process.env.ESEWA_STATUS_URL
    || (sandbox
      ? 'https://rc-epay.esewa.com.np/api/epay/transaction/status/'
      : 'https://epay.esewa.com.np/api/epay/transaction/status/');
  return {
    productCode,
    secret,
    formUrl,
    statusUrl,
    enabled: Boolean(productCode && secret),
  };
}

export function paymentProviderStatus() {
  const khalti = khaltiConfig();
  const esewa = esewaConfig();
  const sandbox = isPaymentSandbox();
  return {
    sandbox,
    esewa: {
      collection: esewa.enabled,
      payout: sandbox,
    },
    khalti: {
      collection: khalti.enabled,
      payout: sandbox,
    },
  };
}
