import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsEnum, ValidateIf, MaxLength } from 'class-validator';

export enum MessageSenderType {
  TEACHER = 'teacher',
  STUDENT = 'student',
}

export class CreateMessageDto {
  @ApiProperty({ description: 'Class ID for the classroom' })
  @IsUUID()
  class_id: string;

  @ApiPropertyOptional({ 
    description: 'Sender type (will be determined from token if not provided)',
    enum: MessageSenderType,
  })
  @IsOptional()
  @IsEnum(MessageSenderType)
  sender_type?: 'teacher' | 'student';

  @ApiPropertyOptional({ description: 'Sender ID (will be determined from token if not provided)' })
  @IsOptional()
  @IsUUID()
  sender_id?: string;

  @ApiPropertyOptional({ 
    description: 'Text message content',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @ValidateIf((o) => !o.audio_url) // Required if no audio_url
  text?: string;

  @ApiPropertyOptional({ 
    description: 'Audio file URL (for voice notes)',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.text) // Required if no text
  audio_url?: string;

  @ApiPropertyOptional({ 
    description: 'Audio duration in seconds',
  })
  @IsOptional()
  audio_duration?: number;
}

