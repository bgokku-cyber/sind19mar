import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ imports: [AuthModule], controllers: [AdminController], providers: [AdminService, JwtAuthGuard] })
export class AdminModule {}
