import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class LocationDto {
  @IsNumber() @IsLatitude() lat!: number;
  @IsNumber() @IsLongitude() lng!: number;
}

export class PresenceUpdateDto {
  @ValidateNested() @Type(() => LocationDto) location!: LocationDto;
}

export class ConversationJoinDto {
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
