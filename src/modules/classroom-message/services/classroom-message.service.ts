import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ClassTeacher } from '../../class/entities/class-teacher.entity';
import { ClassStudent } from '../../class/entities/class-student.entity';
import { Class } from '../../class/entities/class.entity';
import { Student } from '../../student/entities/student.entity';
import { Teacher } from '../../teacher/entities/teacher.entity';
import { UserRole } from '../../shared/enums';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ClassroomMessage } from '../entities/classroom-message.entity';
import { ClassroomMessageModelAction } from '../model-actions/classroom-message-model-actions';

@Injectable()
export class ClassroomMessageService {
  constructor(
    private readonly messageModelAction: ClassroomMessageModelAction,
    private readonly datasource: DataSource,
    @InjectRepository(ClassroomMessage)
    private readonly messageRepository: Repository<ClassroomMessage>,
  ) {}

  /**
   * Verify teacher has access to class
   */
  async verifyTeacherAccess(teacherId: string, classId: string): Promise<boolean> {
    const classTeacher = await this.datasource.manager
      .createQueryBuilder(ClassTeacher, 'ct')
      .where('ct.teacher_id = :teacherId', { teacherId })
      .andWhere('ct.class_id = :classId', { classId })
      .getOne();

    return !!classTeacher;
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
    const assignment = await this.datasource.manager
      .createQueryBuilder(ClassStudent, 'cs')
      .where('cs.student_id = :studentId', { studentId })
      .andWhere('cs.class_id = :classId', { classId })
      .getOne();

    return !!assignment;
  }

  /**
   * Create a new message in the classroom
   */
  async create(createDto: CreateMessageDto, userId: string, userRoles: string[]): Promise<ClassroomMessage> {
    // Verify the user has access to the class
    const isAdmin = userRoles.includes('ADMIN');
    const isTeacher = userRoles.includes('TEACHER');
    const isStudent = userRoles.includes('STUDENT') && !isAdmin && !isTeacher;

    if (isStudent) {
      const hasAccess = await this.verifyStudentAccess(createDto.sender_id, createDto.class_id);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this class');
      }
      if (createDto.sender_type !== 'student') {
        throw new ForbiddenException('Students can only send messages as students');
      }
    } else if (isTeacher || isAdmin) {
      if (createDto.sender_type === 'teacher') {
        const hasAccess = await this.verifyTeacherAccess(createDto.sender_id, createDto.class_id);
        if (!hasAccess && !isAdmin) {
          throw new ForbiddenException('You are not assigned as a teacher for this class');
        }
      } else if (createDto.sender_type === 'student') {
        // Teachers can post on behalf of students (e.g., admins), but verify student access
        const hasAccess = await this.verifyStudentAccess(createDto.sender_id, createDto.class_id);
        if (!hasAccess && !isAdmin) {
          throw new ForbiddenException('Student does not have access to this class');
        }
      }
    } else {
      throw new ForbiddenException('Unauthorized to send messages');
    }

    // Validate that at least text or audio_url is provided
    if (!createDto.text && !createDto.audio_url) {
      throw new ForbiddenException('Message must contain either text or audio');
    }

    // Verify class exists
    const classEntity = await this.datasource.manager.findOne(Class, {
      where: { id: createDto.class_id },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    // Create the message
    const message = await this.messageModelAction.create({
      createPayload: {
        class_id: createDto.class_id,
        sender_id: createDto.sender_id,
        sender_type: createDto.sender_type,
        text: createDto.text || null,
        audio_url: createDto.audio_url || null,
        audio_duration: createDto.audio_duration || null,
      },
      transactionOptions: {
        useTransaction: false,
      },
    });

    return message;
  }

  /**
   * Get all messages for a class
   */
  async findByClassId(classId: string, userId: string, userRoles: string[]): Promise<ClassroomMessage[]> {
    if (!userId) {
      throw new ForbiddenException('User ID is required');
    }

    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes(UserRole.ADMIN);
    const isTeacher = userRoles.includes('TEACHER') || userRoles.includes(UserRole.TEACHER);
    const isStudent = (userRoles.includes('STUDENT') || userRoles.includes(UserRole.STUDENT)) && !isAdmin && !isTeacher;

    // Verify access
    if (isStudent) {
      const student = await this.datasource.manager.findOne(Student, {
        where: { id: userId },
      });
      if (!student) {
        throw new ForbiddenException(`Student not found with ID: ${userId}`);
      }
      const hasAccess = await this.verifyStudentAccess(student.id, classId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this class');
      }
    } else if (isTeacher || isAdmin) {
      // For admins, skip teacher lookup - they can view all messages
      if (isTeacher && !isAdmin) {
        const teacher = await this.datasource.manager.findOne(Teacher, {
          where: { id: userId },
        });
        if (!teacher) {
          throw new ForbiddenException(`Teacher not found with ID: ${userId}`);
        }
        const hasAccess = await this.verifyTeacherAccess(teacher.id, classId);
        if (!hasAccess) {
          throw new ForbiddenException('You are not assigned as a teacher for this class');
        }
      }
    } else {
      throw new ForbiddenException('Unauthorized to view messages');
    }

    // Get all messages for this class, ordered by creation date (oldest first)
    const messages = await this.messageRepository.find({
      where: { class_id: classId },
      relations: ['teacher', 'student', 'class'],
      order: { createdAt: 'ASC' },
    });

    return messages;
  }
}

