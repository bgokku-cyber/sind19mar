import { calculateFareQuote, getFareTariffFromEnv } from './fare-estimator';

describe('fare estimator', () => {
  const tariff = {
    currency: 'BOB' as const,
    baseFare: 3.5,
    pricePerKm: 3.5,
    minimumFare: 3.5,
    nightBaseFare: 5,
    nightStartMinutes: 22 * 60,
    nightEndMinutes: 5 * 60,
  };

  it('calculates the daytime fare in La Paz', () => {
    expect(calculateFareQuote(2, tariff, new Date('2026-11-20T14:00:00Z')).amount).toBe(10.5);
  });

  it('uses the night base from 22:00 La Paz time', () => {
    // 22:00 in La Paz (UTC-4) is 02:00 UTC on the following day.
    expect(calculateFareQuote(2, tariff, new Date('2026-11-21T02:00:00Z')).amount).toBe(12);
  });

  it('keeps the night fare active after midnight until 04:59', () => {
    expect(calculateFareQuote(2, tariff, new Date('2026-11-21T08:59:00Z')).amount).toBe(12);
  });

  it('switches back to daytime at exactly 05:00 La Paz time', () => {
    expect(calculateFareQuote(2, tariff, new Date('2026-11-21T09:00:00Z')).amount).toBe(10.5);
  });

  it('applies the configured minimum fare', () => {
    expect(calculateFareQuote(0.1, tariff, new Date('2026-11-20T14:00:00Z')).amount).toBe(3.5);
  });

  it('rejects invalid route distances, dates, and tariff values', () => {
    for (const distance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateFareQuote(distance, tariff)).toThrow();
    }
    expect(() => calculateFareQuote(2, tariff, new Date('invalid'))).toThrow();
    expect(() => calculateFareQuote(2, { ...tariff, pricePerKm: -1 })).toThrow();
  });

  it('does not invent daytime prices when environment configuration is missing', () => {
    expect(getFareTariffFromEnv({})).toBeNull();
  });

  it('loads daytime and approved night tariff settings', () => {
    expect(getFareTariffFromEnv({
      FARE_BASE_BOB: '3.5',
      FARE_PER_KM_BOB: '3.5',
      FARE_MINIMUM_BOB: '3.5',
      FARE_NIGHT_BASE_BOB: '5',
      FARE_NIGHT_START: '22:00',
      FARE_NIGHT_END: '05:00',
    })).toEqual({
      ...tariff,
    });
  });

  it('rejects malformed environment tariff values and night hours', () => {
    expect(getFareTariffFromEnv({
      FARE_BASE_BOB: '3.5',
      FARE_PER_KM_BOB: '3.5',
      FARE_MINIMUM_BOB: '3.5',
      FARE_NIGHT_START: '25:00',
    })).toBeNull();
  });
});
