import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DriverAvailability } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  const makeService = (overrides: Record<string, any> = {}) => {
    const prisma = {
      driver: { findUnique: jest.fn(), update: jest.fn() },
      driverLocation: { upsert: jest.fn(), deleteMany: jest.fn() },
      vehicle: { create: jest.fn() },
      ...overrides,
    } as unknown as PrismaService;
    return { service: new DriversService(prisma), prisma };
  };

  it('rejects invalid GPS coordinates before querying the driver', async () => {
    const { service, prisma } = makeService();
    await expect(service.updateLocation('driver-1', { latitude: 999, longitude: 0 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.driver.findUnique).not.toHaveBeenCalled();
  });

  it('only stores a valid GPS fix for an approved and connected driver', async () => {
    const recordedAt = new Date();
    const { service, prisma } = makeService({
      driver: { findUnique: jest.fn().mockResolvedValue({
        id: 'driver-1', availability: DriverAvailability.AVAILABLE, verifiedAt: recordedAt,
        user: { status: 'ACTIVE' },
      }) },
      driverLocation: { upsert: jest.fn().mockResolvedValue({
        latitude: '-16.5', longitude: '-68.15', recordedAt,
      }) },
    });
    await expect(service.updateLocation('driver-1', { latitude: -16.5, longitude: -68.15 }))
      .resolves.toMatchObject({ latitude: -16.5, longitude: -68.15, recordedAt });
    expect(prisma.driverLocation.upsert).toHaveBeenCalled();
  });

  it('does not store location for an offline driver', async () => {
    const { service, prisma } = makeService({
      driver: { findUnique: jest.fn().mockResolvedValue({
        id: 'driver-1', availability: DriverAvailability.OFFLINE, verifiedAt: new Date(),
        user: { status: 'ACTIVE' },
      }) },
    });
    await expect(service.updateLocation('driver-1', { latitude: -16.5, longitude: -68.15 }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.driverLocation.upsert).not.toHaveBeenCalled();
  });

  it('rejects incomplete vehicle data before querying the driver', async () => {
    const { service, prisma } = makeService();

    await expect(service.addVehicle('driver-1', {
      make: 'Toyota', model: '', color: 'Blanco', plateNumber: '1234', year: 2020,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.driver.findUnique).not.toHaveBeenCalled();
  });

  it('rejects vehicle years outside the accepted range', async () => {
    const { service, prisma } = makeService();

    await expect(service.addVehicle('driver-1', {
      make: 'Toyota', model: 'Corolla', color: 'Blanco', plateNumber: '1234', year: 1970,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it('rejects vehicle fields that exceed their allowed lengths', async () => {
    const { service, prisma } = makeService();

    await expect(service.addVehicle('driver-1', {
      make: 'T'.repeat(61), model: 'Corolla', color: 'Blanco',
      plateNumber: '1234ABC', year: 2020,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.driver.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a vehicle plate that is longer than the accepted limit', async () => {
    const { service, prisma } = makeService();

    await expect(service.addVehicle('driver-1', {
      make: 'Toyota', model: 'Corolla', color: 'Blanco',
      plateNumber: 'A'.repeat(16), year: 2020,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it('rejects a non-object vehicle payload', async () => {
    const { service, prisma } = makeService();

    await expect(service.addVehicle('driver-1', null))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.driver.findUnique).not.toHaveBeenCalled();
  });

  it('stores a valid vehicle normalized and inactive pending approval', async () => {
    const vehicle = { id: 'vehicle-1', plateNumber: '1234ABC', isActive: false };
    const { service, prisma } = makeService({
      driver: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-1' }) },
      vehicle: { create: jest.fn().mockResolvedValue(vehicle) },
    });

    await expect(service.addVehicle('driver-1', {
      make: ' Toyota ', model: ' Corolla ', color: ' Blanco ',
      plateNumber: ' 1234abc ', year: 2020,
    })).resolves.toEqual(vehicle);

    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: {
        driverId: 'driver-1', make: 'Toyota', model: 'Corolla',
        color: 'Blanco', plateNumber: '1234ABC', year: 2020, isActive: false,
      },
    });
  });

  it('rejects duplicate vehicle plates with a conflict response', async () => {
    const { service } = makeService({
      driver: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-1' }) },
      vehicle: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) },
    });

    await expect(service.addVehicle('driver-1', {
      make: 'Toyota', model: 'Corolla', color: 'Blanco', plateNumber: '1234ABC', year: 2020,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow an unverified driver without an active vehicle to connect', async () => {
    const { service, prisma } = makeService({
      driver: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'driver-1', verifiedAt: null, vehicles: [], fleet: null,
          availability: DriverAvailability.OFFLINE,
        }),
        update: jest.fn(),
      },
    });

    await expect(service.setAvailability('driver-1', DriverAvailability.AVAILABLE))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.driver.update).not.toHaveBeenCalled();
  });

  it('does not allow a driver to connect while the associated fleet is suspended', async () => {
    const { service, prisma } = makeService({
      driver: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'driver-1', verifiedAt: new Date(), vehicles: [{ id: 'vehicle-1' }],
          fleet: { status: 'SUSPENDED' }, availability: DriverAvailability.OFFLINE,
        }),
        update: jest.fn(),
      },
    });

    await expect(service.setAvailability('driver-1', DriverAvailability.AVAILABLE))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.driver.update).not.toHaveBeenCalled();
  });

  it('prevents changing availability during an active trip', async () => {
    const { service, prisma } = makeService({
      driver: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'driver-1', verifiedAt: new Date(), vehicles: [{ id: 'vehicle-1' }],
          fleet: null, availability: DriverAvailability.ON_TRIP,
        }),
        update: jest.fn(),
      },
    });

    await expect(service.setAvailability('driver-1', DriverAvailability.OFFLINE))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.driver.update).not.toHaveBeenCalled();
  });


  it('deletes the last shared GPS position when the driver disconnects', async () => {
    const { service, prisma } = makeService({
      driver: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'driver-1', verifiedAt: new Date(), vehicles: [{ id: 'vehicle-1' }],
          fleet: null, availability: DriverAvailability.AVAILABLE,
        }),
        update: jest.fn().mockResolvedValue({ availability: DriverAvailability.OFFLINE }),
      },
    });
    await expect(service.setAvailability('driver-1', DriverAvailability.OFFLINE))
      .resolves.toEqual({ availability: DriverAvailability.OFFLINE });
    expect(prisma.driverLocation.deleteMany).toHaveBeenCalledWith({ where: { driverId: 'driver-1' } });
  });

  it('returns not found when the driver profile does not exist', async () => {
    const { service } = makeService({
      driver: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.addVehicle('missing-driver', {
      make: 'Toyota', model: 'Corolla', color: 'Blanco', plateNumber: '1234ABC', year: 2020,
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
