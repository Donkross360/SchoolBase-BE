import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    example: 'session-id-123',
    description: 'session id',
  })
  @IsUUID()
  @IsOptional()
  session_id?: string;

  @ApiPropertyOptional({
    example: 'user-id-123',
    description: 'User id',
  })
  @IsUUID()
  @IsOptional()
  user_id?: string;
}
