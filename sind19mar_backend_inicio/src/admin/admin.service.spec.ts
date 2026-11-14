import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountStatus, FleetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const makeService = (overrides: Record<string, any> = {}) => {
    const prisma = {
      $transaction: jest.fn(),
      fleet: { findMany: jest.fn() },
      driver: { findMany: jest.fn() },
      vehicle: { findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      ...overrides,
    } as unknown as PrismaService;
    return { service: new AdminService(prisma), prisma };
  };

  it('approves a pending fleet and activates its manager atomically', async () => {
    const fleet = { id: 'fleet-1', managerUserId: 'manager-1', status: FleetStatus.PENDING };
    const updatedFleet = { ...fleet, status: FleetStatus.ACTIVE };
    const tx = {
      fleet: {
        findUnique: jest.fn().mockResolvedValue(fleet),
        update: jest.fn().mockResolvedValue(updatedFleet),
      },
      user: { update: jest.fn().mockResolvedValue({ id: 'manager-1', status: AccountStatus.ACTIVE }) },
    };
    const { service, prisma } = makeService({
      $transaction: jest.fn((callback: (tx: any) => unknown) => callback(tx)),
    });

    await expect(service.approveFleet('fleet-1')).resolves.toEqual(updatedFleet);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'manager-1' },
      data: { status: AccountStatus.ACTIVE },
    });
    expect(tx.fleet.update).toHaveBeenCalledWith({
      where: { id: 'fleet-1' },
      data: { status: FleetStatus.ACTIVE },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns not found when approving an unknown fleet', async () => {
    const tx = {
      fleet: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      user: { update: jest.fn() },
    };
    const { service } = makeService({
      $transaction: jest.fn((callback: (tx: any) => unknown) => callback(tx)),
    });

    await expect(service.approveFleet('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('does not approve a driver until at least one active vehicle exists', async () => {
    const tx = {
      driver: {
        findUnique: jest.fn().mockResolvedValue({ id: 'driver-1', userId: 'user-1', vehicles: [] }),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
    };
    const { service } = makeService({
      $transaction: jest.fn((callback: (tx: any) => unknown) => callback(tx)),
    });

    await expect(service.approveDriver('driver-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.driver.update).not.toHaveBeenCalled();
  });

  it('approves a driver and activates the account when an active vehicle exists', async () => {
    const driver = { id: 'driver-1', userId: 'user-1', vehicles: [{ id: 'vehicle-1', isActive: true }] };
    const approved = { id: 'driver-1', verifiedAt: new Date('2026-01-01T00:00:00.000Z') };
    const tx = {
      driver: {
        findUnique: jest.fn().mockResolvedValue(driver),
        update: jest.fn().mockResolvedValue(approved),
      },
      user: { update: jest.fn().mockResolvedValue({ id: 'user-1', status: AccountStatus.ACTIVE }) },
    };
    const { service } = makeService({
      $transaction: jest.fn((callback: (tx: any) => unknown) => callback(tx)),
    });

    await expect(service.approveDriver('driver-1')).resolves.toEqual(approved);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: AccountStatus.ACTIVE },
    });
    expect(tx.driver.update).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { verifiedAt: expect.any(Date) },
    });
  });

  it('does not silently re-approve vehicle changes after driver verification', async () => {
    const { service, prisma } = makeService({
      vehicle: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'vehicle-1',
          driver: { verifiedAt: new Date('2026-01-01T00:00:00.000Z') },
        }),
        update: jest.fn(),
      },
    });

    await expect(service.approveVehicle('vehicle-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });
});
