import { ForbiddenException } from '@nestjs/common';
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
    prisma.driver.findUnique.mockResolvedValue({
      id: 'driver-1',
      verifiedAt: new Date(),
      user: { status: 'ACTIVE' },
    });
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


describe('RidesService.byDriver eligibility', () => {
  const prisma = {
    driver: { findUnique: jest.fn() },
    ride: { findMany: jest.fn() },
  } as any;
  let service: RidesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RidesService(prisma);
  });

  it('rejects a suspended driver before reading any rides', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      id: 'driver-1',
      verifiedAt: new Date(),
      user: { status: 'SUSPENDED' },
    });

    await expect(service.byDriver('driver-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ride.findMany).not.toHaveBeenCalled();
  });

  it('rejects an unverified driver before reading any rides', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      id: 'driver-1',
      verifiedAt: null,
      user: { status: 'ACTIVE' },
    });

    await expect(service.byDriver('driver-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ride.findMany).not.toHaveBeenCalled();
  });
});
