import { Body, Controller, Get, Param, Post, Query, BadRequestException, ForbiddenException, Req, UseGuards } from '@nestjs/common';
import { RideStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRideDto, validateCreateRide } from './dto/create-ride.dto';
import { RidesService } from './rides.service';

@Controller('rides')
@UseGuards(JwtAuthGuard)
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  create(@Body() body: Omit<CreateRideDto, 'passengerId'>, @Req() request: any) {
    if (request.user.role !== UserRole.PASSENGER || !request.user.passenger) throw new ForbiddenException('Solo un pasajero puede solicitar un viaje.');
    const input = { ...body, passengerId: request.user.passenger.id } as CreateRideDto;
    const validationError = validateCreateRide(input);
    if (validationError) throw new BadRequestException(validationError);
    return this.ridesService.create(input);
  }

  @Get()
  list(@Query('passengerId') passengerId: string | undefined, @Query('driverId') driverId: string | undefined, @Req() request: any) {
    if (request.user.role === UserRole.PASSENGER && request.user.passenger) return this.ridesService.list({ passengerId: request.user.passenger.id });
    if (request.user.role === UserRole.DRIVER && request.user.driver) return this.ridesService.list({ driverId: request.user.driver.id });
    throw new ForbiddenException('No tienes permiso para consultar estos viajes.');
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @Req() request: any) {
    if (request.user.role !== UserRole.DRIVER || !request.user.driver) throw new ForbiddenException('Solo un conductor puede aceptar viajes.');
    return this.ridesService.accept(id, request.user.driver.id);
  }

  @Post(':id/status')
  advanceStatus(@Param('id') id: string, @Body('status') status: RideStatus, @Req() request: any) {
    if (request.user.role !== UserRole.DRIVER || !request.user.driver) throw new ForbiddenException('Solo el conductor asignado puede actualizar el viaje.');
    const allowedStatuses = [RideStatus.DRIVER_ARRIVING, RideStatus.IN_PROGRESS, RideStatus.COMPLETED];
    if (!allowedStatuses.includes(status)) throw new BadRequestException('Estado solicitado no válido para esta operación.');
    return this.ridesService.advanceStatus(id, request.user.driver.id, status);
  }
}
