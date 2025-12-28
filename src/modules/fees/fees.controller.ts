import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  Patch,
  Param,
  ForbiddenException,
} from '@nestjs/common';

import * as sysMsg from '../../constants/system.messages';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../shared/enums';

import {
  swaggerCreateFee,
  swaggerGetAFee,
  swaggerGetAllFees,
  swaggerDeactivateFee,
  swaggerUpdateFee,
  swaggerActivateFee,
  swaggerGetFeeStudents,
  swaggerGetActiveFeeComponents,
  swaggerGetStudentFeeDetails,
} from './docs/fees.swagger';
import { DeactivateFeeDto } from './dto/deactivate-fee.dto';
import { FeeStudentResponseDto } from './dto/fee-students-response.dto';
import { CreateFeesDto, QueryFeesDto, UpdateFeesDto } from './dto/fees.dto';
import { GetActiveFeesDto } from './dto/get-active-fees.dto';
import { StudentFeeDetailsQueryDto } from './dto/student-fee-details.dto';
import { FeesService } from './fees.service';
import { StudentModelAction } from '../student/model-actions/student-actions';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeesController {
  constructor(
    private readonly feesService: FeesService,
    private readonly studentModelAction: StudentModelAction,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @swaggerCreateFee()
  async createFee(
    @Body() createFeesDto: CreateFeesDto,
    @Request() req: { user: { userId: string } },
  ) {
    const fee = await this.feesService.create(createFeesDto, req.user.userId);
    return {
      message: sysMsg.FEE_CREATED_SUCCESSFULLY,
      fee,
    };
  }

  @Get()
  @swaggerGetAllFees()
  async getAllFees(@Query() queryDto: QueryFeesDto) {
    const result = await this.feesService.findAll(queryDto);
    return {
      message: sysMsg.FEES_RETRIEVED_SUCCESSFULLY,
      ...result,
    };
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @swaggerDeactivateFee()
  async deactivateFee(
    @Param('id') id: string,
    @Body() deactivateFeeDto: DeactivateFeeDto,
    @Request() req: { user: { userId: string } },
  ) {
    const fee = await this.feesService.deactivate(
      id,
      req.user.userId,
      deactivateFeeDto.reason,
    );
    return {
      message: sysMsg.FEE_DEACTIVATED_SUCCESSFULLY,
      data: fee,
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @swaggerUpdateFee()
  async updateFee(
    @Param('id') id: string,
    @Body() updateFeesDto: UpdateFeesDto,
  ) {
    const fee = await this.feesService.update(id, updateFeesDto);
    return {
      message: sysMsg.FEE_UPDATED_SUCCESSFULLY,
      fee,
    };
  }
  @Get('active')
  @Roles(UserRole.ADMIN)
  @swaggerGetActiveFeeComponents()
  async getActiveFeeComponents(@Query() query: GetActiveFeesDto) {
    const result = await this.feesService.getActiveFeeComponents(query);
    return {
      message: sysMsg.FEES_RETRIEVED_SUCCESSFULLY,
      ...result,
    };
  }

  @Get(':id')
  @swaggerGetAFee()
  async getFeeById(@Param('id') id: string) {
    const result = await this.feesService.findOne(id);
    return {
      message: sysMsg.FEE_RETRIEVED_SUCCESSFULLY,
      ...result,
    };
  }

  @Get(':id/students')
  @Roles(UserRole.ADMIN)
  @swaggerGetFeeStudents()
  async getFeeStudents(@Param('id') id: string): Promise<{
    message: string;
    data: FeeStudentResponseDto[];
  }> {
    const students = await this.feesService.getStudentsForFee(id);
    return {
      message: sysMsg.FEES_RETRIEVED_SUCCESSFULLY,
      data: students,
    };
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @swaggerActivateFee()
  async activateFee(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    const fee = await this.feesService.activate(id, req.user.userId);
    return {
      message: sysMsg.FEE_UPDATED_SUCCESSFULLY,
      fee,
    };
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.STUDENT)
  @swaggerGetStudentFeeDetails()
  async getStudentFeeDetails(
    @Param('studentId') studentId: string,
    @Query() query: StudentFeeDetailsQueryDto,
    @Request() req: any,
  ) {
    // If parent, verify the student belongs to them
    if (req.user.roles.includes(UserRole.PARENT) && !req.user.roles.includes(UserRole.ADMIN)) {
      const parentId = req.user.parent_id;
      if (!parentId) {
        throw new ForbiddenException('Parent ID not found in token');
      }
      // Verify student belongs to this parent
      const student = await this.studentModelAction.get({
        identifierOptions: { id: studentId, parent: { id: parentId } },
      });
      if (!student) {
        throw new ForbiddenException('Student does not belong to this parent');
      }
    }
    
    // If student, verify they can only view their own fees
    if (req.user.roles.includes(UserRole.STUDENT) && !req.user.roles.includes(UserRole.ADMIN)) {
      const authenticatedStudentId = req.user.student_id;
      if (!authenticatedStudentId) {
        throw new ForbiddenException('Student ID not found in token');
      }
      // Verify the requested studentId matches the authenticated student's ID
      if (studentId !== authenticatedStudentId) {
        throw new ForbiddenException('You can only view your own fee details');
      }
    }
    
    const result = await this.feesService.getStudentFeeDetails(
      studentId,
      query.term_id,
      query.session_id,
    );
    return {
      message: sysMsg.FEES_RETRIEVED_SUCCESSFULLY,
      data: result,
    };
  }
}
