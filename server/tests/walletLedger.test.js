import { describe, it, expect } from 'vitest';
import { splitJobPayment, roundNpr, PLATFORM_FEE_RATE } from '../utils/walletLedger.js';

describe('U-01 splitJobPayment (10% platform fee)', () => {
  it('uses a 10% fee rate', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.1);
  });

  it('splits NPR 1000 into fee 100 and net 900', () => {
    const result = splitJobPayment(1000);
    expect(result.gross).toBe(1000);
    expect(result.fee).toBe(100);
    expect(result.net).toBe(900);
    expect(result.feeRate).toBe(0.1);
  });

  it('rounds paisa-safe values with roundNpr', () => {
    expect(roundNpr(10.006)).toBe(10.01);
    expect(roundNpr(10.004)).toBe(10);
  });

  it('handles zero amount', () => {
    const result = splitJobPayment(0);
    expect(result.gross).toBe(0);
    expect(result.fee).toBe(0);
    expect(result.net).toBe(0);
  });
});
