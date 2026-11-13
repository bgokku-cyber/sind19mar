import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ controllers: [AdminController], providers: [AdminService, JwtAuthGuard] })
export class AdminModule {}
