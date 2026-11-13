import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FleetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FleetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(managerUserId: string) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { managerUserId },
      include: { drivers: { include: { user: { select: { id: true, fullName: true, phone: true, status: true } }, vehicles: true } } },
    });
    if (!fleet) throw new NotFoundException('No se encontró una flota asociada a esta cuenta.');
    return fleet;
  }

  async addDriver(managerUserId: string, phone: string) {
    if (typeof phone !== 'string' || phone.trim().length < 7) throw new ConflictException('Indica un teléfono válido del conductor.');
    const fleet = await this.prisma.fleet.findUnique({ where: { managerUserId } });
    if (!fleet) throw new NotFoundException('No se encontró la flota.');
    if (fleet.status !== FleetStatus.ACTIVE) throw new ForbiddenException('La flota debe estar aprobada para incorporar conductores.');
    const driver = await this.prisma.driver.findFirst({
      where: { user: { phone: phone.replace(/[\\s()-]/g, ''), role: 'DRIVER', status: 'ACTIVE' }, verifiedAt: { not: null }, fleetId: null },
    });
    if (!driver) throw new NotFoundException('No se encontró un conductor aprobado y disponible para asociar.');
    const result = await this.prisma.driver.updateMany({ where: { id: driver.id, fleetId: null }, data: { fleetId: fleet.id } });
    if (result.count !== 1) throw new ConflictException('El conductor ya fue asociado a otra flota.');
    return this.prisma.driver.findUnique({ where: { id: driver.id }, include: { user: { select: { fullName: true, phone: true } }, vehicles: true } });
  }
}
