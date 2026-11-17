import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES = ['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'];
const TRANSITIONS: Record<string, string[]> = {
  ACCEPTED: ['DRIVER_ARRIVING', 'CANCELLED'],
  DRIVER_ARRIVING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
};

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Record<string, unknown>) {
    const passengerId = this.requiredString(input.passengerId, 'passengerId');
    const originAddress = this.requiredString(input.originAddress, 'originAddress');
    const destinationAddress = this.requiredString(input.destinationAddress, 'destinationAddress');
    const originLatitude = this.coordinate(input.originLatitude, -90, 90, 'originLatitude');
    const originLongitude = this.coordinate(input.originLongitude, -180, 180, 'originLongitude');
    const destinationLatitude = this.coordinate(input.destinationLatitude, -90, 90, 'destinationLatitude');
    const destinationLongitude = this.coordinate(input.destinationLongitude, -180, 180, 'destinationLongitude');
    const paymentMethod = input.paymentMethod;

    if (paymentMethod !== 'CASH' && paymentMethod !== 'DIGITAL') {
      throw new BadRequestException('paymentMethod debe ser CASH o DIGITAL.');
    }

    const estimatedFare = input.estimatedFare;
    if (estimatedFare !== undefined &&
      (typeof estimatedFare !== 'string' || !/^\d+(\.\d{1,2})?$/.test(estimatedFare))) {
      throw new BadRequestException('estimatedFare debe ser un importe BOB válido con hasta 2 decimales.');
    }

    const passenger = await this.prisma.passenger.findUnique({ where: { id: passengerId } });
    if (!passenger) throw new NotFoundException('No existe el pasajero indicado.');

    return this.prisma.ride.create({
      data: {
        passengerId,
        originAddress,
        originLatitude,
        originLongitude,
        destinationAddress,
        destinationLatitude,
        destinationLongitude,
        paymentMethod,
        estimatedFare: estimatedFare === undefined ? undefined : (estimatedFare as string),
      },
    });
  }

  async byPassenger(passengerId: string) {
    return this.prisma.ride.findMany({
      where: { passengerId },
      orderBy: { requestedAt: 'desc' },
      include: { driver: { include: { user: { select: { fullName: true, phone: true } } } } },
    });
  }

  async byDriver(driverId: string, activeOnly = false) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('No existe el conductor indicado.');
    const rides = await this.prisma.ride.findMany({
      where: activeOnly
        ? { driverId, status: { in: ACTIVE_STATUSES as any } }
        : { OR: [{ driverId }, { status: 'REQUESTED' }] },
      orderBy: { requestedAt: 'desc' },
      include: { passenger: { include: { user: { select: { fullName: true, phone: true } } } } },
    });

    // A driver may preview open requests, but must not see a passenger's phone
    // number until the trip has been assigned to that driver.
    return rides.map((ride) => {
      if (ride.status === 'REQUESTED' && !ride.driverId) {
        return {
          ...ride,
          passenger: {
            ...ride.passenger,
            user: { ...ride.passenger.user, phone: undefined },
          },
        };
      }
      return ride;
    });
  }

  async accept(rideId: string, driverIdValue: unknown) {
    const driverId = this.requiredString(driverIdValue, 'driverId');
    const [ride, driver] = await Promise.all([
      this.prisma.ride.findUnique({ where: { id: rideId } }),
      this.prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } }),
    ]);
    if (!ride) throw new NotFoundException('Viaje no encontrado.');
    if (!driver || driver.user.status !== 'ACTIVE' || !driver.verifiedAt) {
      throw new BadRequestException('El conductor debe existir, estar activo y verificado.');
    }
    if (driver.availability !== 'AVAILABLE') {
      throw new ConflictException('El conductor no está disponible.');
    }
    if (ride.status !== 'REQUESTED') {
      throw new ConflictException('El viaje ya no está disponible.');
    }

    return this.prisma.$transaction(async (tx) => {
      const driverClaim = await tx.driver.updateMany({
        where: { id: driverId, availability: 'AVAILABLE' },
        data: { availability: 'ON_TRIP' },
      });
      if (driverClaim.count !== 1) throw new ConflictException('El conductor ya no está disponible.');
      const claimed = await tx.ride.updateMany({
        where: { id: rideId, status: 'REQUESTED', driverId: null },
        data: { driverId, status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('Otro conductor ya aceptó este viaje.');
      const fresh = await tx.ride.findUnique({ where: { id: rideId } });
      return fresh;
    });
  }

  async updateStatus(rideId: string, statusValue: unknown, driverIdValue: unknown) {
    const status = this.requiredString(statusValue, 'status');
    const driverId = this.requiredString(driverIdValue, 'driverId');
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Viaje no encontrado.');
    if (ride.driverId !== driverId) throw new BadRequestException('El viaje no pertenece a este conductor.');
    if (!TRANSITIONS[ride.status]?.includes(status)) {
      throw new ConflictException(`Transición no permitida: ${ride.status} → ${status}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.ride.updateMany({
        where: { id: rideId, driverId, status: ride.status },
        data: {
          status: status as any,
          ...(status === 'IN_PROGRESS' ? { startedAt: now } : {}),
          ...(status === 'COMPLETED' ? { completedAt: now } : {}),
          ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
        },
      });
      if (changed.count !== 1) throw new ConflictException('El viaje cambió; actualiza e intenta nuevamente.');
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        await tx.driver.update({ where: { id: driverId }, data: { availability: 'AVAILABLE' } });
      }
      return tx.ride.findUnique({ where: { id: rideId } });
    });
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} es obligatorio.`);
    }
    return value.trim();
  }

  private coordinate(value: unknown, min: number, max: number, field: string): number {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      throw new BadRequestException(`${field} debe ser una coordenada válida.`);
    }
    return number;
  }
}
