import { ConflictException } from '@nestjs/common';
import { RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  const makeService = (tx: any) => {
    const prisma = {
      $transaction: jest.fn((callback: (client: any) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    return { service: new RidesService(prisma), prisma };
  };

  it('accepts a ride only after atomically claiming an eligible driver', async () => {
    const tx = {
      driver: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      ride: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ride-1', status: RideStatus.ACCEPTED }),
      },
    };
    const { service } = makeService(tx);

    await expect(service.accept('ride-1', 'driver-1')).resolves.toEqual({
      id: 'ride-1',
      status: RideStatus.ACCEPTED,
    });

    expect(tx.driver.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'driver-1', availability: 'AVAILABLE' }),
      data: { availability: 'ON_TRIP' },
    }));
    expect(tx.ride.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ride-1', status: RideStatus.REQUESTED, driverId: null },
      data: expect.objectContaining({ driverId: 'driver-1', status: RideStatus.ACCEPTED }),
    }));
  });

  it('rejects an acceptance if another operation already claimed the driver', async () => {
    const tx = {
      driver: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ride: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    };
    const { service } = makeService(tx);

    await expect(service.accept('ride-1', 'driver-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.ride.updateMany).not.toHaveBeenCalled();
  });

  it('allows a passenger to cancel only their own unassigned request', async () => {
    const tx = {
      ride: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ride-1',
          passengerId: 'passenger-1',
          driverId: null,
          status: RideStatus.REQUESTED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ride-1', status: RideStatus.CANCELLED }),
      },
      driver: { updateMany: jest.fn() },
    };
    const { service } = makeService(tx);

    await expect(service.cancel('ride-1', {
      role: 'PASSENGER',
      passengerId: 'passenger-1',
    })).resolves.toEqual({ id: 'ride-1', status: RideStatus.CANCELLED });

    expect(tx.ride.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ride-1', status: RideStatus.REQUESTED },
      data: expect.objectContaining({ status: RideStatus.CANCELLED }),
    }));
    expect(tx.driver.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a passenger trying to cancel another passenger ride', async () => {
    const tx = {
      ride: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ride-1',
          passengerId: 'someone-else',
          driverId: null,
          status: RideStatus.REQUESTED,
        }),
        updateMany: jest.fn(),
      },
      driver: { updateMany: jest.fn() },
    };
    const { service } = makeService(tx);

    await expect(service.cancel('ride-1', {
      role: 'PASSENGER',
      passengerId: 'passenger-1',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.ride.updateMany).not.toHaveBeenCalled();
  });

  it('releases the driver after the assigned ride is completed', async () => {
    const tx = {
      ride: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.IN_PROGRESS }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ride-1', status: RideStatus.COMPLETED }),
      },
      driver: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const { service } = makeService(tx);

    await expect(service.advanceStatus('ride-1', 'driver-1', RideStatus.COMPLETED)).resolves.toEqual({
      id: 'ride-1',
      status: RideStatus.COMPLETED,
    });
    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', availability: 'ON_TRIP' },
      data: { availability: 'AVAILABLE' },
    });
  });

  it('rejects an invalid ride state transition', async () => {
    const tx = {
      ride: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.REQUESTED }),
        updateMany: jest.fn(),
      },
      driver: { updateMany: jest.fn() },
    };
    const { service } = makeService(tx);

    await expect(service.advanceStatus('ride-1', 'driver-1', RideStatus.COMPLETED))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.ride.updateMany).not.toHaveBeenCalled();
  });
});
