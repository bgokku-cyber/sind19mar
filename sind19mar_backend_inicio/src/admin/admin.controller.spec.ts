import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  const makeController = () => {
    const admin = {
      listRecentRides: jest.fn().mockResolvedValue([]),
      pendingDrivers: jest.fn().mockResolvedValue([]),
      pendingFleets: jest.fn().mockResolvedValue([]),
      approveFleet: jest.fn(),
      approveDriver: jest.fn(),
      approveVehicle: jest.fn(),
      suspendUser: jest.fn(),
    } as unknown as AdminService;
    return { controller: new AdminController(admin), admin };
  };

  it('blocks passengers from administrative endpoints', () => {
    const { controller, admin } = makeController();

    expect(() => controller.recentRides({ user: { role: UserRole.PASSENGER } }))
      .toThrow(ForbiddenException);
    expect(admin.listRecentRides).not.toHaveBeenCalled();
  });

  it('blocks drivers from administrative endpoints', () => {
    const { controller, admin } = makeController();

    expect(() => controller.pendingDrivers({ user: { role: UserRole.DRIVER } }))
      .toThrow(ForbiddenException);
    expect(admin.pendingDrivers).not.toHaveBeenCalled();
  });

  it('blocks fleet managers from administrative endpoints', () => {
    const { controller, admin } = makeController();

    expect(() => controller.pendingFleets({ user: { role: UserRole.FLEET_MANAGER } }))
      .toThrow(ForbiddenException);
    expect(admin.pendingFleets).not.toHaveBeenCalled();
  });

  it('allows an administrator to consult recent rides', async () => {
    const { controller, admin } = makeController();

    await expect(controller.recentRides({ user: { role: UserRole.ADMIN } })).resolves.toEqual([]);
    expect(admin.listRecentRides).toHaveBeenCalledTimes(1);
  });

  it('checks administrator role before approving a fleet', () => {
    const { controller, admin } = makeController();

    expect(() => controller.approveFleet(
      { user: { role: UserRole.PASSENGER } },
      'fleet-1',
    )).toThrow(ForbiddenException);
    expect(admin.approveFleet).not.toHaveBeenCalled();
  });
});
