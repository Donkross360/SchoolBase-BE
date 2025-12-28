import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateRoomDTO } from './create-room-dto';

export class UpdateRoomDTO extends PartialType(CreateRoomDTO) {
  @ApiPropertyOptional({
    description: 'Availability status of the room',
    type: Boolean,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
