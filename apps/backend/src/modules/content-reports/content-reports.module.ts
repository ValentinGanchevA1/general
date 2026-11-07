import { Module } from '@nestjs/common';
import { ContentReportsService } from './content-reports.service';
import { AdminContentReportsController, ContentReportsController } from './content-reports.controller';

@Module({
  controllers: [ContentReportsController, AdminContentReportsController],
  providers: [ContentReportsService],
})
export class ContentReportsModule {}
