import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

@Module({
  imports: [AuthModule],
  controllers: [RoutingController],
  providers: [RoutingService, JwtAuthGuard],
  exports: [RoutingService],
})
export class RoutingModule {}
