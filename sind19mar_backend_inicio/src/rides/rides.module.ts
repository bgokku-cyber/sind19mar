import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({ imports: [AuthModule], controllers: [RidesController], providers: [RidesService, JwtAuthGuard] })
export class RidesModule {}
