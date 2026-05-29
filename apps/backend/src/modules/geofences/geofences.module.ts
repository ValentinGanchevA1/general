import { Module } from '@nestjs/common';
import { GeofencesController } from './geofences.controller';
import { GeofencesService } from './geofences.service';

@Module({
  controllers: [GeofencesController],
  providers: [GeofencesService],
  exports: [GeofencesService],
})
export class GeofencesModule {}
