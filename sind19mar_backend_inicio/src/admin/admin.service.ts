import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, FleetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  pendingDrivers() {
    return this.prisma.driver.findMany({ where: { verifiedAt: null }, include: { user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } }, vehicles: true }, orderBy: { createdAt: 'asc' } });
  }

  pendingFleets() {
    return this.prisma.fleet.findMany({ where: { status: FleetStatus.PENDING }, include: { manager: { select: { id: true, fullName: true, phone: true, createdAt: true } } }, orderBy: { createdAt: 'asc' } });
  }

  async approveFleet(fleetId: string) {
    return this.prisma.$transaction(async (tx) => {
      const fleet = await tx.fleet.findUnique({ where: { id: fleetId } });
      if (!fleet) throw new NotFoundException('No se encontró la flota.');
      if (fleet.status !== FleetStatus.PENDING) throw new ConflictException('La flota ya fue revisada.');
      await tx.user.update({ where: { id: fleet.managerUserId }, data: { status: AccountStatus.ACTIVE } });
      return tx.fleet.update({ where: { id: fleetId }, data: { status: FleetStatus.ACTIVE } });
    });
  }

  async approveDriver(driverId: string) {
    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId }, include: { vehicles: { where: { isActive: true } } } });
      if (!driver) throw new NotFoundException('No se encontró el conductor.');
      if (driver.vehicles.length === 0) throw new ConflictException('Registra y aprueba al menos un vehículo antes de aprobar al conductor.');
      await tx.user.update({ where: { id: driver.userId }, data: { status: AccountStatus.ACTIVE } });
      return tx.driver.update({ where: { id: driverId }, data: { verifiedAt: new Date() } });
    });
  }

  async approveVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { driver: true } });
    if (!vehicle) throw new NotFoundException('No se encontró el vehículo.');
    if (vehicle.driver.verifiedAt) throw new ConflictException('El conductor ya está aprobado; los cambios de vehículo requieren revisión controlada.');
    return this.prisma.vehicle.update({ where: { id: vehicleId }, data: { isActive: true } });
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No se encontró la cuenta.');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: AccountStatus.SUSPENDED } });
      if (user.role === 'DRIVER') await tx.driver.updateMany({ where: { userId }, data: { availability: 'OFFLINE' } });
      if (user.role === 'FLEET_MANAGER') {
        const fleet = await tx.fleet.findUnique({ where: { managerUserId: userId } });
        if (fleet) {
          await tx.fleet.update({ where: { id: fleet.id }, data: { status: FleetStatus.SUSPENDED } });
          await tx.driver.updateMany({ where: { fleetId: fleet.id }, data: { availability: 'OFFLINE' } });
        }
      }
    });
    return { success: true };
  }
}
