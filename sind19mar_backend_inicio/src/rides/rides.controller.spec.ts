import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentMethod, RideStatus, UserRole } from '@prisma/client';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

describe('RidesController', () => {
  const makeController = () => {
    const ridesService = {
      create: jest.fn().mockResolvedValue({ id: 'ride-1' }),
      listAvailable: jest.fn().mockResolvedValue([]),
      list: jest.fn().mockResolvedValue([]),
      accept: jest.fn().mockResolvedValue({ id: 'ride-1' }),
      cancel: jest.fn().mockResolvedValue({ id: 'ride-1' }),
      advanceStatus: jest.fn().mockResolvedValue({ id: 'ride-1' }),
    } as unknown as RidesService;
    return { controller: new RidesController(ridesService), ridesService };
  };

  it('blocks non-passengers from creating rides', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.create({ pickupAddress: 'Centro', dropoffAddress: 'Sopocachi' } as any, {
      user: { role: UserRole.DRIVER, driver: { id: 'driver-1' } },
    })).toThrow(ForbiddenException);
    expect(ridesService.create).not.toHaveBeenCalled();
  });

  it('uses the authenticated passenger id and validates ride input', async () => {
    const { controller, ridesService } = makeController();
    await expect(controller.create({
      originAddress: 'Centro', originLatitude: -16.5, originLongitude: -68.15, destinationAddress: 'Sopocachi', destinationLatitude: -16.52, destinationLongitude: -68.12, paymentMethod: PaymentMethod.CASH, routeQuoteToken: 'signed-quote-token',
    } as any, { user: { role: UserRole.PASSENGER, passenger: { id: 'passenger-auth' } } }))
      .resolves.toEqual({ id: 'ride-1' });
    expect(ridesService.create).toHaveBeenCalledWith(expect.objectContaining({ passengerId: 'passenger-auth' }));
  });

  it('rejects invalid ride input before calling the service', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.create({ originAddress: '', originLatitude: -16.5, originLongitude: -68.15, destinationAddress: '', destinationLatitude: -16.52, destinationLongitude: -68.12, paymentMethod: PaymentMethod.CASH } as any, {
      user: { role: UserRole.PASSENGER, passenger: { id: 'passenger-1' } },
    })).toThrow(BadRequestException);
    expect(ridesService.create).not.toHaveBeenCalled();
  });

  it('blocks passengers from viewing available ride requests', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.listAvailable({ user: { role: UserRole.PASSENGER, passenger: { id: 'p-1' } } }))
      .toThrow(ForbiddenException);
    expect(ridesService.listAvailable).not.toHaveBeenCalled();
  });

  it('scopes passenger ride history to the authenticated passenger', () => {
    const { controller, ridesService } = makeController();
    controller.list('other-passenger', 'other-driver', {
      user: { role: UserRole.PASSENGER, passenger: { id: 'passenger-auth' } },
    });
    expect(ridesService.list).toHaveBeenCalledWith({ passengerId: 'passenger-auth' });
  });

  it('scopes driver ride history to the authenticated driver', () => {
    const { controller, ridesService } = makeController();
    controller.list('other-passenger', 'other-driver', {
      user: { role: UserRole.DRIVER, driver: { id: 'driver-auth' } },
    });
    expect(ridesService.list).toHaveBeenCalledWith({ driverId: 'driver-auth' });
  });

  it('blocks fleet managers from querying ride history', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.list(undefined, undefined, {
      user: { role: UserRole.FLEET_MANAGER, id: 'manager-1' },
    })).toThrow(ForbiddenException);
    expect(ridesService.list).not.toHaveBeenCalled();
  });

  it('blocks non-drivers from accepting rides', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.accept('ride-1', {
      user: { role: UserRole.PASSENGER, passenger: { id: 'p-1' } },
    })).toThrow(ForbiddenException);
    expect(ridesService.accept).not.toHaveBeenCalled();
  });

  it('blocks non-drivers from advancing ride status', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.advanceStatus('ride-1', RideStatus.COMPLETED, {
      user: { role: UserRole.PASSENGER, passenger: { id: 'p-1' } },
    })).toThrow(ForbiddenException);
    expect(ridesService.advanceStatus).not.toHaveBeenCalled();
  });

  it('rejects statuses outside the driver workflow', () => {
    const { controller, ridesService } = makeController();
    expect(() => controller.advanceStatus('ride-1', RideStatus.CANCELLED, {
      user: { role: UserRole.DRIVER, driver: { id: 'driver-1' } },
    })).toThrow(BadRequestException);
    expect(ridesService.advanceStatus).not.toHaveBeenCalled();
  });
});
