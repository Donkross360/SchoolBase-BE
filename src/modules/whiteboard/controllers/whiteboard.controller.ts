import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../shared/enums';
import { UpdateWhiteboardDto } from '../dto/update-whiteboard.dto';
import { WhiteboardResponseDto } from '../dto/whiteboard-response.dto';
import { WhiteboardService } from '../services/whiteboard.service';

@Controller('whiteboards')
@ApiTags('Whiteboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
export class WhiteboardController {
  constructor(private readonly whiteboardService: WhiteboardService) {}

  /**
   * Get whiteboard for a class (view-only for students)
   */
  @Get('class/:classId')
  @HttpCode(HttpStatus.OK)
  async getByClass(
    @Param('classId') classId: string,
    @Request() req: any,
  ): Promise<WhiteboardResponseDto> {
    const userRoles = req.user.roles || [];
    const isStudent = userRoles.includes(UserRole.STUDENT) && !userRoles.includes(UserRole.ADMIN);
    const isTeacher = userRoles.includes(UserRole.TEACHER) || userRoles.includes(UserRole.ADMIN);

    // Verify access
    if (isStudent) {
      const studentId = req.user.student_id;
      if (!studentId) {
        throw new ForbiddenException('Student ID not found in token');
      }
      const hasAccess = await this.whiteboardService.verifyStudentAccess(studentId, classId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this class whiteboard');
      }
    } else if (isTeacher) {
      const teacherId = req.user.teacher_id;
      if (!teacherId) {
        throw new ForbiddenException('Teacher ID not found in token');
      }
      const hasAccess = await this.whiteboardService.verifyTeacherAccess(teacherId, classId);
      if (!hasAccess && !userRoles.includes(UserRole.ADMIN)) {
        throw new ForbiddenException('You are not assigned as a teacher for this class');
      }
    }

    const whiteboard = await this.whiteboardService.findByClassId(classId);
    return whiteboard as WhiteboardResponseDto;
  }

  /**
   * Update whiteboard (teachers, admins, and students with edit rights)
   */
  @Patch('class/:classId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('classId') classId: string,
    @Body() updateDto: UpdateWhiteboardDto,
    @Request() req: any,
  ): Promise<WhiteboardResponseDto> {
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes(UserRole.ADMIN);
    const isTeacher = userRoles.includes(UserRole.TEACHER);
    const isStudent = userRoles.includes(UserRole.STUDENT) && !isAdmin && !isTeacher;

    // Check if student is trying to update
    if (isStudent) {
      const studentId = req.user.student_id;
      if (!studentId) {
        throw new ForbiddenException('Student ID not found in token');
      }

      // Verify student has access to this class
      const hasAccess = await this.whiteboardService.verifyStudentAccess(studentId, classId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this class whiteboard');
      }

      // Get the current whiteboard to check allow_student_edit
      const whiteboard = await this.whiteboardService.findByClassId(classId);
      if (!whiteboard || !whiteboard.allow_student_edit) {
        throw new ForbiddenException('Student editing is not enabled for this whiteboard');
      }

      // Students can only update canvas_state, not other fields
      // Filter out any other fields to prevent students from modifying them
      const studentUpdateDto: UpdateWhiteboardDto = {
        canvas_state: updateDto.canvas_state,
      };

      const updated = await this.whiteboardService.update(classId, studentUpdateDto);
      return updated as WhiteboardResponseDto;
    }

    // For teachers and admins, verify access
    if (!isAdmin && !isTeacher) {
      throw new ForbiddenException('Only teachers, admins, and authorized students can update whiteboards');
    }

    // Verify teacher access (admins bypass this check)
    if (isTeacher && !isAdmin) {
      const teacherId = req.user.teacher_id;
      if (!teacherId) {
        throw new ForbiddenException('Teacher ID not found in token');
      }
      const hasAccess = await this.whiteboardService.verifyTeacherAccess(teacherId, classId);
      if (!hasAccess) {
        throw new ForbiddenException('You are not assigned as a teacher for this class');
      }
    }

    // Teachers and admins can update all fields
    const updated = await this.whiteboardService.update(classId, updateDto);
    return updated as WhiteboardResponseDto;
  }
}

