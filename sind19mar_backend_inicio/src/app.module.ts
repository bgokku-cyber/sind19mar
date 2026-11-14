import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { FleetsModule } from './fleets/fleets.module';
import { HealthModule } from './health/health.module';
import { MapsModule } from './maps/maps.module';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';
import { RoutingModule } from './routing/routing.module';

@Module({ imports: [PrismaModule, AuthModule, DriversModule, AdminModule, FleetsModule, HealthModule, MapsModule, RidesModule, RoutingModule] })
export class AppModule {}
