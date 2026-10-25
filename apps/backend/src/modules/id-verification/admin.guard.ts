import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

export function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdminUserId(userId: string | undefined): boolean {
  return Boolean(userId && getAdminUserIds().includes(userId));
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { id?: string; sub?: string };
    }>();
    const userId = req.user?.id ?? req.user?.sub;

    if (!isAdminUserId(userId)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
