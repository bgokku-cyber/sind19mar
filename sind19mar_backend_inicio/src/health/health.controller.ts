import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: confirma que el proceso HTTP está respondiendo.
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'sind19mar-api',
      version: '0.1.0',
    };
  }

  // Readiness: confirma que la API también puede comunicarse con PostgreSQL.
  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        service: 'sind19mar-api',
        dependencies: { database: 'ok' },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'sind19mar-api',
        dependencies: { database: 'unavailable' },
      });
    }
  }
}
