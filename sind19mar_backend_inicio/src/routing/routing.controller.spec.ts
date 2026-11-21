import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

describe('RoutingController', () => {
  const makeController = () => {
    const routing = { quote: jest.fn().mockResolvedValue({ distanceKm: 3, durationMinutes: 10, fare: null }) } as unknown as RoutingService;
    return { controller: new RoutingController(routing), routing };
  };

  it('allows a passenger to request a route quote with coordinate values', async () => {
    const { controller, routing } = makeController();
    await controller.quote('-16.5', '-68.15', '-16.51', '-68.14', { user: { role: UserRole.PASSENGER } });
    expect(routing.quote).toHaveBeenCalledWith(
      { latitude: -16.5, longitude: -68.15 },
      { latitude: -16.51, longitude: -68.14 },
    );
  });

  it('rejects non-passenger roles', () => {
    const { controller, routing } = makeController();
    expect(() => controller.quote('-16.5', '-68.15', '-16.51', '-68.14', {
      user: { role: UserRole.DRIVER },
    })).toThrow(ForbiddenException);
    expect(routing.quote).not.toHaveBeenCalled();
  });
});
