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
        where: { id: driverId, availability: 'AVAILABLE', verifiedAt: { not: null }, user: { status: 'ACTIVE' }, vehicles: { some: { isActive: true } } },
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

  async advanceStatus(rideId: string, driverId: string, nextStatus: RideStatus) {
    if (!driverId?.trim()) throw new BadRequestException('driverId es obligatorio.');
    const transitions: Partial<Record<RideStatus, RideStatus>> = {
      [RideStatus.ACCEPTED]: RideStatus.DRIVER_ARRIVING,
      [RideStatus.DRIVER_ARRIVING]: RideStatus.IN_PROGRESS,
      [RideStatus.IN_PROGRESS]: RideStatus.COMPLETED,
    };

    return this.prisma.$transaction(async (tx) => {
      const ride = await tx.ride.findFirst({ where: { id: rideId, driverId } });
      if (!ride) throw new NotFoundException('No se encontró un viaje asignado a ese conductor.');

      if (transitions[ride.status] !== nextStatus) {
        throw new ConflictException('Transición no permitida para el estado actual del viaje.');
      }

      const timestamp = new Date();
      const data: Prisma.RideUpdateManyMutationInput = { status: nextStatus };
      if (nextStatus === RideStatus.IN_PROGRESS) data.startedAt = timestamp;
      if (nextStatus === RideStatus.COMPLETED) data.completedAt = timestamp;

      const changed = await tx.ride.updateMany({
        where: { id: rideId, driverId, status: ride.status },
        data,
      });
      if (changed.count !== 1) {
        throw new ConflictException('El viaje cambió mientras se procesaba la solicitud. Inténtalo de nuevo.');
      }

      if (nextStatus === RideStatus.COMPLETED) {
        const released = await tx.driver.updateMany({
          where: { id: driverId, availability: 'ON_TRIP' },
          data: { availability: 'AVAILABLE' },
        });
        if (released.count !== 1) {
          throw new ConflictException('No se pudo liberar la disponibilidad del conductor.');
        }
      }

      return tx.ride.findUniqueOrThrow({ where: { id: rideId } });
    });
  }
}
