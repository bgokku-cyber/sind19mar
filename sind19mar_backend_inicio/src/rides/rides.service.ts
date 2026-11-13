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
      const driver = await tx.driver.findUnique({ where: { id: driverId } });
      if (!driver || !driver.verifiedAt) {
        throw new NotFoundException('El conductor no existe o todavía no está verificado.');
      }
      if (driver.availability !== 'AVAILABLE') {
        throw new ConflictException('El conductor no está disponible.');
      }

      const result = await tx.ride.updateMany({
        where: { id: rideId, status: RideStatus.REQUESTED, driverId: null },
        data: { driverId, status: RideStatus.ACCEPTED, acceptedAt: new Date() },
      });
      if (result.count !== 1) {
        throw new ConflictException('El viaje ya fue asignado o no está disponible.');
      }

      await tx.driver.update({
        where: { id: driverId },
        data: { availability: 'ON_TRIP' },
      });
      return tx.ride.findUniqueOrThrow({ where: { id: rideId } });
    });
  }
}
