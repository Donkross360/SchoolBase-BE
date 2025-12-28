import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkNfcAssignmentItemDto {
  @ApiProperty({
    description: 'Student ID or Registration Number',
    example: 'REG-2025-0014',
  })
  @IsString()
  student_identifier: string; // Can be ID or registration_number

  @ApiProperty({
    description: 'NFC Card ID to assign. Leave empty or set to "GENERATE" to auto-generate',
    example: 'NFC-ABC123XYZ456',
    required: false,
  })
  @IsString()
  @IsOptional()
  nfc_card_id?: string;
}

export class BulkNfcAssignmentDto {
  @ApiProperty({
    description: 'List of students and their NFC card assignments',
    type: [BulkNfcAssignmentItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkNfcAssignmentItemDto)
  assignments: BulkNfcAssignmentItemDto[];
}

