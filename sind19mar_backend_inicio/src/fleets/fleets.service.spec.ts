import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FleetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FleetsService } from './fleets.service';

describe('FleetsService', () => {
  const makeService = (overrides: Record<string, any> = {}) => {
    const prisma = {
      fleet: {
        findUnique: jest.fn(),
      },
      driver: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      ...overrides,
    } as unknown as PrismaService;
    return { service: new FleetsService(prisma), prisma };
  };

  it('rejects a phone number that is too short', async () => {
    const { service, prisma } = makeService();

    await expect(service.addDriver('manager-1', '123'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.fleet.findUnique).not.toHaveBeenCalled();
  });

  it('does not allow a pending fleet to add drivers', async () => {
    const { service, prisma } = makeService({
      fleet: { findUnique: jest.fn().mockResolvedValue({ id: 'fleet-1', status: FleetStatus.PENDING }) },
    });

    await expect(service.addDriver('manager-1', '70012345'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.driver.findFirst).not.toHaveBeenCalled();
  });

  it('only searches for active, verified, independent drivers', async () => {
    const { service, prisma } = makeService({
      fleet: { findUnique: jest.fn().mockResolvedValue({ id: 'fleet-1', status: FleetStatus.ACTIVE }) },
      driver: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.addDriver('manager-1', '700 12-345'))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.driver.findFirst).toHaveBeenCalledWith({
      where: {
        user: { phone: '70012345', role: 'DRIVER', status: 'ACTIVE' },
        verifiedAt: { not: null },
        fleetId: null,
      },
    });
  });

  it('rejects a concurrent association if the driver was claimed by another fleet', async () => {
    const { service, prisma } = makeService({
      fleet: { findUnique: jest.fn().mockResolvedValue({ id: 'fleet-1', status: FleetStatus.ACTIVE }) },
      driver: {
        findFirst: jest.fn().mockResolvedValue({ id: 'driver-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
    });

    await expect(service.addDriver('manager-1', '70012345'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', fleetId: null },
      data: { fleetId: 'fleet-1' },
    });
    expect(prisma.driver.findUnique).not.toHaveBeenCalled();
  });

  it('associates an eligible independent driver with the active fleet', async () => {
    const associated = { id: 'driver-1', fleetId: 'fleet-1' };
    const { service, prisma } = makeService({
      fleet: { findUnique: jest.fn().mockResolvedValue({ id: 'fleet-1', status: FleetStatus.ACTIVE }) },
      driver: {
        findFirst: jest.fn().mockResolvedValue({ id: 'driver-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(associated),
      },
    });

    await expect(service.addDriver('manager-1', '70012345')).resolves.toEqual(associated);
    expect(prisma.driver.findUnique).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      include: { user: { select: { fullName: true, phone: true } }, vehicles: true },
    });
  });

  it('returns only the fleet belonging to the requesting manager', async () => {
    const fleet = { id: 'fleet-1', managerUserId: 'manager-1', drivers: [] };
    const { service, prisma } = makeService({
      fleet: { findUnique: jest.fn().mockResolvedValue(fleet) },
    });

    await expect(service.getMine('manager-1')).resolves.toEqual(fleet);
    expect(prisma.fleet.findUnique).toHaveBeenCalledWith({
      where: { managerUserId: 'manager-1' },
      include: {
        drivers: {
          include: {
            user: { select: { id: true, fullName: true, phone: true, status: true } },
            vehicles: true,
          },
        },
      },
    });
  });
});
