import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import config from '../../../config/config';
import { SuperadminModelAction } from '../model-actions/superadmin-actions';

@Injectable()
export class SuperadminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly superadminModelAction: SuperadminModelAction,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const { jwt } = config();
      const payload = this.jwtService.verify(token, {
        secret: jwt.secret,
      });

      // Verify the super admin exists and is active
      const superadmin = await this.superadminModelAction.get({
        identifierOptions: { id: payload.sub },
      });

      if (!superadmin) {
        throw new UnauthorizedException('Super admin not found');
      }

      if (!superadmin.is_active) {
        throw new UnauthorizedException('Super admin account is inactive');
      }

      // Attach super admin to request for use in controllers
      request['superadmin'] = {
        id: superadmin.id,
        email: superadmin.email,
        first_name: superadmin.first_name,
        last_name: superadmin.last_name,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

