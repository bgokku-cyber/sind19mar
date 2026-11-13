import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRideDto } from './dto/create-ride.dto';

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRideDto) {
    const passenger = await this.prisma.passenger.findUnique({ where: { id: input.passengerId } });
    if (!passenger) throw new NotFoundException('No se encontró el perfil del pasajero.');

    return this.prisma.ride.create({
      data: {
        passengerId: input.passengerId,
        originAddress: input.originAddress.trim(),
        originLatitude: new Prisma.Decimal(input.originLatitude),
        originLongitude: new Prisma.Decimal(input.originLongitude),
        destinationAddress: input.destinationAddress.trim(),
        destinationLatitude: new Prisma.Decimal(input.destinationLatitude),
        destinationLongitude: new Prisma.Decimal(input.destinationLongitude),
        estimatedFare: input.estimatedFare === undefined ? undefined : new Prisma.Decimal(input.estimatedFare),
        paymentMethod: input.paymentMethod as PaymentMethod,
      },
    });
  }

  async list(filters: { passengerId?: string; driverId?: string }) {
    if (filters.passengerId && filters.driverId) {
      throw new BadRequestException('Usa passengerId o driverId, no ambos.');
    }
    return this.prisma.ride.findMany({
      where: {
        ...(filters.passengerId ? { passengerId: filters.passengerId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
  }

  async accept(rideId: string, driverId: string) {
    if (!driverId?.trim()) throw new BadRequestException('driverId es obligatorio.');

    return this.prisma.$transaction(async (tx) => {
      // Reclama al conductor de forma atómica para impedir que acepte dos viajes simultáneos.
      const driverClaim = await tx.driver.updateMany({
        where: { id: driverId, availability: 'AVAILABLE', verifiedAt: { not: null } },
        data: { availability: 'ON_TRIP' },
      });
      if (driverClaim.count !== 1) {
        throw new ConflictException('El conductor no existe, no está verificado o no está disponible.');
      }

      const rideClaim = await tx.ride.updateMany({
        where: { id: rideId, status: RideStatus.REQUESTED, driverId: null },
        data: { driverId, status: RideStatus.ACCEPTED, acceptedAt: new Date() },
      });
      if (rideClaim.count !== 1) {
        throw new ConflictException('El viaje ya fue asignado o no está disponible.');
      }

      return tx.ride.findUniqueOrThrow({ where: { id: rideId } });
    });
  }
}
