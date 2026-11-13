import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw new UnauthorizedException('Se requiere una sesión válida.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7));
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true, passenger: { select: { id: true } }, driver: { select: { id: true, verifiedAt: true } } } });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('La cuenta no está activa.');
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('La sesión no es válida o ha expirado.');
    }
  }
}
