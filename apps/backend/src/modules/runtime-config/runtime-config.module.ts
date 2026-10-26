import { Module } from '@nestjs/common';

import { RuntimeConfigController } from './runtime-config.controller';

@Module({
  controllers: [RuntimeConfigController],
})
export class RuntimeConfigModule {}
