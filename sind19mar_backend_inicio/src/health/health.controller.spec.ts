import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const createController = () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    return { controller: new HealthController(prisma), prisma };
  };

  it('reports liveness without depending on the database', () => {
    const { controller, prisma } = createController();

    expect(controller.check()).toEqual({
      status: 'ok',
      service: 'sind19mar-api',
      version: '0.1.0',
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports ready when PostgreSQL answers', async () => {
    const { controller, prisma } = createController();
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ready',
      service: 'sind19mar-api',
      dependencies: { database: 'ok' },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    const { controller, prisma } = createController();
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('connection refused'));

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
