import { calculateFareQuote, getFareTariffFromEnv } from './fare-estimator';

describe('fare estimator', () => {
  const tariff = { currency: 'BOB' as const, baseFare: 5, pricePerKm: 2, minimumFare: 8 };

  it('calculates and rounds a quote from a route distance in bolivianos', () => {
    expect(calculateFareQuote(3.456, tariff)).toEqual({
      currency: 'BOB',
      distanceKm: 3.46,
      amount: 11.91,
      pricingVersion: 'env-v1',
    });
  });

  it('applies the configured minimum fare', () => {
    expect(calculateFareQuote(0.5, tariff).amount).toBe(8);
  });

  it('rejects missing, zero, negative, or non-finite route distances', () => {
    for (const distance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateFareQuote(distance, tariff)).toThrow();
    }
  });

  it('rejects invalid tariff values', () => {
    expect(() => calculateFareQuote(2, { ...tariff, pricePerKm: -1 })).toThrow();
  });

  it('does not invent tariff values when environment configuration is missing', () => {
    expect(getFareTariffFromEnv({})).toBeNull();
  });

  it('loads an explicitly configured tariff', () => {
    expect(getFareTariffFromEnv({
      FARE_BASE_BOB: '5',
      FARE_PER_KM_BOB: '2.5',
      FARE_MINIMUM_BOB: '8',
    })).toEqual({ currency: 'BOB', baseFare: 5, pricePerKm: 2.5, minimumFare: 8 });
  });

  it('rejects malformed environment tariff values', () => {
    expect(getFareTariffFromEnv({
      FARE_BASE_BOB: 'five',
      FARE_PER_KM_BOB: '2',
      FARE_MINIMUM_BOB: '8',
    })).toBeNull();
  });
});
