import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';
import { TermsInterceptor } from './terms.interceptor';

@Global()
@Module({
  controllers: [TermsController],
  providers: [
    TermsService,
    Reflector,
    { provide: APP_INTERCEPTOR, useClass: TermsInterceptor },
  ],
  exports: [TermsService],
})
export class TermsModule {}
