import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class AssignTeacherToClassDto {
  @ApiProperty({
    type: String,
    example: 'class-123',
    description: 'ID of the class to assign the teacher to',
  })
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({
    type: String,
    example: 'session-123',
    description: 'ID of the academic session (optional, defaults to active session)',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class AssignTeacherToClassResponseDto {
  @ApiProperty({ example: 'Teacher assigned to class successfully' })
  message: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the teacher',
  })
  teacher_id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'ID of the class',
  })
  class_id: string;

  @ApiProperty({
    example: 'JSS1 A',
    description: 'Name of the class',
  })
  class_name: string;

  @ApiProperty({
    example: '2023-09-01T08:00:00Z',
    description: 'Date when the teacher was assigned',
  })
  assignment_date: Date;
}

