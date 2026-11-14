import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('signed-token');
  });

  it('rejects login when phone or password is missing', async () => {
    await expect(service.login({ phone: '70000000' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unknown users without revealing whether the phone exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login({ phone: '70000000', password: 'secret-password' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks suspended accounts even when the password is correct', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', role: UserRole.DRIVER, status: AccountStatus.SUSPENDED, passwordHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(service.login({ phone: '70000000', password: 'secret-password' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('issues a bearer token only for active accounts with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2', role: UserRole.PASSENGER, status: AccountStatus.ACTIVE, passwordHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(service.login({ phone: '700 000 00', password: 'secret-password' }))
      .resolves.toEqual({
        accessToken: 'signed-token',
        tokenType: 'Bearer',
        expiresIn: '12h',
        user: { id: 'user-2', role: UserRole.PASSENGER, status: AccountStatus.ACTIVE },
      });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { phone: '70000000' } });
  });

  it('creates fleet-manager applications as pending and does not issue a token', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('password-hash');
    prisma.user.create.mockResolvedValue({ id: 'manager-1' });

    await expect(service.registerFleetManager({
      fullName: 'Administración Central',
      phone: '70000000',
      password: 'secure-password',
      fleetName: 'Flota Central',
    })).resolves.toEqual({
      success: true,
      message: 'Solicitud de registro recibida. La administración debe aprobar la cuenta y la flota antes de habilitar el acceso.',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: UserRole.FLEET_MANAGER,
        status: AccountStatus.PENDING,
      }),
    }));
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
