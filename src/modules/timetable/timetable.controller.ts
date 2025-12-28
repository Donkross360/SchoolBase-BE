import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../shared/enums';
import { StudentModelAction } from '../student/model-actions/student-actions';

import {
  AddScheduleDocs,
  EditScheduleDocs,
  GetAllTimetableDocs,
  GetTimetableDocs,
  UnassignRoomDocs,
} from './docs';
import {
  AddScheduleDto,
  GetTimetableResponseDto,
  UpdateScheduleDto,
} from './dto/timetable.dto';
import { DayOfWeek } from './enums/timetable.enums';
import { TimetableService } from './timetable.service';

@ApiTags('Timetables')
@Controller('timetables')
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly studentModelAction: StudentModelAction,
  ) {}

  @ApiExcludeEndpoint()
  @Post()
  create() {
    return this.timetableService.create();
  }

  @Post('schedule')
  @UseGuards(JwtAuthGuard)
  @AddScheduleDocs()
  addSchedule(@Body() dto: AddScheduleDto) {
    return this.timetableService.addSchedule(dto);
  }

  @Put('schedule/:schedule_id')
  @UseGuards(JwtAuthGuard)
  @EditScheduleDocs()
  editSchedule(
    @Param('schedule_id') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.timetableService.editSchedule(scheduleId, dto);
  }

  @Patch('schedule/:schedule_id/unassign-room')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @UnassignRoomDocs()
  unassignRoom(@Param('schedule_id') scheduleId: string) {
    return this.timetableService.unassignRoom(scheduleId);
  }

  @Get('view-time-table')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.TEACHER)
  @GetAllTimetableDocs()
  getAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('day') day?: DayOfWeek,
  ) {
    return this.timetableService.getAll(page, limit, day);
  }

  @Get('class/:classId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.STUDENT, UserRole.TEACHER)
  @GetTimetableDocs()
  async findByClass(
    @Param('classId') classId: string,
    @Request() req: any,
  ): Promise<GetTimetableResponseDto> {
    // Students can only view their own class timetable
    if (req.user.roles?.includes(UserRole.STUDENT) && !req.user.roles?.includes(UserRole.ADMIN)) {
      const studentId = req.user.student_id;
      if (!studentId) {
        throw new ForbiddenException('Student ID not found in token');
      }

      // Get student's current class
      const student = await this.studentModelAction.get({
        identifierOptions: { id: studentId },
        relations: {
          current_class: true,
          class_assignments: { class: true },
          stream: { class: true },
        },
      });

      // Check if the requested classId matches the student's class
      const activeClassAssignment = student.class_assignments?.find(ca => ca.is_active && ca.class) || null;
      const studentClassId = student.current_class?.id || activeClassAssignment?.class?.id || student.stream?.class?.id;

      if (studentClassId !== classId) {
        throw new ForbiddenException('Students can only view their own class timetable');
      }
    }

    // Parents can access timetables for classes their children are in
    // Frontend will only provide class IDs of students linked to the parent
    return this.timetableService.findByClass(classId);
  }

  @ApiExcludeEndpoint()
  @Get('teacher/:teacher_id')
  findByTeacher() {
    return this.timetableService.findByTeacher();
  }

  @ApiExcludeEndpoint()
  @Get(':id')
  findOne() {
    return this.timetableService.findOne();
  }

  @ApiExcludeEndpoint()
  @Patch(':id')
  update() {
    return this.timetableService.update();
  }

  @ApiExcludeEndpoint()
  @Patch(':id/archive')
  archive() {
    return this.timetableService.archive();
  }

  @ApiExcludeEndpoint()
  @Delete(':id')
  remove() {
    return this.timetableService.remove();
  }
}
