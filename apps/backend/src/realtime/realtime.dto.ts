import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MARKETPLACE_KINDS,
  type DiscoveryRankBy,
  type EntityKind,
  type ListingMode,
  type MarketplaceKind,
} from '@g88/shared';

class LocationDto {
  @IsNumber() @IsLatitude() lat!: number;
  @IsNumber() @IsLongitude() lng!: number;
}

class DiscoveryViewportDto {
  @ValidateNested() @Type(() => LocationDto) ne!: LocationDto;
  @ValidateNested() @Type(() => LocationDto) sw!: LocationDto;
}

export class DiscoverySubscriptionDto {
  @ValidateNested() @Type(() => DiscoveryViewportDto) viewport!: DiscoveryViewportDto;

  @IsNumber() @Min(0) @Max(22) zoom!: number;

  @IsOptional()
  @IsArray()
  @IsIn(['user', 'event', 'listing'], { each: true })
  kinds?: EntityKind[];

  @IsOptional() @IsString() @MaxLength(40) topic?: string;

  @IsOptional() @IsIn(['sell', 'buy']) listingMode?: ListingMode;

  @IsOptional() @IsIn([...MARKETPLACE_KINDS]) marketplaceKind?: MarketplaceKind;

  @IsOptional() @IsBoolean() friendsOnly?: boolean;

  @IsOptional() @IsBoolean() datingOnly?: boolean;

  @IsOptional()
  @IsIn(['relevance', 'distance', 'newest'])
  rankBy?: DiscoveryRankBy;
}

export class PresenceUpdateDto {
  @ValidateNested() @Type(() => LocationDto) location!: LocationDto;
}

export class ConversationJoinDto {
  @IsUUID() conversationId!: string;
}

export class ConversationLeaveDto {
  @IsUUID() conversationId!: string;
}

export class ChatSendDto {
  @IsUUID() conversationId!: string;
  @IsString() @MaxLength(2000) body!: string;
  @IsString() @MaxLength(100) clientMessageId!: string;
}

export class EventRoomDto {
  @IsUUID() eventId!: string;
}

export class LocationShareStartDto {
  @IsUUID() conversationId!: string;
  @IsIn(['15m', '60m', 'until_off']) duration!: '15m' | '60m' | 'until_off';
  @ValidateNested() @Type(() => LocationDto) location!: LocationDto;
}

export class LocationShareUpdateDto {
  @IsUUID() sessionId!: string;
  @ValidateNested() @Type(() => LocationDto) location!: LocationDto;
}

export class LocationShareStopDto {
  @IsUUID() sessionId!: string;
}
