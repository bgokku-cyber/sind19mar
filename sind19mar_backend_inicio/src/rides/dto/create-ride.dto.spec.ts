import { PaymentMethod } from '@prisma/client';
import { validateCreateRide } from './create-ride.dto';

describe('validateCreateRide', () => {
  const valid = {
    passengerId: 'passenger_1',
    originAddress: 'Plaza Murillo, La Paz',
    originLatitude: -16.495,
    originLongitude: -68.133,
    destinationAddress: 'Terminal de Buses, La Paz',
    destinationLatitude: -16.489,
    destinationLongitude: -68.148,
    estimatedFare: 25,
    paymentMethod: PaymentMethod.CASH,
    routeQuoteToken: 'signed-quote-token',
  };

  it('accepts a valid ride request', () => {
    expect(validateCreateRide(valid)).toBeNull();
  });

  it('rejects missing passenger identity', () => {
    expect(validateCreateRide({ ...valid, passengerId: ' ' })).toContain('passengerId');
  });

  it('rejects coordinates outside geographic bounds', () => {
    expect(validateCreateRide({ ...valid, originLatitude: 91 })).toContain('latitud');
  });

  it('rejects negative estimated fares', () => {
    expect(validateCreateRide({ ...valid, estimatedFare: -1 })).toContain('negativa');
  });

  it('rejects unsupported payment methods', () => {
    expect(validateCreateRide({ ...valid, paymentMethod: 'CARD' as PaymentMethod })).toContain('método de pago');
  });
});
