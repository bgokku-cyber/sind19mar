import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';

@Module({ imports: [PrismaModule, AuthModule, DriversModule, AdminModule, HealthModule, RidesModule] })
export class AppModule {}
