import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'node:crypto';
import { JwtAuthGuard, ROLES_KEY } from './jwt-auth.guard';

const secret = 'sind19mar-test-secret-with-at-least-32-bytes';

function token(claims: Record<string, unknown>, header = { alg: 'HS256', typ: 'JWT' }) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode(header);
  const body = encode(claims);
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

function contextFor(authorization?: string, roles?: string[]) {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const handler = {};
  const controller = {};
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
    return key === ROLES_KEY ? (roles as never) : undefined;
  });
  return { context, request, reflector };
}

describe('JwtAuthGuard', () => {
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = secret;
  });

  afterAll(() => {
    delete process.env.AUTH_JWT_SECRET;
  });

  it('accepts a valid signed token and attaches its identity to the request', () => {
    const { context, request, reflector } = contextFor(
      `Bearer ${token({ sub: 'user-1', role: 'PASSENGER', iat: now, exp: now + 600 })}`,
      ['PASSENGER'],
    );
    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(request.user).toEqual({ sub: 'user-1', role: 'PASSENGER', iat: now, exp: now + 600 });
  });

  it('rejects a token whose signature was modified', () => {
    const signed = token({ sub: 'user-1', role: 'PASSENGER', iat: now, exp: now + 600 });
    const { context, reflector } = contextFor(`Bearer ${signed.slice(0, -1)}x`);
    expect(() => new JwtAuthGuard(reflector).canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', () => {
    const { context, reflector } = contextFor(
      `Bearer ${token({ sub: 'user-1', role: 'PASSENGER', iat: now - 900, exp: now - 1 })}`,
    );
    expect(() => new JwtAuthGuard(reflector).canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a role that is not allowed by the route', () => {
    const { context, reflector } = contextFor(
      `Bearer ${token({ sub: 'user-1', role: 'DRIVER', iat: now, exp: now + 600 })}`,
      ['PASSENGER'],
    );
    expect(() => new JwtAuthGuard(reflector).canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects tokens with an algorithm other than HS256', () => {
    const { context, reflector } = contextFor(
      `Bearer ${token({ sub: 'user-1', role: 'PASSENGER', iat: now, exp: now + 600 }, { alg: 'none', typ: 'JWT' })}`,
    );
    expect(() => new JwtAuthGuard(reflector).canActivate(context)).toThrow(UnauthorizedException);
  });
});
