import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id ?? req.user?.sub;

    if (!userId || !getAdminUserIds().includes(userId)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
