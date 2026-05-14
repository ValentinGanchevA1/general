import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [PresenceModule],
  providers: [DiscoveryService],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
