import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import * as sysMsg from '../../../constants/system.messages';
import { ClassTeacher } from '../../class/entities/class-teacher.entity';
import { ClassStudent } from '../../class/entities/class-student.entity';
import { Class } from '../../class/entities/class.entity';
import { Student } from '../../student/entities/student.entity';
import { Schedule } from '../../timetable/entities/schedule.entity';
import { Timetable } from '../../timetable/entities/timetable.entity';
import { UpdateWhiteboardDto } from '../dto/update-whiteboard.dto';
import { Whiteboard } from '../entities/whiteboard.entity';
import { WhiteboardModelAction } from '../model-actions/whiteboard-model-actions';

@Injectable()
export class WhiteboardService {
  constructor(
    private readonly whiteboardModelAction: WhiteboardModelAction,
    private readonly datasource: DataSource,
  ) {}

  /**
   * Get or create whiteboard for a class
   */
  async getOrCreate(classId: string) {
    let whiteboard = await this.whiteboardModelAction.get({
      identifierOptions: { class_id: classId },
      relations: { class: true },
    });

    if (!whiteboard) {
      // Create new whiteboard for this class
          whiteboard = await this.whiteboardModelAction.create({
            createPayload: {
              class_id: classId,
              canvas_state: null,
              images_data: {},
              videos_data: {},
              text_boxes: [],
              is_active: true,
              allow_student_edit: false,
            },
            transactionOptions: {
              useTransaction: false,
            },
          });
    }

    return whiteboard;
  }

  /**
   * Get whiteboard by class ID
   */
  async findByClassId(classId: string) {
    const whiteboard = await this.whiteboardModelAction.get({
      identifierOptions: { class_id: classId },
      relations: { class: true },
    });

    if (!whiteboard) {
      // Return empty whiteboard state if not found
      return {
        id: null,
        class_id: classId,
        canvas_state: null,
        images_data: {},
        videos_data: {},
        text_boxes: [],
        is_active: false,
        allow_student_edit: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return whiteboard;
  }

  /**
   * Update whiteboard state
   */
  async update(classId: string, updateDto: UpdateWhiteboardDto) {
    return this.datasource.transaction(async (manager) => {
      let whiteboard = await manager.findOne(Whiteboard, {
        where: { class_id: classId },
      });

      if (!whiteboard) {
        // Create new whiteboard if it doesn't exist
        whiteboard = manager.create(Whiteboard, {
          class_id: classId,
          canvas_state: updateDto.canvas_state || null,
          images_data: updateDto.images_data || {},
          videos_data: updateDto.videos_data || {},
          text_boxes: updateDto.text_boxes || [],
          is_active: true,
        });
      } else {
        // Update existing whiteboard
        if (updateDto.canvas_state !== undefined) {
          whiteboard.canvas_state = updateDto.canvas_state;
        }
        if (updateDto.images_data !== undefined) {
          whiteboard.images_data = updateDto.images_data;
        }
        if (updateDto.videos_data !== undefined) {
          whiteboard.videos_data = updateDto.videos_data;
        }
        if (updateDto.text_boxes !== undefined) {
          whiteboard.text_boxes = updateDto.text_boxes;
        }
        if (updateDto.allow_student_edit !== undefined) {
          whiteboard.allow_student_edit = updateDto.allow_student_edit;
        }
      }

      const updated = await manager.save(Whiteboard, whiteboard);
      return updated;
    });
  }

  /**
   * Verify teacher has access to class
   * Checks both:
   * 1. If teacher is assigned as a class teacher
   * 2. If teacher has any schedule for this class (teacher is scheduled to teach this class)
   */
  async verifyTeacherAccess(teacherId: string, classId: string): Promise<boolean> {
    // Check 1: Is the teacher assigned as a class teacher?
    const classTeacher = await this.datasource.manager
      .createQueryBuilder(ClassTeacher, 'ct')
      .where('ct.class_id = :classId', { classId })
      .andWhere('ct.teacher_id = :teacherId', { teacherId })
      .andWhere('ct.is_active = :isActive', { isActive: true })
      .getOne();

    if (classTeacher) {
      return true;
    }

    // Check 2: Does the teacher have any schedule for this class?
    // A teacher has access if they are scheduled to teach this class (via timetable)
    const schedule = await this.datasource.manager
      .createQueryBuilder(Schedule, 's')
      .innerJoin(Timetable, 't', 't.id = s.timetable_id')
      .where('t.class_id = :classId', { classId })
      .andWhere('s.teacher_id = :teacherId', { teacherId })
      .andWhere('t.is_active = :isActive', { isActive: true })
      .getOne();

    return !!schedule;
  }

  /**
   * Verify student has access to class
   */
  async verifyStudentAccess(studentId: string, classId: string): Promise<boolean> {
    const student = await this.datasource.manager.findOne(Student, {
      where: { id: studentId },
      relations: ['current_class', 'class_assignments'],
    });

    if (!student) {
      return false;
    }

    // Check if student's current class matches
    if (student.current_class?.id === classId) {
      return true;
    }

    // Check if student has active assignment to this class
    const assignment = student.class_assignments?.find(
      (ca) => ca.class?.id === classId && ca.is_active,
    );

    return !!assignment;
  }
}

