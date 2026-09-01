import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface JwtUser {
  id: string;
  email: string;
  roles: string[];
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtUser }>();
    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
    if (!hasRole) throw new UnauthorizedException('Insufficient role');
    return true;
  }
}
