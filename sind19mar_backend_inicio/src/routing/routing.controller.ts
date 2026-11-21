import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoutingService } from './routing.service';

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}

  @Get('quote')
  quote(
    @Query('originLatitude') originLatitude: string,
    @Query('originLongitude') originLongitude: string,
    @Query('destinationLatitude') destinationLatitude: string,
    @Query('destinationLongitude') destinationLongitude: string,
    @Req() request: any,
  ) {
    if (request.user.role !== UserRole.PASSENGER) {
      throw new ForbiddenException('Solo un pasajero autenticado puede consultar una cotización.');
    }
    return this.routing.quote(
      { latitude: Number(originLatitude), longitude: Number(originLongitude) },
      { latitude: Number(destinationLatitude), longitude: Number(destinationLongitude) },
    );
  }
}
