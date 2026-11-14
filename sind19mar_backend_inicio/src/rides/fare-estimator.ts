export interface FareTariff {
  currency: 'BOB';
  baseFare: number;
  pricePerKm: number;
  minimumFare: number;
}

export interface FareQuote {
  currency: 'BOB';
  distanceKm: number;
  amount: number;
  pricingVersion: 'env-v1';
}

/**
 * Calculates a quote from a road distance supplied by a routing provider.
 * It deliberately does not calculate straight-line distance or accept a client fare.
 */
export function calculateFareQuote(distanceKm: number, tariff: FareTariff): FareQuote {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error('La distancia de ruta debe ser un número positivo.');
  }

  const values = [tariff.baseFare, tariff.pricePerKm, tariff.minimumFare];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('La configuración tarifaria debe contener valores numéricos no negativos.');
  }

  const amount = Math.max(tariff.minimumFare, tariff.baseFare + distanceKm * tariff.pricePerKm);
  return {
    currency: 'BOB',
    distanceKm: Math.round(distanceKm * 100) / 100,
    amount: Math.round(amount * 100) / 100,
    pricingVersion: 'env-v1',
  };
}

/** Reads an explicit tariff; no invented production prices are supplied as defaults. */
export function getFareTariffFromEnv(env: NodeJS.ProcessEnv = process.env): FareTariff | null {
  const raw = [env.FARE_BASE_BOB, env.FARE_PER_KM_BOB, env.FARE_MINIMUM_BOB];
  if (raw.some((value) => value === undefined || value.trim() === '')) return null;
  const [baseFare, pricePerKm, minimumFare] = raw.map(Number);
  if ([baseFare, pricePerKm, minimumFare].some((value) => !Number.isFinite(value) || value < 0)) return null;
  return { currency: 'BOB', baseFare, pricePerKm, minimumFare };
}
