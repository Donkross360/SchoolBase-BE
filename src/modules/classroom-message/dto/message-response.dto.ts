import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsEnum, IsNumber, IsDate } from 'class-validator';
import { MessageSenderType } from './create-message.dto';

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Class ID' })
  @IsUUID()
  class_id: string;

  @ApiProperty({ 
    description: 'Sender type',
    enum: MessageSenderType,
  })
  @IsEnum(MessageSenderType)
  sender_type: 'teacher' | 'student';

  @ApiProperty({ description: 'Sender ID' })
  @IsUUID()
  sender_id: string;

  @ApiPropertyOptional({ description: 'Sender name (first name + last name)' })
  @IsString()
  sender_name?: string;

  @ApiPropertyOptional({ description: 'Text message content' })
  @IsString()
  text: string | null;

  @ApiPropertyOptional({ description: 'Audio file URL' })
  @IsString()
  audio_url: string | null;

  @ApiPropertyOptional({ description: 'Audio duration in seconds' })
  @IsNumber()
  audio_duration: number | null;

  @ApiProperty({ description: 'Message creation timestamp' })
  @IsDate()
  createdAt: Date;

  @ApiProperty({ description: 'Message last update timestamp' })
  @IsDate()
  updatedAt: Date;
}

