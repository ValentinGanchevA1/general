import { Module } from '@nestjs/common';
import { DatingService } from './dating.service';
import { DatingController } from './dating.controller';
import { RealtimeModule } from '../../realtime/realtime.module';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [RealtimeModule, BlocksModule],
  providers: [DatingService],
  controllers: [DatingController],
  exports: [DatingService],
})
export class DatingModule {}
