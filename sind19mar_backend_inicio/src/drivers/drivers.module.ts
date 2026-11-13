import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ imports: [AuthModule], controllers: [DriversController], providers: [DriversService, JwtAuthGuard] })
export class DriversModule {}
