import type { ForgotPasswordRequest, ResetPasswordRequest } from '@g88/shared';
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsByteLength, IsOptional, IsISO8601, Matches as MatchesPattern } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName!: string;

  // Required by the backend only when NEXUS_REQUIRE_ADULT_AGE=true.
  @IsOptional()
  @IsISO8601({ strict: true })
  @MatchesPattern(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  refreshToken!: string;
}

export class GoogleOAuthDto {
  @IsString()
  idToken!: string;
}


export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto extends ForgotPasswordDto implements ResetPasswordRequest {
  @IsString()
  @Matches(/^\d{8}$/)
  resetCode!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @IsByteLength(0, 72)
  newPassword!: string;
}
