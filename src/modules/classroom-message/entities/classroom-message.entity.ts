import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { Class } from '../../class/entities/class.entity';
import { Teacher } from '../../teacher/entities/teacher.entity';
import { Student } from '../../student/entities/student.entity';

/**
 * Classroom Message Entity
 * 
 * Stores messages (text and voice notes) for virtual classroom chat
 * between teachers and students in a specific class.
 */
@Entity('classroom_messages')
@Index(['class_id', 'createdAt']) // Index for efficient querying by class and date
export class ClassroomMessage extends BaseEntity {
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => Class, { nullable: false })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  /**
   * Sender ID - can be either teacher_id or student_id
   */
  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  sender_id: string | null;

  /**
   * Sender type: 'teacher' or 'student'
   */
  @Column({ name: 'sender_type', type: 'varchar', length: 20 })
  sender_type: 'teacher' | 'student';

  /**
   * Teacher sender (if sender_type is 'teacher')
   * Note: Using a separate join since sender_id can be either teacher_id or student_id
   */
  @ManyToOne(() => Teacher, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'sender_id', referencedColumnName: 'id' })
  teacher: Teacher | null;

  /**
   * Student sender (if sender_type is 'student')
   * Note: Using a separate join since sender_id can be either teacher_id or student_id
   */
  @ManyToOne(() => Student, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'sender_id', referencedColumnName: 'id' })
  student: Student | null;

  /**
   * Message text content (null if message is only a voice note)
   */
  @Column({ name: 'text', type: 'text', nullable: true })
  text: string | null;

  /**
   * Audio file URL (null if message is only text)
   */
  @Column({ name: 'audio_url', type: 'varchar', length: 500, nullable: true })
  audio_url: string | null;

  /**
   * Audio file duration in seconds (if audio_url is present)
   */
  @Column({ name: 'audio_duration', type: 'float', nullable: true })
  audio_duration: number | null;
}

