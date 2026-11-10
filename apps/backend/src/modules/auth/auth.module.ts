import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdultEligibilityService } from './adult-eligibility.service';
import { PasswordResetMailer } from './password-reset-mailer';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET!,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, AdultEligibilityService, PasswordResetMailer, PasswordResetService],
  controllers: [AuthController],
  exports: [JwtModule, AuthService, JwtAuthGuard, AdultEligibilityService],
})
export class AuthModule {}
