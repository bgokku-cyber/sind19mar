import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ controllers: [DriversController], providers: [DriversService, JwtAuthGuard] })
export class DriversModule {}
