import { Module } from '@nestjs/common';
import { WorldsController } from './worlds.controller';
import { WorldsService } from './worlds.service';

@Module({
  controllers: [WorldsController],
  providers: [WorldsService],
})
export class WorldsModule {}
