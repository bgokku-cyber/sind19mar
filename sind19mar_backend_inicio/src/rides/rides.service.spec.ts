import { ConflictException } from '@nestjs/common';
import { PaymentMethod, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RidesService } from './rides.service';

type TransactionMock = {
  ride: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    updateMany: jest.Mock;
  };
  driver: {
    updateMany: jest.Mock;
  };
};

describe('RidesService critical transitions', () => {
  let tx: TransactionMock;
  let prisma: PrismaService;
  let service: RidesService;

  beforeEach(() => {
    tx = {
      ride: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      driver: {
        updateMany: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(
        async (callback: (client: TransactionMock) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaService;

    service = new RidesService(prisma);
  });

  it('claims an available verified driver before assigning a requested ride', async () => {
    const ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.ACCEPTED,
      paymentMethod: PaymentMethod.CASH,
    };
    tx.driver.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.findUniqueOrThrow.mockResolvedValue(ride);

    await expect(service.accept('ride-1', 'driver-1')).resolves.toBe(ride);

    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'driver-1',
        availability: 'AVAILABLE',
        verifiedAt: { not: null },
        user: { status: 'ACTIVE' },
        vehicles: { some: { isActive: true } },
        OR: [{ fleetId: null }, { fleet: { is: { status: 'ACTIVE' } } }],
      },
      data: { availability: 'ON_TRIP' },
    });
    expect(tx.ride.updateMany).toHaveBeenCalledWith({
      where: { id: 'ride-1', status: RideStatus.REQUESTED, driverId: null },
      data: expect.objectContaining({
        driverId: 'driver-1',
        status: RideStatus.ACCEPTED,
        acceptedAt: expect.any(Date),
      }),
    });
  });

  it('completes a ride and releases the assigned driver', async () => {
    const completedRide = { id: 'ride-1', status: RideStatus.COMPLETED };
    tx.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.IN_PROGRESS,
    });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.driver.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.findUniqueOrThrow.mockResolvedValue(completedRide);

    await expect(
      service.advanceStatus('ride-1', 'driver-1', RideStatus.COMPLETED),
    ).resolves.toBe(completedRide);

    expect(tx.ride.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ride-1',
        driverId: 'driver-1',
        status: RideStatus.IN_PROGRESS,
      },
      data: expect.objectContaining({
        status: RideStatus.COMPLETED,
        completedAt: expect.any(Date),
      }),
    });
    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', availability: 'ON_TRIP' },
      data: { availability: 'AVAILABLE' },
    });
  });

  it('rejects a ride status transition that skips the allowed sequence', async () => {
    tx.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.REQUESTED,
    });

    await expect(
      service.advanceStatus('ride-1', 'driver-1', RideStatus.COMPLETED),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.ride.updateMany).not.toHaveBeenCalled();
    expect(tx.driver.updateMany).not.toHaveBeenCalled();
  });

  it('releases the driver when an administrator cancels an accepted ride', async () => {
    const cancelledRide = { id: 'ride-1', status: RideStatus.CANCELLED };
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passengerId: 'passenger-1',
      driverId: 'driver-1',
      status: RideStatus.ACCEPTED,
    });
    tx.ride.updateMany.mockResolvedValue({ count: 1 });
    tx.driver.updateMany.mockResolvedValue({ count: 1 });
    tx.ride.findUniqueOrThrow.mockResolvedValue(cancelledRide);

    await expect(
      service.cancel('ride-1', { role: 'ADMIN' }),
    ).resolves.toBe(cancelledRide);

    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', availability: 'ON_TRIP' },
      data: { availability: 'AVAILABLE' },
    });
  });

  it('does not let a passenger cancel a ride after it has been accepted', async () => {
    tx.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passengerId: 'passenger-1',
      driverId: 'driver-1',
      status: RideStatus.ACCEPTED,
    });

    await expect(
      service.cancel('ride-1', {
        role: 'PASSENGER',
        passengerId: 'passenger-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.ride.updateMany).not.toHaveBeenCalled();
    expect(tx.driver.updateMany).not.toHaveBeenCalled();
  });
});
