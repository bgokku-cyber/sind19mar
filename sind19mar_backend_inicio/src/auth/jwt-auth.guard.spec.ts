import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwt: { verifyAsync: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let request: { headers: { authorization?: string }; user?: unknown };
  let context: ExecutionContext;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    request = { headers: {} };
    context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    guard = new JwtAuthGuard(jwt as unknown as JwtService, prisma as unknown as PrismaService);
  });

  it('rejects requests without a Bearer token before querying dependencies', async () => {
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired tokens without looking up a user', async () => {
    request.headers.authorization = 'Bearer invalid-token';
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([null, {}, { sub: 123 }, { sub: '' }, { sub: '   ' }])(
    'rejects a verified token with an invalid subject (%p) before querying users',
    async (payload) => {
      request.headers.authorization = 'Bearer valid-token';
      jwt.verifyAsync.mockResolvedValue(payload);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects tokens whose account no longer exists', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jwt.verifyAsync.mockResolvedValue({ sub: 'deleted-user' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'deleted-user' },
    }));
  });

  it('rejects suspended accounts even when the token is valid', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jwt.verifyAsync.mockResolvedValue({ sub: 'suspended-user' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'suspended-user',
      role: UserRole.DRIVER,
      status: AccountStatus.SUSPENDED,
      passenger: null,
      driver: { id: 'driver-1', verifiedAt: null },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('loads the current account and attaches only its selected authorization profile', async () => {
    const activeUser = {
      id: 'passenger-user',
      role: UserRole.PASSENGER,
      status: AccountStatus.ACTIVE,
      passenger: { id: 'passenger-1' },
      driver: null,
    };
    request.headers.authorization = 'Bearer valid-token';
    jwt.verifyAsync.mockResolvedValue({ sub: 'passenger-user' });
    prisma.user.findUnique.mockResolvedValue(activeUser);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'passenger-user' },
      select: {
        id: true,
        role: true,
        status: true,
        passenger: { select: { id: true } },
        driver: { select: { id: true, verifiedAt: true } },
      },
    });
    expect(request.user).toEqual(activeUser);
  });
});
