import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user: Record<string, unknown> }>();
    return field ? req.user[field] : req.user;
  },
);
