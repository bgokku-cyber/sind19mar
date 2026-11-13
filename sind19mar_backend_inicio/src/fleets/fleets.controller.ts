import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FleetsService } from './fleets.service';

@Controller('fleets')
@UseGuards(JwtAuthGuard)
export class FleetsController {
  constructor(private readonly fleets: FleetsService) {}

  private managerId(request: any) {
    if (request.user.role !== UserRole.FLEET_MANAGER) throw new ForbiddenException('Solo un responsable de flota puede acceder a este recurso.');
    return request.user.id;
  }

  @Get('me')
  getMine(@Req() request: any) { return this.fleets.getMine(this.managerId(request)); }

  @Post('me/drivers')
  addDriver(@Req() request: any, @Body('phone') phone: string) { return this.fleets.addDriver(this.managerId(request), phone); }
}
