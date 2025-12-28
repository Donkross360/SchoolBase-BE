import { ApiProperty } from '@nestjs/swagger';

import { SessionStatus } from '../../academic-session/entities';
import { ClassSubject, ClassTeacher } from '../../class/entities';
import { Schedule } from '../../timetable/entities/schedule.entity';
import { User } from '../../user/entities/user.entity';
import { Student } from '../entities';

import { StudentResponseDto } from './student-response.dto';

export class StudentAcademicDetailDto {
  @ApiProperty({
    description: 'The academic session ID (UUID)',
    example: 'c3a3c1a9-5e3e-4f7a-b7a7-2f1c0b7a0a0a',
    nullable: true,
  })
  id?: string;

  @ApiProperty({
    description: 'The academic year, e.g., "2023/2024"',
    example: '2023/2024',
    nullable: true,
  })
  academic_year?: string;

  @ApiProperty({
    description: 'The name of the academic session',
    example: '2023/2024 Session',
  })
  name: string;

  @ApiProperty({ description: 'The start date of the session' })
  start_date: Date;

  @ApiProperty({ description: 'The end date of the session' })
  end_date: Date;

  @ApiProperty({
    description: 'A brief description of the session',
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'The status of the session',
    enum: SessionStatus,
    example: SessionStatus.ACTIVE,
  })
  status: SessionStatus;
}

export class StudentSubjectDetailDto {
  @ApiProperty({
    description: "The teacher's details",
    type: ClassTeacher,
    isArray: true,
  })
  teachers: ClassTeacher[] | [];

  @ApiProperty({
    description: "The subject's detail",
    type: ClassSubject,
    isArray: true,
  })
  subjects: ClassSubject[] | [];
}

export class StudentTimetableDetailDto {
  @ApiProperty({
    description: 'The timetable schedule',
    type: Schedule,
    isArray: true,
  })
  schedules: Schedule[];
}

export class StudentClassDetailDto {
  @ApiProperty({
    description: 'The ID of the class',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The name of the class',
    example: 'Primary 1',
  })
  name: string;
}

export class StudentProfileResponseDto extends StudentResponseDto {
  @ApiProperty({
    description: 'The student academic details',
    type: StudentAcademicDetailDto,
    nullable: true,
  })
  academic_details?: StudentAcademicDetailDto;

  @ApiProperty({
    description: 'The student subject details',
    type: StudentSubjectDetailDto,
    nullable: true,
  })
  subject_details?: StudentSubjectDetailDto;

  @ApiProperty({
    description: 'The student timetable details',
    type: StudentTimetableDetailDto,
    nullable: true,
  })
  timetable_details?: StudentTimetableDetailDto;

  @ApiProperty({
    description: 'The student class details',
    type: StudentClassDetailDto,
    nullable: true,
  })
  class_details?: StudentClassDetailDto | null;

  constructor(student: Student, user: User, message?: string) {
    super(student, user, message);
    
    // Prioritize current_class, then active class_assignments, then stream.class
    // This matches how students are assigned via admin (uses class_assignments and current_class_id)
    const activeClassAssignment = student.class_assignments?.find(ca => ca.is_active && ca.class) || null;
    const studentClass = student.current_class || activeClassAssignment?.class || student.stream?.class || null;
    const academicSession = studentClass?.academicSession;

    // Debug logging to understand why class_details might be missing
    console.log('[StudentProfileResponseDto] Constructor debug:', {
      studentId: student.id,
      hasCurrentClass: !!student.current_class,
      currentClassId: student.current_class?.id,
      currentClassName: student.current_class?.name,
      hasClassAssignments: !!student.class_assignments?.length,
      activeClassAssignment: activeClassAssignment ? {
        id: activeClassAssignment.id,
        classId: activeClassAssignment.class?.id,
        className: activeClassAssignment.class?.name,
      } : null,
      hasStream: !!student.stream,
      streamClassId: student.stream?.class?.id,
      streamClassName: student.stream?.class?.name,
      resolvedStudentClass: studentClass ? {
        id: studentClass.id,
        name: studentClass.name,
      } : null,
      hasAcademicSession: !!academicSession,
      academicSessionId: academicSession?.id,
    });

    this.academic_details = academicSession
      ? {
          id: academicSession.id,
          academic_year: academicSession.academicYear,
          name: academicSession.name,
          start_date: academicSession.startDate,
          end_date: academicSession.endDate,
          description: academicSession.description,
          status: academicSession.status,
        }
      : null;
    this.subject_details = studentClass
      ? {
          teachers: studentClass.teacher_assignment || [],
          subjects: studentClass.classSubjects || [],
        }
      : null;
    this.timetable_details = studentClass
      ? {
          schedules: studentClass.timetable?.schedules || [],
        }
      : null;
    this.class_details = studentClass
      ? {
          id: studentClass.id,
          name: studentClass.name ?? '',
        }
      : null;

    // Log what we're setting
    console.log('[StudentProfileResponseDto] Set values:', {
      class_details: this.class_details,
      academic_details: this.academic_details ? { id: this.academic_details.id, name: this.academic_details.name } : null,
    });
  }
}
