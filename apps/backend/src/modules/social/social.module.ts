import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [UsersModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
