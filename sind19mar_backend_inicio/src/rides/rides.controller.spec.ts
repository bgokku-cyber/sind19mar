import { BadRequestException } from '@nestjs/common';
import { RidesController } from './rides.controller';

describe('RidesController authenticated identity', () => {
  const rides = {
    create: jest.fn(),
    byPassenger: jest.fn(),
    byDriver: jest.fn(),
    accept: jest.fn(),
    updateStatus: jest.fn(),
  };
  const controller = new RidesController(rides as any);
  const passenger = { sub: 'user-passenger-1', role: 'PASSENGER', iat: 1, exp: 2 } as any;
  const driver = { sub: 'user-driver-1', role: 'DRIVER', iat: 1, exp: 2 } as any;

  beforeEach(() => jest.clearAllMocks());

  it('creates a ride using the authenticated passenger, not a client-supplied ID', () => {
    const body = { originAddress: 'Centro', destinationAddress: 'Sopocachi' };
    controller.create(body, passenger);
    expect(rides.create).toHaveBeenCalledWith(body, 'user-passenger-1');
  });

  it('rejects a passengerId supplied in the request body', () => {
    expect(() => controller.create({ passengerId: 'someone-else' }, passenger))
      .toThrow(BadRequestException);
    expect(rides.create).not.toHaveBeenCalled();
  });

  it('resolves passenger history from the authenticated user', () => {
    controller.byPassenger(passenger);
    expect(rides.byPassenger).toHaveBeenCalledWith('user-passenger-1');
  });

  it('resolves driver requests from the authenticated user', () => {
    controller.byDriver(driver, 'true');
    expect(rides.byDriver).toHaveBeenCalledWith('user-driver-1', true);
  });

  it('accepts a ride without taking driverId from the request body', () => {
    controller.accept('ride-1', driver);
    expect(rides.accept).toHaveBeenCalledWith('ride-1', 'user-driver-1');
  });

  it('rejects driverId in a status update body', () => {
    expect(() => controller.updateStatus('ride-1', { status: 'COMPLETED', driverId: 'other' }, driver))
      .toThrow(BadRequestException);
    expect(rides.updateStatus).not.toHaveBeenCalled();
  });
});
