import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../shared/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Better error messages
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    
    if (!user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
      throw new ForbiddenException('User does not have any roles assigned');
    }

    // Admins can access any endpoint
    if (user.roles.includes(UserRole.ADMIN)) {
      return true;
    }

    // Check if user has at least one of the required roles
    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));
    
    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}. User has: ${user.roles.join(', ')}`
      );
    }

    return true;
  }
}
