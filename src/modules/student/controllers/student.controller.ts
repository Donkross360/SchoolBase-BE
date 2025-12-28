import {
  Controller,
  Get,
  Param,
  Delete,
  Post,
  Body,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { IUserPayload } from '../../parent/parent.service';
import { UserRole } from '../../shared/enums';
import {
  StudentSwagger,
  CreateStudentDocs,
  GetStudentDocs,
  ListStudentsDocs,
  UpdateStudentDocs,
  DeleteStudentDocs,
  studentGrowthDecorator,
} from '../docs';
import { GetStudentProfileDocs } from '../docs/get-student-profile.docs';
import {
  CreateStudentDto,
  ListStudentsDto,
  StudentResponseDto,
  PatchStudentDto,
  StudentProfileResponseDto,
  BulkNfcAssignmentDto,
} from '../dto';
import { StudentService } from '../services';

@ApiTags(StudentSwagger.tags[0])
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @CreateStudentDocs()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createStudentDto: CreateStudentDto,
  ): Promise<StudentResponseDto> {
    return this.studentService.create(createStudentDto);
  }

  // --- GET: LIST ALL STUDENTS (with pagination and search) ---
  @Get()
  @ListStudentsDocs()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAll(@Query() listStudentsDto: ListStudentsDto) {
    return this.studentService.findAll(listStudentsDto);
  }

  // ----get student growth ----
  @studentGrowthDecorator()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('student-growth-report')
  async getStudentGrowthReport(@Query('academic_year') academicYear: string) {
    return this.studentService.getStudentGrowthReport(academicYear);
  }

  // --- GET: GET LOGGED-IN STUDENT'S PROFILE ---
  @Get('/profile/:studentId')
  @GetStudentProfileDocs()
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOkResponse({ description: sysMsg.PROFILE_RETRIEVED })
  async getMyProfile(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: IUserPayload,
  ): Promise<{
    message: string;
    status_code: number;
    data: StudentProfileResponseDto;
  }> {
    const data = await this.studentService.getMyProfile(studentId, user);
    return {
      message: sysMsg.PROFILE_RETRIEVED,
      status_code: HttpStatus.OK,
      data,
    };
  }

  // --- GET: GET SINGLE STUDENT BY ID ---
  @Get(':id')
  @GetStudentDocs()
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.studentService.findOne(id);
  }

  @UpdateStudentDocs()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentDto: PatchStudentDto,
  ) {
    return this.studentService.update(id, updateStudentDto);
  }

  @DeleteStudentDocs()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentService.remove(id);
  }

  // --- POST: BULK ASSIGN NFC CARD IDs ---
  @Post('nfc-cards/bulk-assign')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Bulk NFC card assignment completed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  student_identifier: { type: 'string' },
                  success: { type: 'boolean' },
                  nfc_card_id: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  bulkAssignNfcCards(@Body() dto: BulkNfcAssignmentDto) {
    return this.studentService.bulkAssignNfcCards(dto);
  }

  // --- GET: GENERATE QR CODE FOR NFC CARD ID ---
  @Get('nfc-cards/:cardId/qr-code')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'QR code generated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            card_id: { type: 'string' },
            qr_code_data_url: { type: 'string', format: 'data-url' },
          },
        },
      },
    },
  })
  generateNfcQrCode(@Param('cardId') cardId: string) {
    return this.studentService.generateNfcQrCode(cardId);
  }

  // --- POST: BULK IMPORT NFC CARDS FROM CSV FILE ---
  @Post('nfc-cards/bulk-import')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'CSV import completed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  student_identifier: { type: 'string' },
                  success: { type: 'boolean' },
                  nfc_card_id: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async bulkImportNfcCards(@UploadedFile() file: Express.Multer.File) {
    const { CsvNfcParserService } = await import(
      '../services/csv-nfc-parser.service'
    );
    const parser = new CsvNfcParserService();
    const dto = await parser.parseCsvFile(file);
    return this.studentService.bulkAssignNfcCards(dto);
  }

  // --- GET: EXPORT NFC CARDS TO CSV ---
  @Get('nfc-cards/export-csv')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async exportNfcCardsCsv(@Res() res: Response) {
    const result = await this.studentService.exportNfcCardsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfc-cards-export-${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.send(result.data);
  }

  // report.controller.ts
}
