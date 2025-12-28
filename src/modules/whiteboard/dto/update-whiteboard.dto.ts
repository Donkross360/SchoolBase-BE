import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class MediaPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

class TextBoxData {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class UpdateWhiteboardDto {
  @ApiPropertyOptional({ description: 'Canvas state as JSON string' })
  @IsOptional()
  @IsString()
  canvas_state?: string;

  @ApiPropertyOptional({ 
    description: 'Object mapping image URLs to position/size data',
    type: Object,
    example: { "url1": { "x": 100, "y": 100, "width": 200, "height": 150 } }
  })
  @IsOptional()
  @IsObject()
  images_data?: Record<string, MediaPosition>;

  @ApiPropertyOptional({ 
    description: 'Object mapping video URLs to position/size data',
    type: Object,
    example: { "url1": { "x": 100, "y": 100, "width": 400, "height": 225 } }
  })
  @IsOptional()
  @IsObject()
  videos_data?: Record<string, MediaPosition>;

  @ApiPropertyOptional({ 
    description: 'Array of text box objects',
    type: [Object],
    example: [{ "id": "text-1", "text": "Hello", "x": 50, "y": 50, "width": 200, "height": 100 }]
  })
  @IsOptional()
  @IsArray()
  text_boxes?: TextBoxData[];

  @ApiPropertyOptional({
    description: 'Whether students are allowed to edit the whiteboard',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  allow_student_edit?: boolean;
}

