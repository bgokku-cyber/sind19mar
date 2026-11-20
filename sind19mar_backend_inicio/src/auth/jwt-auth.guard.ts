import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type UserRole = 'PASSENGER' | 'DRIVER' | 'FLEET_MANAGER' | 'ADMIN';

export interface AuthenticatedUser {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export const ROLES_KEY = 'sind19mar:roles';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();

    const authorization = request.headers.authorization;
    const match = authorization?.match(
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/,
    );
    if (!match) throw new UnauthorizedException('Token de acceso requerido.');

    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new UnauthorizedException('Autenticación no configurada en el servidor.');
    }

    const [headerPart, payloadPart, signaturePart] = match[1].split('.');
    const expected = createHmac('sha256', secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest();
    const received = Buffer.from(signaturePart, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Token inválido.');
    }

    let header: unknown;
    let payload: unknown;
    try {
      header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }

    if (
      !header ||
      typeof header !== 'object' ||
      (header as Record<string, unknown>).alg !== 'HS256' ||
      (header as Record<string, unknown>).typ !== 'JWT' ||
      !payload ||
      typeof payload !== 'object'
    ) {
      throw new UnauthorizedException('Token inválido.');
    }

    const claims = payload as Record<string, unknown>;
    const roles: UserRole[] = ['PASSENGER', 'DRIVER', 'FLEET_MANAGER', 'ADMIN'];
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof claims.sub !== 'string' ||
      claims.sub.trim().length === 0 ||
      !roles.includes(claims.role as UserRole) ||
      typeof claims.iat !== 'number' ||
      !Number.isInteger(claims.iat) ||
      typeof claims.exp !== 'number' ||
      !Number.isInteger(claims.exp) ||
      claims.iat > now + 60 ||
      claims.exp <= now ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > 15 * 60
    ) {
      throw new UnauthorizedException('Token inválido o vencido.');
    }

    request.user = {
      sub: claims.sub,
      role: claims.role as UserRole,
      iat: claims.iat,
      exp: claims.exp,
    };

    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowedRoles?.length && !allowedRoles.includes(request.user.role)) {
      throw new UnauthorizedException('El rol del token no permite esta operación.');
    }

    return true;
  }
}
