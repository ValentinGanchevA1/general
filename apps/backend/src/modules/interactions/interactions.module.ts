import { Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [InteractionsService],
  controllers: [InteractionsController],
})
export class InteractionsModule {}
