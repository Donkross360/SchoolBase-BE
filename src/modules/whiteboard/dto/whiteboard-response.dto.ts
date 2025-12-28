import { ApiProperty } from '@nestjs/swagger';

export class WhiteboardResponseDto {
  @ApiProperty({ description: 'Whiteboard ID' })
  id: string;

  @ApiProperty({ description: 'Class ID' })
  class_id: string;

  @ApiProperty({ description: 'Canvas state as JSON string', nullable: true })
  canvas_state: string | null;

  @ApiProperty({ 
    description: 'Object mapping image URLs to position/size data',
    type: Object,
    example: { "url1": { "x": 100, "y": 100, "width": 200, "height": 150 } }
  })
  images_data: Record<string, { x: number; y: number; width: number; height: number }>;

  @ApiProperty({ 
    description: 'Object mapping video URLs to position/size data',
    type: Object,
    example: { "url1": { "x": 100, "y": 100, "width": 400, "height": 225 } }
  })
  videos_data: Record<string, { x: number; y: number; width: number; height: number }>;

  @ApiProperty({ 
    description: 'Array of text box objects',
    type: Array,
    example: [{ "id": "text-1", "text": "Hello", "x": 50, "y": 50, "width": 200, "height": 100, "fontSize": 16, "fontFamily": "Arial", "fontWeight": "normal", "color": "#000000" }]
  })
  text_boxes: Array<{ id: string; text: string; x: number; y: number; width: number; height: number; fontSize?: number; fontFamily?: string; fontWeight?: string; color?: string }>;

  @ApiProperty({ description: 'Whether whiteboard is active' })
  is_active: boolean;

  @ApiProperty({ description: 'Whether students are allowed to edit the whiteboard' })
  allow_student_edit: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;
}

