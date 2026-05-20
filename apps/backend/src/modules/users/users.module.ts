import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { S3Service } from '../../common/s3.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [UsersService, S3Service],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
