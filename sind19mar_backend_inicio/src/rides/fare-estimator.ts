export interface FareTariff {
  currency: 'BOB';
  baseFare: number;
  pricePerKm: number;
  minimumFare: number;
  nightBaseFare?: number;
  nightStartMinutes?: number;
  nightEndMinutes?: number;
}

export interface FareQuote {
  currency: 'BOB';
  distanceKm: number;
  amount: number;
  pricingVersion: 'env-v2';
}

const LA_PAZ_TIME_ZONE = 'America/La_Paz';

function minutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

/**
 * Calculates the fare using road distance and La Paz local time.
 * Night hours are inclusive at 22:00 and exclusive at 05:00.
 */
export function calculateFareQuote(
  distanceKm: number,
  tariff: FareTariff,
  at: Date = new Date(),
): FareQuote {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error('La distancia de ruta debe ser un número positivo.');
  }
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) {
    throw new Error('La fecha de cálculo no es válida.');
  }

  const values = [tariff.baseFare, tariff.pricePerKm, tariff.minimumFare,
    tariff.nightBaseFare ?? 5];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('La configuración tarifaria debe contener valores numéricos no negativos.');
  }

  const start = tariff.nightStartMinutes ?? 22 * 60;
  const end = tariff.nightEndMinutes ?? 5 * 60;
  if (![start, end].every((value) => Number.isInteger(value) && value >= 0 && value < 1440) || start === end) {
    throw new Error('El horario nocturno configurado no es válido.');
  }

  const localMinutes = minutesInTimeZone(at, LA_PAZ_TIME_ZONE);
  const isNight = start > end
    ? localMinutes >= start || localMinutes < end
    : localMinutes >= start && localMinutes < end;
  const baseFare = isNight ? (tariff.nightBaseFare ?? 5) : tariff.baseFare;
  const amount = Math.max(tariff.minimumFare, baseFare + distanceKm * tariff.pricePerKm);
  return {
    currency: 'BOB',
    distanceKm: Math.round(distanceKm * 100) / 100,
    amount: Math.round(amount * 100) / 100,
    pricingVersion: 'env-v2',
  };
}

function parseTimeMinutes(value: string | undefined, fallback: number): number | null {
  if (value === undefined || value.trim() === '') return fallback;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

/** Reads explicit daytime prices and the approved La Paz night schedule. */
export function getFareTariffFromEnv(env: NodeJS.ProcessEnv = process.env): FareTariff | null {
  const raw = [env.FARE_BASE_BOB, env.FARE_PER_KM_BOB, env.FARE_MINIMUM_BOB];
  if (raw.some((value) => value === undefined || value.trim() === '')) return null;
  const [baseFare, pricePerKm, minimumFare] = raw.map(Number);
  const nightBaseFare = env.FARE_NIGHT_BASE_BOB === undefined || env.FARE_NIGHT_BASE_BOB.trim() === ''
    ? 5 : Number(env.FARE_NIGHT_BASE_BOB);
  const nightStartMinutes = parseTimeMinutes(env.FARE_NIGHT_START, 22 * 60);
  const nightEndMinutes = parseTimeMinutes(env.FARE_NIGHT_END, 5 * 60);
  if ([baseFare, pricePerKm, minimumFare, nightBaseFare].some((value) => !Number.isFinite(value) || value < 0) ||
      nightStartMinutes === null || nightEndMinutes === null || nightStartMinutes === nightEndMinutes) return null;
  return { currency: 'BOB', baseFare, pricePerKm, minimumFare, nightBaseFare, nightStartMinutes, nightEndMinutes };
}
