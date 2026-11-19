import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private normalizePhone(phone: string) {
    return phone.replace(/[\s()-]/g, '');
  }

  private validateRegistration(input: any) {
    if (!input || typeof input !== 'object') throw new BadRequestException('Datos de registro no válidos.');
    if (typeof input.fullName !== 'string' || input.fullName.trim().length < 3 || input.fullName.trim().length > 100) throw new BadRequestException('El nombre debe tener entre 3 y 100 caracteres.');
    if (typeof input.phone !== 'string' || this.normalizePhone(input.phone).length < 7 || this.normalizePhone(input.phone).length > 20) throw new BadRequestException('El teléfono no es válido.');
    if (typeof input.password !== 'string' || input.password.length < 10 || Buffer.byteLength(input.password, 'utf8') > 72) throw new BadRequestException('La contraseña debe tener al menos 10 caracteres y un máximo de 72 bytes.');
  }

  private async issueToken(user: { id: string; role: UserRole; status: AccountStatus }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, tokenType: 'Bearer', expiresIn: '12h', user: { id: user.id, role: user.role, status: user.status } };
  }

  async registerPassenger(input: any) {
    this.validateRegistration(input);
    const phone = this.normalizePhone(input.phone);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await this.prisma.user.create({
        data: { phone, fullName: input.fullName.trim(), passwordHash, role: UserRole.PASSENGER, status: AccountStatus.ACTIVE, passenger: { create: {} } },
      });
      return this.issueToken(user);
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Ese teléfono ya está registrado.');
      throw error;
    }
  }

  async registerDriver(input: any) {
    this.validateRegistration(input);
    if (typeof input.licenseNumber !== 'string' || input.licenseNumber.trim().length < 4 || input.licenseNumber.trim().length > 40) throw new BadRequestException('El número de licencia no es válido.');
    const phone = this.normalizePhone(input.phone);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await this.prisma.user.create({
        data: { phone, fullName: input.fullName.trim(), passwordHash, role: UserRole.DRIVER, status: AccountStatus.ACTIVE, driver: { create: { licenseNumber: input.licenseNumber.trim(), availability: 'OFFLINE' } } },
      });
      return { ...await this.issueToken(user), message: 'Cuenta creada. Queda pendiente la revisión administrativa antes de conducir.' };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('El teléfono o la licencia ya están registrados.');
      throw error;
    }
  }

  async registerFleetManager(input: any) {
    this.validateRegistration(input);
    if (typeof input.fleetName !== 'string' || input.fleetName.trim().length < 2 || input.fleetName.trim().length > 100) {
      throw new BadRequestException('El nombre de la flota debe tener entre 2 y 100 caracteres.');
    }
    const phone = this.normalizePhone(input.phone);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      await this.prisma.user.create({
        data: {
          phone, fullName: input.fullName.trim(), passwordHash,
          role: UserRole.FLEET_MANAGER, status: AccountStatus.PENDING,
          managedFleet: { create: { name: input.fleetName.trim(), legalName: typeof input.legalName === 'string' ? input.legalName.trim().slice(0, 120) || null : null } },
        },
      });
      return { success: true, message: 'Solicitud de registro recibida. La administración debe aprobar la cuenta y la flota antes de habilitar el acceso.' };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Ese teléfono ya está registrado.');
      throw error;
    }
  }

  async login(input: any) {
    if (!input || typeof input.phone !== 'string' || typeof input.password !== 'string') throw new BadRequestException('Teléfono y contraseña son obligatorios.');
    const phone = this.normalizePhone(input.phone);
    if (phone.length < 7 || phone.length > 20) throw new BadRequestException('El teléfono no es válido.');
    if (input.password.length === 0 || Buffer.byteLength(input.password, 'utf8') > 72) throw new BadRequestException('La contraseña no es válida.');
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) throw new UnauthorizedException('Credenciales incorrectas.');
    if (user.status !== AccountStatus.ACTIVE) throw new UnauthorizedException('La cuenta está pendiente de aprobación o suspendida.');
    return this.issueToken(user);
  }
}
