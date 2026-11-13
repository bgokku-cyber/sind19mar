import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DriverAvailability } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { vehicles: true, user: { select: { fullName: true, phone: true, status: true } } } });
    if (!driver) throw new NotFoundException('No se encontró el perfil del conductor.');
    return driver;
  }

  async addVehicle(driverId: string, input: any) {
    if (!input || typeof input.make !== 'string' || !input.make.trim() || typeof input.model !== 'string' || !input.model.trim() || typeof input.color !== 'string' || !input.color.trim() || typeof input.plateNumber !== 'string' || input.plateNumber.trim().length < 4 || !Number.isInteger(input.year) || input.year < 1980 || input.year > new Date().getFullYear() + 1) {
      throw new BadRequestException('Datos del vehículo incompletos o inválidos.');
    }
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('No se encontró el perfil del conductor.');
    try {
      return await this.prisma.vehicle.create({ data: { driverId, make: input.make.trim(), model: input.model.trim(), color: input.color.trim(), plateNumber: input.plateNumber.trim().toUpperCase(), year: input.year, isActive: false } });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('La placa ya está registrada.');
      throw error;
    }
  }

  async setAvailability(driverId: string, availability: DriverAvailability) {
    if (!( [DriverAvailability.AVAILABLE, DriverAvailability.OFFLINE] as DriverAvailability[]).includes(availability)) throw new BadRequestException('Disponibilidad solicitada no válida.');
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { vehicles: { where: { isActive: true } } } });
    if (!driver) throw new NotFoundException('No se encontró el perfil del conductor.');
    if (availability === DriverAvailability.AVAILABLE && (!driver.verifiedAt || driver.vehicles.length === 0)) throw new ForbiddenException('Tu cuenta y al menos un vehículo deben estar aprobados antes de conectarte.');
    if (driver.availability === DriverAvailability.ON_TRIP) throw new ConflictException('No puedes cambiar tu disponibilidad durante un viaje.');
    return this.prisma.driver.update({ where: { id: driverId }, data: { availability } });
  }
}
