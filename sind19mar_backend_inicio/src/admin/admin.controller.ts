import { Body, Controller, ForbiddenException, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  private assertAdmin(request: any) {
    if (request.user.role !== UserRole.ADMIN) throw new ForbiddenException('Se requiere permiso de administrador.');
  }

  @Get('drivers/pending')
  pendingDrivers(@Req() request: any) { this.assertAdmin(request); return this.admin.pendingDrivers(); }

  @Get('fleets/pending')
  pendingFleets(@Req() request: any) { this.assertAdmin(request); return this.admin.pendingFleets(); }

  @Patch('fleets/:id/approve')
  approveFleet(@Req() request: any, @Param('id') id: string) { this.assertAdmin(request); return this.admin.approveFleet(id); }

  @Patch('drivers/:id/approve')
  approveDriver(@Req() request: any, @Param('id') id: string) { this.assertAdmin(request); return this.admin.approveDriver(id); }

  @Patch('vehicles/:id/approve')
  approveVehicle(@Req() request: any, @Param('id') id: string) { this.assertAdmin(request); return this.admin.approveVehicle(id); }

  @Patch('users/:id/suspend')
  suspendUser(@Req() request: any, @Param('id') id: string) { this.assertAdmin(request); return this.admin.suspendUser(id); }
}
