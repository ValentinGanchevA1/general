import { Module } from '@nestjs/common';
import { AdminPersonalLabelsController, PersonalLabelsController } from './personal-labels.controller';
import { PersonalLabelsService } from './personal-labels.service';

@Module({
  controllers: [PersonalLabelsController, AdminPersonalLabelsController],
  providers: [PersonalLabelsService],
})
export class PersonalLabelsModule {}
