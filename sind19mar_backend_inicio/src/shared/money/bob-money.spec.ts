import {
  addBobAmounts,
  formatBobAmount,
  parseBobAmount,
} from './bob-money';

describe('BOB money helpers', () => {
  describe('parseBobAmount', () => {
    it.each([
      ['0', 0],
      ['12', 1200],
      ['12.3', 1230],
      ['12.34', 1234],
      ['001.05', 105],
    ])('parses %s into integer centavos', (input, expected) => {
      expect(parseBobAmount(input)).toEqual({
        minorUnits: expected,
        currency: 'BOB',
      });
    });

    it.each([
      '1,20',
      '1.234',
      '-1.00',
      '1e3',
      '',
      '90071992547409.92',
    ])('rejects invalid or unsafe amount %s', (input) => {
      expect(() => parseBobAmount(input)).toThrow();
    });
  });

  describe('formatBobAmount', () => {
    it('formats thousands and centavos for Spanish-language screens', () => {
      expect(
        formatBobAmount({ minorUnits: 123456, currency: 'BOB' }),
      ).toBe('Bs 1.234,56');
    });

    it('formats zero', () => {
      expect(formatBobAmount({ minorUnits: 0, currency: 'BOB' })).toBe(
        'Bs 0,00',
      );
    });
  });

  describe('addBobAmounts', () => {
    it('adds integer centavos without decimal arithmetic', () => {
      expect(
        addBobAmounts(
          { minorUnits: 125, currency: 'BOB' },
          { minorUnits: 75, currency: 'BOB' },
        ),
      ).toEqual({ minorUnits: 200, currency: 'BOB' });
    });

    it('returns zero for an empty sum', () => {
      expect(addBobAmounts()).toEqual({ minorUnits: 0, currency: 'BOB' });
    });
  });
});
