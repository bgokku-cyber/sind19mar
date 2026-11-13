import { Body, Controller, Get, Param, Post, Query, BadRequestException } from '@nestjs/common';
import { RideStatus } from '@prisma/client';
import { CreateRideDto, validateCreateRide } from './dto/create-ride.dto';
import { RidesService } from './rides.service';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  create(@Body() body: CreateRideDto) {
    const validationError = validateCreateRide(body);
    if (validationError) throw new BadRequestException(validationError);
    return this.ridesService.create(body);
  }

  @Get()
  list(@Query('passengerId') passengerId?: string, @Query('driverId') driverId?: string) {
    return this.ridesService.list({ passengerId, driverId });
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @Body('driverId') driverId: string) {
    return this.ridesService.accept(id, driverId);
  }

  @Post(':id/status')
  advanceStatus(
    @Param('id') id: string,
    @Body('driverId') driverId: string,
    @Body('status') status: RideStatus,
  ) {
    const allowedStatuses = [
      RideStatus.DRIVER_ARRIVING,
      RideStatus.IN_PROGRESS,
      RideStatus.COMPLETED,
    ];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Estado solicitado no válido para esta operación.');
    }
    return this.ridesService.advanceStatus(id, driverId, status);
  }
}
