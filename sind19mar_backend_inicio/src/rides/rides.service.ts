import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { assertRideWithinMapCoverage } from '../maps/map-coverage';

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRideDto) {
    // La cobertura se valida en servidor; no se confía en límites enviados por la app.
    assertRideWithinMapCoverage(input.originLatitude, input.originLongitude, input.destinationLatitude, input.destinationLongitude);
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
        // La tarifa enviada por el cliente nunca se considera válida ni oficial.
        // Se calculará en el servidor cuando se implemente el motor tarifario de La Paz.
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
      ...(filters.passengerId ? {
        include: {
          driver: { select: { location: { select: { latitude: true, longitude: true, recordedAt: true } } } },
        },
      } : {}),
    });
  }

  async listAvailable(driverId: string) {
    const eligible = await this.prisma.driver.findFirst({
      where: {
        id: driverId,
        availability: 'AVAILABLE',
        verifiedAt: { not: null },
        user: { status: 'ACTIVE' },
        vehicles: { some: { isActive: true } },
        OR: [{ fleetId: null }, { fleet: { is: { status: 'ACTIVE' } } }],
      },
      select: { id: true },
    });
    if (!eligible) return [];
    return this.prisma.ride.findMany({
      where: { status: RideStatus.REQUESTED, driverId: null },
      orderBy: { requestedAt: 'asc' },
      take: 50,
    });
  }

  async accept(rideId: string, driverId: string) {
    if (!driverId?.trim()) throw new BadRequestException('driverId es obligatorio.');

    return this.prisma.$transaction(async (tx) => {
      // Reclama al conductor de forma atómica para impedir que acepte dos viajes simultáneos.
      const driverClaim = await tx.driver.updateMany({
        where: { id: driverId, availability: 'AVAILABLE', verifiedAt: { not: null }, user: { status: 'ACTIVE' }, vehicles: { some: { isActive: true } }, OR: [{ fleetId: null }, { fleet: { is: { status: 'ACTIVE' } } }] },
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

  async cancel(rideId: string, actor: { role: string; passengerId?: string; driverId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const ride = await tx.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new NotFoundException('No se encontró el viaje.');

      const cancellable: RideStatus[] = [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.DRIVER_ARRIVING];
      if (!cancellable.includes(ride.status)) {
        throw new ConflictException('Este viaje ya no puede cancelarse desde la aplicación.');
      }

      if (actor.role === 'PASSENGER') {
        if (!actor.passengerId || ride.passengerId !== actor.passengerId || ride.status !== RideStatus.REQUESTED) {
          throw new ConflictException('El pasajero solo puede cancelar su solicitud antes de que sea aceptada.');
        }
      } else if (actor.role === 'DRIVER') {
        if (!actor.driverId || ride.driverId !== actor.driverId || !([RideStatus.ACCEPTED, RideStatus.DRIVER_ARRIVING] as RideStatus[]).includes(ride.status)) {
          throw new ConflictException('El conductor solo puede cancelar un viaje propio antes de iniciarlo.');
        }
      } else if (actor.role !== 'ADMIN') {
        throw new BadRequestException('Rol no autorizado para cancelar viajes.');
      }

      // Revalida propietario y estado en la misma escritura para cerrar carreras
      // entre la lectura inicial y la cancelación.
      const ownershipWhere = actor.role === 'PASSENGER'
        ? { passengerId: actor.passengerId }
        : actor.role === 'DRIVER'
          ? { driverId: actor.driverId }
          : {};

      const changed = await tx.ride.updateMany({
        where: { id: rideId, status: ride.status, ...ownershipWhere },
        data: { status: RideStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('El viaje cambió mientras se procesaba la cancelación.');

      if (ride.driverId && (actor.role === 'DRIVER' || actor.role === 'ADMIN')) {
        await tx.driver.updateMany({
          where: { id: ride.driverId, availability: 'ON_TRIP' },
          data: { availability: 'AVAILABLE' },
        });
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
