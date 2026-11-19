import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FleetsController } from './fleets.controller';
import { FleetsService } from './fleets.service';

describe('FleetsController', () => {
  const makeController = () => {
    const fleets = {
      getMine: jest.fn().mockResolvedValue({ id: 'fleet-1' }),
      addDriver: jest.fn().mockResolvedValue({ id: 'driver-1' }),
    } as unknown as FleetsService;
    return { controller: new FleetsController(fleets), fleets };
  };

  it('blocks passengers from viewing fleet information', () => {
    const { controller, fleets } = makeController();
    expect(() => controller.getMine({ user: { role: UserRole.PASSENGER, id: 'p-1' } }))
      .toThrow(ForbiddenException);
    expect(fleets.getMine).not.toHaveBeenCalled();
  });

  it('blocks drivers from adding other drivers to a fleet', () => {
    const { controller, fleets } = makeController();
    expect(() => controller.addDriver({
      user: { role: UserRole.DRIVER, id: 'd-1' },
    }, '70000000')).toThrow(ForbiddenException);
    expect(fleets.addDriver).not.toHaveBeenCalled();
  });

  it('uses the authenticated manager id to read their fleet', async () => {
    const { controller, fleets } = makeController();
    await expect(controller.getMine({
      user: { role: UserRole.FLEET_MANAGER, id: 'manager-auth' },
    })).resolves.toEqual({ id: 'fleet-1' });
    expect(fleets.getMine).toHaveBeenCalledWith('manager-auth');
  });

  it('uses the authenticated manager id when adding a driver', async () => {
    const { controller, fleets } = makeController();
    await expect(controller.addDriver({
      user: { role: UserRole.FLEET_MANAGER, id: 'manager-auth' },
    }, '70000000')).resolves.toEqual({ id: 'driver-1' });
    expect(fleets.addDriver).toHaveBeenCalledWith('manager-auth', '70000000');
  });
});
