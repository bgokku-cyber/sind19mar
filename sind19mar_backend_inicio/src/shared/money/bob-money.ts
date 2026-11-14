export const BOB_CURRENCY = 'BOB' as const;

export interface BobMoney {
  /** Integer amount in centavos; never use floating-point currency values. */
  minorUnits: number;
  currency: typeof BOB_CURRENCY;
}

/**
 * Parse an API/input decimal string into integer centavos.
 * Accepts a dot as the decimal separator and at most two decimal places.
 */
export function parseBobAmount(value: string): BobMoney {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('El importe debe ser un número no negativo con hasta 2 decimales.');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const minorUnits = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));

  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('El importe supera el máximo seguro admitido.');
  }

  return {
    minorUnits: Number(minorUnits),
    currency: BOB_CURRENCY,
  };
}

/** Format BOB for Spanish-language screens without floating-point arithmetic. */
export function formatBobAmount(money: BobMoney): string {
  assertBobMoney(money);

  const whole = Math.floor(money.minorUnits / 100);
  const cents = String(money.minorUnits % 100).padStart(2, '0');
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `Bs ${groupedWhole},${cents}`;
}

/** Add BOB amounts safely; an empty list represents Bs 0,00. */
export function addBobAmounts(...amounts: BobMoney[]): BobMoney {
  const total = amounts.reduce((sum, amount) => {
    assertBobMoney(amount);
    const next = sum + amount.minorUnits;

    if (!Number.isSafeInteger(next)) {
      throw new RangeError('La suma supera el máximo seguro admitido.');
    }

    return next;
  }, 0);

  return {
    minorUnits: total,
    currency: BOB_CURRENCY,
  };
}

function assertBobMoney(money: BobMoney): void {
  if (
    money.currency !== BOB_CURRENCY ||
    !Number.isSafeInteger(money.minorUnits) ||
    money.minorUnits < 0
  ) {
    throw new RangeError('Importe BOB inválido.');
  }
}
