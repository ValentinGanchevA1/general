import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { S3Service } from '../../common/s3.service';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { MessagingModule } from '../messaging/messaging.module';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [AuthModule, PresenceModule, MessagingModule, BlocksModule],
  providers: [UsersService, S3Service],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
