import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class MarkNfcAttendanceDto {
  @ApiProperty({
    example: 'ABC123456789',
    description: 'NFC card ID or registration number of the student',
  })
  @IsString()
  card_id: string;

  @ApiPropertyOptional({
    example: '2025-12-23',
    description: 'Attendance date (YYYY-MM-DD). Defaults to today if not provided.',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: '08:30:00',
    description: 'Check-in time (HH:mm:ss). Defaults to current time if not provided.',
  })
  @IsString()
  @IsOptional()
  check_in_time?: string;

  @ApiPropertyOptional({
    example: 'Marked via NFC card',
    description: 'Optional notes about the attendance',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

