import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { signEsewaFields, verifyEsewaSignature } from '../utils/payments/esewa.js';

describe('eSewa signature helpers (unit)', () => {
  const secret = '8gBm/:&EnhH.1/q';

  it('signEsewaFields returns a base64 HMAC', () => {
    const signature = signEsewaFields({
      totalAmount: '100',
      transactionUuid: 'test-uuid-1',
      productCode: 'EPAYTEST',
      secret,
    });
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(10);

    const message = 'total_amount=100,transaction_uuid=test-uuid-1,product_code=EPAYTEST';
    const expected = crypto.createHmac('sha256', secret).update(message).digest('base64');
    expect(signature).toBe(expected);
  });

  it('verifyEsewaSignature accepts a valid payload in sandbox defaults', () => {
    process.env.PAYMENT_SANDBOX = 'true';
    const total_amount = '100';
    const transaction_uuid = 'test-uuid-2';
    const product_code = 'EPAYTEST';
    const signed_field_names = 'total_amount,transaction_uuid,product_code';
    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('base64');

    const ok = verifyEsewaSignature({
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature,
    });
    expect(ok).toBe(true);
  });

  it('verifyEsewaSignature rejects a bad signature', () => {
    process.env.PAYMENT_SANDBOX = 'true';
    const ok = verifyEsewaSignature({
      total_amount: '100',
      transaction_uuid: 'test-uuid-3',
      product_code: 'EPAYTEST',
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature: 'not-a-valid-signature-value-here!!',
    });
    expect(ok).toBe(false);
  });
});
