import { ForbiddenException } from '@nestjs/common';
import { DriverAvailability, UserRole } from '@prisma/client';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

describe('DriversController', () => {
  const makeController = () => {
    const drivers = {
      getProfile: jest.fn().mockResolvedValue({ id: 'driver-1' }),
      addVehicle: jest.fn().mockResolvedValue({ id: 'vehicle-1' }),
      setAvailability: jest.fn().mockResolvedValue({ availability: DriverAvailability.AVAILABLE }),
      updateLocation: jest.fn().mockResolvedValue({ latitude: -16.5, longitude: -68.15 }),
    } as unknown as DriversService;
    return { controller: new DriversController(drivers), drivers };
  };

  it('blocks passengers from submitting a driver location', () => {
    const { controller, drivers } = makeController();
    expect(() => controller.updateLocation({
      user: { role: UserRole.PASSENGER, passenger: { id: 'passenger-1' } },
    }, { latitude: -16.5, longitude: -68.15 })).toThrow(ForbiddenException);
    expect(drivers.updateLocation).not.toHaveBeenCalled();
  });

  it('uses the authenticated driver id when storing GPS coordinates', async () => {
    const { controller, drivers } = makeController();
    const coords = { latitude: -16.5, longitude: -68.15 };
    await expect(controller.updateLocation({
      user: { role: UserRole.DRIVER, driver: { id: 'driver-authenticated' } },
    }, coords)).resolves.toEqual(coords);
    expect(drivers.updateLocation).toHaveBeenCalledWith('driver-authenticated', coords);
  });

  it('blocks passengers from reading a driver profile', () => {
    const { controller, drivers } = makeController();

    expect(() => controller.profile({
      user: { role: UserRole.PASSENGER, passenger: { id: 'passenger-1' } },
    })).toThrow(ForbiddenException);
    expect(drivers.getProfile).not.toHaveBeenCalled();
  });

  it('blocks fleet managers from registering vehicles as a driver', () => {
    const { controller, drivers } = makeController();

    expect(() => controller.addVehicle({
      user: { role: UserRole.FLEET_MANAGER, id: 'manager-1' },
    }, { make: 'Toyota' })).toThrow(ForbiddenException);
    expect(drivers.addVehicle).not.toHaveBeenCalled();
  });

  it('blocks accounts without a driver profile even when their role is DRIVER', () => {
    const { controller, drivers } = makeController();

    expect(() => controller.setAvailability({
      user: { role: UserRole.DRIVER, driver: null },
    }, DriverAvailability.AVAILABLE)).toThrow(ForbiddenException);
    expect(drivers.setAvailability).not.toHaveBeenCalled();
  });

  it('uses the authenticated driver profile id when reading the profile', async () => {
    const { controller, drivers } = makeController();

    await expect(controller.profile({
      user: { role: UserRole.DRIVER, driver: { id: 'driver-authenticated' } },
    })).resolves.toEqual({ id: 'driver-1' });
    expect(drivers.getProfile).toHaveBeenCalledWith('driver-authenticated');
  });

  it('uses the authenticated driver profile id when adding a vehicle', async () => {
    const { controller, drivers } = makeController();

    await expect(controller.addVehicle({
      user: { role: UserRole.DRIVER, driver: { id: 'driver-authenticated' } },
    }, { make: 'Toyota' })).resolves.toEqual({ id: 'vehicle-1' });
    expect(drivers.addVehicle).toHaveBeenCalledWith('driver-authenticated', { make: 'Toyota' });
  });
});
