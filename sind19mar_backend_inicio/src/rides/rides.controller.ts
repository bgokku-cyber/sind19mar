import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RidesService } from './rides.service';

@Controller('rides')
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.rides.create(body);
  }

  @Get('passenger/:passengerId')
  byPassenger(@Param('passengerId') passengerId: string) {
    return this.rides.byPassenger(passengerId);
  }

  @Get('driver/:driverId')
  byDriver(@Param('driverId') driverId: string, @Query('active') active?: string) {
    return this.rides.byDriver(driverId, active === 'true');
  }

  @Patch(':rideId/accept')
  accept(@Param('rideId') rideId: string, @Body() body: Record<string, unknown>) {
    return this.rides.accept(rideId, body.driverId);
  }

  @Patch(':rideId/status')
  updateStatus(@Param('rideId') rideId: string, @Body() body: Record<string, unknown>) {
    return this.rides.updateStatus(rideId, body.status, body.driverId);
  }
}
