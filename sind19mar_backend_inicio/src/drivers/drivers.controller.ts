import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException, Patch } from '@nestjs/common';
import { DriverAvailability, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  private driverId(request: any) {
    if (request.user.role !== UserRole.DRIVER || !request.user.driver) throw new ForbiddenException('Solo los conductores pueden acceder a este recurso.');
    return request.user.driver.id;
  }

  @Get('me')
  profile(@Req() request: any) { return this.drivers.getProfile(this.driverId(request)); }

  @Post('me/vehicles')
  addVehicle(@Req() request: any, @Body() body: any) { return this.drivers.addVehicle(this.driverId(request), body); }

  @Post('me/location')
  updateLocation(@Req() request: any, @Body() body: any) { return this.drivers.updateLocation(this.driverId(request), body); }

  @Patch('me/availability')
  setAvailability(@Req() request: any, @Body('availability') availability: DriverAvailability) { return this.drivers.setAvailability(this.driverId(request), availability); }
}
