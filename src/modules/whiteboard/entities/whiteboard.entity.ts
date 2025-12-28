import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { Class } from '../../class/entities/class.entity';

/**
 * Whiteboard Entity
 * 
 * Stores whiteboard sessions for classes.
 * Each class can have one active whiteboard session.
 */
@Unique(['class_id'])
@Entity('whiteboards')
export class Whiteboard extends BaseEntity {
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => Class, { nullable: false })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  /**
   * Whiteboard state as JSON string (for fabric.js or similar)
   * Stores the canvas state including drawings, text, images, etc.
   */
  @Column({ name: 'canvas_state', type: 'text', nullable: true })
  canvas_state: string | null;

  /**
   * JSON object mapping image URLs to their position/size data
   * Format: { "url": { "x": number, "y": number, "width": number, "height": number } }
   */
  @Column({ name: 'images_data', type: 'jsonb', nullable: true, default: '{}' })
  images_data: Record<string, { x: number; y: number; width: number; height: number }>;

  /**
   * JSON object mapping video URLs to their position/size data
   * Format: { "url": { "x": number, "y": number, "width": number, "height": number } }
   */
  @Column({ name: 'videos_data', type: 'jsonb', nullable: true, default: '{}' })
  videos_data: Record<string, { x: number; y: number; width: number; height: number }>;

  /**
   * JSON array of text box objects
   * Format: [{ "id": string, "text": string, "x": number, "y": number, "width": number, "height": number, "fontSize"?: number, "fontFamily"?: string, "fontWeight"?: string, "color"?: string }]
   */
  @Column({ name: 'text_boxes', type: 'jsonb', nullable: true, default: '[]' })
  text_boxes: Array<{ id: string; text: string; x: number; y: number; width: number; height: number; fontSize?: number; fontFamily?: string; fontWeight?: string; color?: string }>;

  /**
   * Whether the whiteboard is currently active
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  /**
   * Whether students are allowed to edit the whiteboard
   * When false, students can only view the whiteboard (read-only mode)
   */
  @Column({ name: 'allow_student_edit', type: 'boolean', default: false })
  allow_student_edit: boolean;
}

