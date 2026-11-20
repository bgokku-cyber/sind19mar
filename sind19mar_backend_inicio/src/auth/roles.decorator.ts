import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY, UserRole } from './jwt-auth.guard';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
