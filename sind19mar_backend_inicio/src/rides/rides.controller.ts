import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RidesService } from './rides.service';

@Controller('rides')
@UseGuards(JwtAuthGuard)
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  @Roles('PASSENGER')
  create(
    @Body() body: Record<string, unknown>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if ('passengerId' in body) {
      throw new BadRequestException('passengerId se obtiene de la sesión y no debe enviarse.');
    }
    return this.rides.create(body, actor.sub);
  }

  @Get('passenger/me')
  @Roles('PASSENGER')
  byPassenger(@CurrentUser() actor: AuthenticatedUser) {
    return this.rides.byPassenger(actor.sub);
  }

  @Get('driver/me')
  @Roles('DRIVER')
  byDriver(@CurrentUser() actor: AuthenticatedUser, @Query('active') active?: string) {
    return this.rides.byDriver(actor.sub, active === 'true');
  }

  @Patch(':rideId/accept')
  @Roles('DRIVER')
  accept(
    @Param('rideId') rideId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rides.accept(rideId, actor.sub);
  }

  @Patch(':rideId/status')
  @Roles('DRIVER')
  updateStatus(
    @Param('rideId') rideId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if ('driverId' in body) {
      throw new BadRequestException('driverId se obtiene de la sesión y no debe enviarse.');
    }
    return this.rides.updateStatus(rideId, body.status, actor.sub);
  }
}
