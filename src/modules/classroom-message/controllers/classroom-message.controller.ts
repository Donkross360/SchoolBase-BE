import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../shared/enums';
import { CreateMessageDto, MessageSenderType } from '../dto/create-message.dto';
import { MessageResponseDto } from '../dto/message-response.dto';
import { ClassroomMessageService } from '../services/classroom-message.service';

@Controller('classroom-messages')
@ApiTags('Classroom Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
export class ClassroomMessageController {
  constructor(private readonly messageService: ClassroomMessageService) {}

  /**
   * Get all messages for a class
   */
  @Get('class/:classId')
  @HttpCode(HttpStatus.OK)
  async getByClass(
    @Param('classId') classId: string,
    @Request() req: any,
  ): Promise<MessageResponseDto[]> {
    const userRoles = req.user.roles || [];
    
    // Determine the correct ID based on user role
    // For students, use student_id; for teachers, use teacher_id; for admins, use userId
    let userId: string | undefined;
    if (userRoles.includes(UserRole.STUDENT) && !userRoles.includes(UserRole.ADMIN)) {
      userId = req.user.student_id;
    } else if (userRoles.includes(UserRole.TEACHER) || userRoles.includes(UserRole.ADMIN)) {
      userId = req.user.teacher_id || req.user.userId;
    } else {
      userId = req.user.userId || req.user.teacher_id || req.user.student_id;
    }

    if (!userId) {
      throw new ForbiddenException('Unable to determine user ID from token');
    }

    const messages = await this.messageService.findByClassId(classId, userId, userRoles);
    
    // Map messages to include sender names
    return messages.map((msg) => {
      const dto: MessageResponseDto = {
        ...msg,
        sender_name: this.getSenderName(msg),
      };
      return dto;
    }) as MessageResponseDto[];
  }

  /**
   * Create a new message
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateMessageDto,
    @Request() req: any,
  ): Promise<MessageResponseDto> {
    const userId = req.user.userId || req.user.teacher_id || req.user.student_id;
    const userRoles = req.user.roles || [];

    // Determine sender_id and sender_type from the user's role
    // If not provided in DTO, use the user's ID and role from the JWT token
    if (!createDto.sender_id || !createDto.sender_type) {
      const isTeacher = userRoles.includes(UserRole.TEACHER) || userRoles.includes(UserRole.ADMIN);
      const isStudent = userRoles.includes(UserRole.STUDENT) && !userRoles.includes(UserRole.ADMIN);

      if (isTeacher) {
        createDto.sender_id = req.user.teacher_id || userId;
        createDto.sender_type = MessageSenderType.TEACHER;
      } else if (isStudent) {
        createDto.sender_id = req.user.student_id || userId;
        createDto.sender_type = MessageSenderType.STUDENT;
      } else {
        throw new ForbiddenException('Unable to determine sender type from token');
      }

      // Ensure both fields are set
      if (!createDto.sender_id || !createDto.sender_type) {
        throw new ForbiddenException('Unable to determine sender information from token');
      }
    }

    const message = await this.messageService.create(createDto, userId, userRoles);
    
    // Map message to include sender name
    const dto: MessageResponseDto = {
      ...message,
      sender_name: this.getSenderName(message),
    };
    
    return dto;
  }

  /**
   * Extract sender name from message entity
   */
  private getSenderName(message: any): string | undefined {
    if (message.sender_type === 'teacher' && message.teacher?.user) {
      const user = message.teacher.user;
      return `${user.first_name || ''} ${user.last_name || ''}`.trim() || undefined;
    } else if (message.sender_type === 'student' && message.student?.user) {
      const user = message.student.user;
      return `${user.first_name || ''} ${user.last_name || ''}`.trim() || undefined;
    }
    return undefined;
  }
}

