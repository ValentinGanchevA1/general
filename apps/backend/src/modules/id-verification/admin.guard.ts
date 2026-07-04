import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean);

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
