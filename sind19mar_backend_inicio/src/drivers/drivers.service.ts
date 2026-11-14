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
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('Datos del vehículo incompletos o inválidos.');
    }

    const make = typeof input.make === 'string' ? input.make.trim() : '';
    const model = typeof input.model === 'string' ? input.model.trim() : '';
    const color = typeof input.color === 'string' ? input.color.trim() : '';
    const plateNumber = typeof input.plateNumber === 'string' ? input.plateNumber.trim().toUpperCase() : '';

    if (
      make.length < 1 || make.length > 60 ||
      model.length < 1 || model.length > 60 ||
      color.length < 1 || color.length > 40 ||
      plateNumber.length < 4 || plateNumber.length > 15 ||
      !Number.isInteger(input.year) || input.year < 1980 ||
      input.year > new Date().getFullYear() + 1
    ) {
      throw new BadRequestException('Datos del vehículo incompletos o inválidos. Revisa marca, modelo, color, placa y año.');
    }

    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('No se encontró el perfil del conductor.');
    try {
      return await this.prisma.vehicle.create({
        data: { driverId, make, model, color, plateNumber, year: input.year, isActive: false },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('La placa ya está registrada.');
      throw error;
    }
  }

  async setAvailability(driverId: string, availability: DriverAvailability) {
    if (!( [DriverAvailability.AVAILABLE, DriverAvailability.OFFLINE] as DriverAvailability[]).includes(availability)) throw new BadRequestException('Disponibilidad solicitada no válida.');
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { vehicles: { where: { isActive: true } }, fleet: { select: { status: true } } } });
    if (!driver) throw new NotFoundException('No se encontró el perfil del conductor.');
    if (availability === DriverAvailability.AVAILABLE && (!driver.verifiedAt || driver.vehicles.length === 0)) throw new ForbiddenException('Tu cuenta y al menos un vehículo deben estar aprobados antes de conectarte.');
    if (availability === DriverAvailability.AVAILABLE && driver.fleet && driver.fleet.status !== 'ACTIVE') throw new ForbiddenException('La flota asociada no está habilitada para operar.');
    if (driver.availability === DriverAvailability.ON_TRIP) throw new ConflictException('No puedes cambiar tu disponibilidad durante un viaje.');
    return this.prisma.driver.update({ where: { id: driverId }, data: { availability } });
  }
}
