import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';

@Module({
  imports: [PrismaModule, HealthModule, RidesModule],
})
export class AppModule {}
