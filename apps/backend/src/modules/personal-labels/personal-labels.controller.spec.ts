import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../id-verification/admin.guard';
import { AdminPersonalLabelsController, PersonalLabelsController } from './personal-labels.controller';

describe('personal labels authorization boundaries', () => {
  it('requires a session for users and an admin for moderation', () => {
    const userGuards = Reflect.getMetadata(GUARDS_METADATA, PersonalLabelsController) as unknown[];
    const adminGuards = Reflect.getMetadata(GUARDS_METADATA, AdminPersonalLabelsController) as unknown[];
    expect(userGuards).toContain(JwtAuthGuard);
    expect(userGuards).not.toContain(AdminGuard);
    expect(adminGuards).toContain(JwtAuthGuard);
    expect(adminGuards).toContain(AdminGuard);
  });
});
