import { RidesService } from './rides.service';

describe('RidesService.byDriver passenger contact privacy', () => {
  const prisma = {
    driver: { findUnique: jest.fn() },
    ride: { findMany: jest.fn() },
  } as any;
  let service: RidesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RidesService(prisma);
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
  });

  it('hides the passenger phone on an open request and keeps it on an assigned ride', async () => {
    prisma.ride.findMany.mockResolvedValue([
      {
        id: 'open-ride',
        status: 'REQUESTED',
        driverId: null,
        passenger: { user: { fullName: 'Pasajero de prueba', phone: '+59170000001' } },
      },
      {
        id: 'assigned-ride',
        status: 'ACCEPTED',
        driverId: 'driver-1',
        passenger: { user: { fullName: 'Pasajero asignado', phone: '+59170000002' } },
      },
    ]);

    const result = await service.byDriver('driver-1');

    expect(result[0].passenger.user.fullName).toBe('Pasajero de prueba');
    expect(result[0].passenger.user.phone).toBeUndefined();
    expect(result[1].passenger.user.phone).toBe('+59170000002');
  });
});
