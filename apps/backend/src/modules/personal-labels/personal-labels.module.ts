import { Module } from '@nestjs/common';
import { AdminPersonalLabelsController, PersonalLabelsController } from './personal-labels.controller';
import { PersonalLabelsService } from './personal-labels.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PersonalLabelsController, AdminPersonalLabelsController],
  providers: [PersonalLabelsService],
})
export class PersonalLabelsModule {}
