import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, RidesModule],
})
export class AppModule {}
