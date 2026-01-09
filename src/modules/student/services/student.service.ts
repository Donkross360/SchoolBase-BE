import { PaginationMeta } from '@hng-sdk/orm';
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Like } from 'typeorm';
import { Logger } from 'winston';

import { AcademicSessionModelAction } from 'src/modules/academic-session/model-actions/academic-session-actions';
import { ClassStudentModelAction } from 'src/modules/class/model-actions/class-student.action';
import { ClassModelAction } from 'src/modules/class/model-actions/class.actions';

import * as sysMsg from '../../../constants/system.messages';
import { AccountCreationService } from '../../email/account-creation.service';
import { IUserPayload } from '../../parent/parent.service';
import { UserRole } from '../../shared/enums';
import { FileService } from '../../shared/file/file.service';
import {
  generateResetToken,
  hashPassword,
  generateSecureNfcCardId,
  normalizeNfcCardId,
  validateNfcCardId,
} from '../../shared/utils';
import { BulkNfcAssignmentDto } from '../dto/bulk-nfc-assignment.dto';
import { UserModelAction } from '../../user/model-actions/user-actions';
import {
  CreateStudentDto,
  StudentResponseDto,
  ListStudentsDto,
  PatchStudentDto,
  StudentProfileResponseDto,
} from '../dto';
import { StudentGrowthReportResponseDto } from '../dto/student.growth.dto';
import { Student } from '../entities';
import { StudentModelAction } from '../model-actions';

@Injectable()
export class StudentService {
  private readonly logger: Logger;
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
    private readonly userModelAction: UserModelAction,
    private readonly studentModelAction: StudentModelAction,
    private readonly dataSource: DataSource,
    private readonly fileService: FileService,
    private readonly classStudentModelAction: ClassStudentModelAction,
    private readonly classModelAction: ClassModelAction,
    private readonly academicSessionModelAction: AcademicSessionModelAction,
    private readonly accountCreationService: AccountCreationService,
  ) {
    this.logger = baseLogger.child({ context: StudentService.name });
  }

  async create(
    createStudentDto: CreateStudentDto,
  ): Promise<StudentResponseDto> {
    // Check if there's an active (non-deleted) student with this email
    const activeStudentWithEmail = await this.dataSource.manager
      .createQueryBuilder(Student, 'student')
      .innerJoin('student.user', 'user')
      .where('user.email = :email', { email: createStudentDto.email })
      .andWhere('student.is_deleted = :isDeleted', { isDeleted: false })
      .andWhere('user.deleted_at IS NULL')
      .getOne();

    if (activeStudentWithEmail) {
      this.logger.warn(
        `Attempt to create student with existing email: ${createStudentDto.email}`,
      );
      throw new ConflictException(sysMsg.STUDENT_EMAIL_CONFLICT);
    }
    const registration_number = await this.generateStudentNumber();

    const existingStudent = await this.studentModelAction.get({
      identifierOptions: { registration_number },
    });

    if (existingStudent) {
      this.logger.warn(
        `Attempt to create student with existing registration number: ${registration_number}`,
      );
      throw new ConflictException(sysMsg.STUDENT_REGISTRATION_NUMBER_CONFLICT);
    }

    const hashedPassword = await hashPassword(createStudentDto.password);

    let photo_url: string | undefined = undefined;
    if (createStudentDto.photo_url) {
      photo_url = this.fileService.validatePhotoUrl(createStudentDto.photo_url);
    }

    const { resetToken, resetTokenExpiry } = generateResetToken(24);

    const { savedUser, savedStudent } = await this.dataSource.transaction(
      async (manager) => {
        const savedUser = await this.userModelAction.create({
          createPayload: {
            first_name: createStudentDto.first_name,
            last_name: createStudentDto.last_name,
            middle_name: createStudentDto.middle_name,
            email: createStudentDto.email,
            phone: createStudentDto.phone,
            gender: createStudentDto.gender,
            dob: new Date(createStudentDto.date_of_birth),
            homeAddress: createStudentDto.home_address,
            password: hashedPassword,
            role: [UserRole.STUDENT],
            is_active: createStudentDto.is_active ?? true,
            reset_token: resetToken,
            reset_token_expiry: resetTokenExpiry,
          },
          transactionOptions: {
            useTransaction: true,
            transaction: manager,
          },
        });

        const savedStudent = await this.studentModelAction.create({
          createPayload: {
            user: { id: savedUser.id },
            registration_number,
            photo_url: photo_url,
          },
          transactionOptions: {
            useTransaction: true,
            transaction: manager,
          },
        });

        this.logger.info(sysMsg.RESOURCE_CREATED, {
          studentId: savedStudent.id,
          registration_number,
          email: savedUser.email,
        });

        return { savedUser, savedStudent };
      },
    );

    // Attempt to send email, but don't fail the operation if it fails
    try {
      await this.accountCreationService.sendAccountCreationEmail(
        `${savedUser.first_name} ${savedUser.last_name}`,
        savedUser.email,
        createStudentDto.password,
        UserRole.STUDENT,
        resetToken,
      );
    } catch (emailError) {
      // Log email error but don't throw - student has already been created
      this.logger.warn(
        `Failed to send account creation email for student ${savedStudent.id} (${savedUser.email}). Student account was created successfully.`,
        {
          error: emailError instanceof Error ? emailError.message : String(emailError),
          stack: emailError instanceof Error ? emailError.stack : undefined,
          studentId: savedStudent.id,
          email: savedUser.email,
        },
      );
    }

    return new StudentResponseDto(
      savedStudent,
      savedUser,
      sysMsg.STUDENT_CREATED,
    );
  }

  // --- FIND ALL (with pagination and search) ---
  async findAll(listStudentsDto: ListStudentsDto): Promise<{
    message: string;
    status_code: number;
    data: StudentResponseDto[];
    meta: Partial<PaginationMeta>;
  }> {
    const { page = 1, limit = 10, search, unassigned } = listStudentsDto;

    // Use query builder if we have search or unassigned filter (complex filtering)
    // Otherwise use model action for simple filtering
    const { payload: students, paginationMeta } =
      search || unassigned !== undefined
        ? await this.searchStudentsWithModelAction(
            search || '',
            page,
            limit,
            unassigned,
          )
        : await this.studentModelAction.list({
            filterRecordOptions: {
              is_deleted: false,
            },
            relations: { user: true, stream: true },
            paginationPayload: { page, limit },
            order: { createdAt: 'DESC' },
          });

    const data = students.map(
      (student) => new StudentResponseDto(student, student.user),
    );

    this.logger.info(`Fetched ${data.length} students`, {
      searchTerm: search,
      unassigned,
      page,
      limit,
      total: paginationMeta.total,
    });

    return {
      message: sysMsg.STUDENTS_FETCHED,
      status_code: 200,
      data,
      meta: paginationMeta,
    };
  }

  // --- FIND ONE ---
  async findOne(id: string): Promise<StudentResponseDto> {
    const student = await this.studentModelAction.get({
      identifierOptions: { id },
      relations: { user: true, stream: true },
    });

    if (!student || student.is_deleted) {
      this.logger.warn(`Student not found with ID: ${id}`);
      throw new NotFoundException(sysMsg.STUDENT_NOT_FOUND);
    }

    return new StudentResponseDto(
      student,
      student.user,
      sysMsg.STUDENT_FETCHED,
    );
  }

  async update(
    id: string,
    updateStudentDto: PatchStudentDto,
  ): Promise<StudentResponseDto> {
    const existingStudent = await this.studentModelAction.get({
      identifierOptions: { id },
      relations: {
        user: true,
      },
    });
    if (!existingStudent || existingStudent.is_deleted)
      throw new NotFoundException(sysMsg.STUDENT_NOT_FOUND);
    if (updateStudentDto.email) {
      const existingUser = await this.userModelAction.get({
        identifierOptions: { email: updateStudentDto.email },
      });

      if (existingUser && existingUser.id !== existingStudent.user.id) {
        this.logger.warn(
          `Attempt to update student with existing email: ${updateStudentDto.email}`,
        );
        throw new ConflictException(sysMsg.STUDENT_EMAIL_CONFLICT);
      }
    }
    return this.dataSource.transaction(async (manager) => {
      const updatedUser = await this.userModelAction.update({
        identifierOptions: { id: existingStudent.user.id },
        updatePayload: {
          first_name: updateStudentDto.first_name,
          last_name: updateStudentDto.last_name,
          middle_name: updateStudentDto.middle_name,
          email: updateStudentDto.email,
          phone: updateStudentDto.phone,
          gender: updateStudentDto.gender,
          dob: updateStudentDto.date_of_birth
            ? new Date(updateStudentDto.date_of_birth)
            : undefined,
          homeAddress: updateStudentDto.home_address,
        },
        transactionOptions: {
          useTransaction: true,
          transaction: manager,
        },
      });

      let student = existingStudent;

      // Handle photo_url update
      if (updateStudentDto.photo_url !== undefined) {
        const photo_url = updateStudentDto.photo_url
          ? this.fileService.validatePhotoUrl(updateStudentDto.photo_url)
          : null;
        student = await this.studentModelAction.update({
          identifierOptions: { id },
          updatePayload: {
            photo_url: photo_url,
          },
          transactionOptions: {
            useTransaction: true,
            transaction: manager,
          },
        });
      }

      // Handle nfc_card_id update with uniqueness validation and security checks
      if (updateStudentDto.nfc_card_id !== undefined || updateStudentDto.auto_generate_nfc_id) {
        let rawNfcCardId: string | null = null;

        // Auto-generate if requested
        if (updateStudentDto.auto_generate_nfc_id === true) {
          rawNfcCardId = generateSecureNfcCardId();
          this.logger.info(`Auto-generated NFC card ID: ${rawNfcCardId} for student ${id}`);
        } else if (updateStudentDto.nfc_card_id !== undefined) {
          rawNfcCardId = updateStudentDto.nfc_card_id?.trim() || null;
        }

        if (rawNfcCardId) {
          // Normalize and validate NFC card ID
          const normalizedId = normalizeNfcCardId(rawNfcCardId);
          const validation = validateNfcCardId(normalizedId);

          if (!validation.valid) {
            throw new BadRequestException(
              validation.error || 'Invalid NFC card ID format',
            );
          }

          // Check for uniqueness (case-insensitive, normalized)
          if (normalizedId !== existingStudent.nfc_card_id?.toUpperCase()) {
            // Check if any other student has this card ID (case-insensitive)
            const allStudents = await manager
              .createQueryBuilder(Student, 'student')
              .where('UPPER(student.nfc_card_id) = UPPER(:nfcCardId)', {
                nfcCardId: normalizedId,
              })
              .andWhere('student.id != :currentId', { currentId: id })
              .andWhere('student.is_deleted = false')
              .getOne();

            if (allStudents) {
              this.logger.warn(
                `Attempt to assign NFC card ID ${normalizedId} which is already assigned to student ${allStudents.id}`,
              );
              throw new ConflictException(
                `NFC card ID is already assigned to another student`,
              );
            }
          }

          // Store normalized (uppercase) version for consistency
          student = await this.studentModelAction.update({
            identifierOptions: { id },
            updatePayload: {
              nfc_card_id: normalizedId,
            },
            transactionOptions: {
              useTransaction: true,
              transaction: manager,
            },
          });
        } else {
          // Setting to null - just update
          student = await this.studentModelAction.update({
            identifierOptions: { id },
            updatePayload: {
              nfc_card_id: null,
            },
            transactionOptions: {
              useTransaction: true,
              transaction: manager,
            },
          });
        }
      }

      this.logger.info(sysMsg.RESOURCE_UPDATED, {
        studentId: id,
      });

      return new StudentResponseDto(
        student,
        updatedUser,
        sysMsg.STUDENT_UPDATED,
      );
    });
  }

  async remove(id: string) {
    const existingStudent = await this.studentModelAction.get({
      identifierOptions: { id },
      relations: {
        user: true,
      },
    });
    if (!existingStudent || existingStudent.is_deleted)
      throw new NotFoundException(sysMsg.STUDENT_NOT_FOUND);
    return this.dataSource.transaction(async (manager) => {
      // Update user email to allow reuse when student is deleted
      // Append a unique identifier to the email to free it for reuse
      // Format: original.email+deleted.{timestamp}@domain.com or original.email.deleted.{timestamp}
      const originalEmail = existingStudent.user.email;
      const timestamp = Date.now();
      // Try to preserve the email structure by inserting before @ or appending if no @
      const deletedEmail = originalEmail.includes('@') 
        ? originalEmail.replace('@', `+deleted.${timestamp}@`)
        : `${originalEmail}.deleted.${timestamp}`;
      
      await this.userModelAction.update({
        identifierOptions: { id: existingStudent.user.id },
        updatePayload: {
          deleted_at: new Date(),
          is_active: false,
          email: deletedEmail, // Change email to allow reuse of original email
        },
        transactionOptions: {
          useTransaction: true,
          transaction: manager,
        },
      });

      await this.studentModelAction.update({
        identifierOptions: { id },
        updatePayload: {
          is_deleted: true,
          deleted_at: new Date(),
        },
        transactionOptions: {
          useTransaction: true,
          transaction: manager,
        },
      });

      this.logger.info(sysMsg.RESOURCE_DELETED, {
        studentId: id,
      });

      return { message: sysMsg.STUDENT_DELETED };
    });
  }

  // --- SEARCH STUDENTS (private method) ---
  /**
   * Search and filter students using query builder.
   * Supports search by name/email/registration and filtering by assignment status.
   *
   * @param search - Search term (optional)
   * @param page - Page number
   * @param limit - Items per page
   * @param unassigned - Filter by assignment status: true = unassigned only, false = assigned only, undefined = all
   * @returns Paginated list of students
   */
  private async searchStudentsWithModelAction(
    search: string,
    page: number = 1,
    limit: number = 10,
    unassigned?: boolean,
  ): Promise<{
    payload: Student[];
    paginationMeta: Partial<PaginationMeta>;
  }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.studentModelAction['repository']
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.user', 'user')
      .leftJoinAndSelect('student.stream', 'stream')
      .orderBy('student.createdAt', 'DESC')
      .where('student.is_deleted IS NOT TRUE');

    // Add search condition
    if (search && search.trim()) {
      queryBuilder.andWhere(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search OR student.registration_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Add unassigned filter
    if (unassigned === true) {
      queryBuilder.andWhere('student.current_class_id IS NULL');
    } else if (unassigned === false) {
      queryBuilder.andWhere('student.current_class_id IS NOT NULL');
    }

    const total = await queryBuilder.getCount();
    const payload = await queryBuilder.skip(skip).take(limit).getMany();

    const paginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return { payload, paginationMeta };
  }

  /**
   * Generate a unique Student Number in the format STU-YYYY-XXXX
   * where YYYY is the current year and XXXX is a 4-digit sequential number.
   */
  private async generateStudentNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `STU-${currentYear}-`;

    // Fetch the last student number for this year
    const lastRecord = await this.studentModelAction.find({
      findOptions: {
        registration_number: Like(`${yearPrefix}%`),
      },
      transactionOptions: { useTransaction: false },
      paginationPayload: { limit: 1, page: 1 },
      order: { registration_number: 'DESC' },
    });

    let nextSequence = 1;

    if (lastRecord?.payload?.length > 0) {
      const lastStudentNumber = lastRecord.payload[0].registration_number;

      if (lastStudentNumber) {
        const parts = lastStudentNumber.split('-');
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2], 10);
          if (!isNaN(lastSeq)) {
            nextSequence = lastSeq + 1;
          }
        }
      }
    }

    const sequenceStr = String(nextSequence).padStart(4, '0');
    return `${yearPrefix}${sequenceStr}`;
  }

  //student growth api

  async getStudentGrowthReport(
    academicYear: string,
  ): Promise<StudentGrowthReportResponseDto> {
    // --- 1. Find academic session ---
    const academicSessionResponse = await this.academicSessionModelAction.find({
      findOptions: { name: academicYear },
      transactionOptions: { useTransaction: false },
    });

    const academicSession = academicSessionResponse.payload?.[0];

    if (!academicSession) {
      this.logger.warn(`Academic session not found: ${academicYear}`);
      throw new NotFoundException(sysMsg.RESOURCE_NOT_FOUND);
    }

    // --- 2. Get classes under session ---
    const classesResponse = await this.classModelAction.find({
      findOptions: { academicSession: { id: academicSession.id } },
      transactionOptions: { useTransaction: false },
    });

    const classes = classesResponse.payload || [];

    if (classes.length === 0) {
      return {
        message: sysMsg.OPERATION_SUCCESSFUL,
        status_code: HttpStatus.OK,
        data: {
          academic_year: academicYear,
          report: [],
        },
      };
    }

    // --- 3. Build report for each class ---
    const report = await Promise.all(
      classes.map(async (cls) => {
        const classStudentsResponse = await this.classStudentModelAction.list({
          filterRecordOptions: {
            class: { id: cls.id },
            student: { is_deleted: false },
          },
          relations: { student: { user: true } },
        });

        const classStudents = classStudentsResponse.payload || [];
        const students = classStudents.map((cs) => cs.student);

        const boys = students.filter((s) => s.user?.gender === 'Male').length;
        const girls = students.filter(
          (s) => s.user?.gender === 'Female',
        ).length;

        return {
          class_name: cls.name,
          new_students: students.length,
          boys,
          girls,
        };
      }),
    );

    this.logger.info('Generated student growth report', {
      academicYear,
      classCount: report.length,
    });

    // --- 4. AGGREGATE class arms like JSS1A, JSS1B into JSS1 ---
    const aggregatedReport = Object.values(
      report.reduce(
        (acc, curr) => {
          const baseName = curr.class_name.replace(/\s?[A-Z]$/, ''); // removes trailing section letter

          if (!acc[baseName]) {
            acc[baseName] = {
              class_name: baseName,
              new_students: 0,
              boys: 0,
              girls: 0,
            };
          }

          acc[baseName].new_students += curr.new_students;
          acc[baseName].boys += curr.boys;
          acc[baseName].girls += curr.girls;

          return acc;
        },
        {} as Record<
          string,
          {
            class_name: string;
            new_students: number;
            boys: number;
            girls: number;
          }
        >,
      ),
    );

    return {
      message: sysMsg.OPERATION_SUCCESSFUL,
      status_code: HttpStatus.OK,
      data: {
        academic_year: academicYear,
        report: aggregatedReport,
      },
    };
  }

  /**
   * Retrieves the profile of the currently authenticated student.
   * @param studentId - The ID of the student.
   * @returns The student's complete profile.
   * @throws {NotFoundException} If no student profile is linked to the user account.
   */
  async getMyProfile(
    studentId: string,
    authUser: IUserPayload,
  ): Promise<StudentProfileResponseDto> {
    const student = await this.studentModelAction.get({
      identifierOptions: { id: studentId },
      relations: {
        user: true,
        current_class: {
          academicSession: true,
          teacher_assignment: true,
          classSubjects: true,
          timetable: {
            schedules: true,
          },
        },
        stream: {
          class: {
            academicSession: true,
            teacher_assignment: true,
            classSubjects: true,
            timetable: {
              schedules: true,
            },
          },
        },
        class_assignments: {
          class: {
            academicSession: true,
            teacher_assignment: true,
            classSubjects: true,
            timetable: {
              schedules: true,
            },
          },
        },
      },
    });

    if (!student || student.is_deleted) {
      this.logger.warn(`Student profile not found with ID: ${studentId}`);
      throw new NotFoundException(sysMsg.STUDENT_NOT_FOUND);
    }

    // --- Ownership Check ---
    // A student can only access their own profile.
    if (
      authUser.roles.includes(UserRole.STUDENT) &&
      student.user.id !== authUser.id
    ) {
      this.logger.warn(
        `Forbidden access attempt to student profile ${studentId} by user ${authUser.id}`,
      );
      throw new ForbiddenException(sysMsg.FORBIDDEN);
    }

    this.logger.info(`Fetched student profile for student ID: ${studentId}`);

    return new StudentProfileResponseDto(
      student,
      student.user,
      sysMsg.PROFILE_RETRIEVED,
    );
  }

  /**
   * Bulk assign NFC card IDs to multiple students
   */
  async bulkAssignNfcCards(
    dto: BulkNfcAssignmentDto,
  ): Promise<{
    message: string;
    status_code: number;
    data: {
      total: number;
      successful: number;
      failed: number;
      results: Array<{
        student_identifier: string;
        success: boolean;
        nfc_card_id?: string;
        error?: string;
      }>;
    };
  }> {
    const results: Array<{
      student_identifier: string;
      success: boolean;
      nfc_card_id?: string;
      error?: string;
    }> = [];

    let successful = 0;
    let failed = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const assignment of dto.assignments) {
        try {
          // Find student by ID or registration number
          const student = await manager.findOne(Student, {
            where: [
              { id: assignment.student_identifier, is_deleted: false },
              {
                registration_number: assignment.student_identifier,
                is_deleted: false,
              },
            ],
            relations: ['user'],
          });

          if (!student) {
            results.push({
              student_identifier: assignment.student_identifier,
              success: false,
              error: 'Student not found',
            });
            failed++;
            continue;
          }

          // Determine NFC card ID
          let nfcCardId: string | null = null;
          if (
            !assignment.nfc_card_id ||
            assignment.nfc_card_id.trim() === '' ||
            assignment.nfc_card_id.toUpperCase() === 'GENERATE'
          ) {
            // Auto-generate
            nfcCardId = generateSecureNfcCardId();
          } else {
            // Validate and normalize manually entered ID
            const normalizedId = normalizeNfcCardId(assignment.nfc_card_id);
            const validation = validateNfcCardId(normalizedId);

            if (!validation.valid) {
              results.push({
                student_identifier: assignment.student_identifier,
                success: false,
                error: validation.error || 'Invalid NFC card ID format',
              });
              failed++;
              continue;
            }

            // Check for uniqueness
            const existingStudent = await manager
              .createQueryBuilder(Student, 's')
              .where('UPPER(s.nfc_card_id) = UPPER(:nfcCardId)', {
                nfcCardId: normalizedId,
              })
              .andWhere('s.id != :currentId', { currentId: student.id })
              .andWhere('s.is_deleted = false')
              .getOne();

            if (existingStudent) {
              results.push({
                student_identifier: assignment.student_identifier,
                success: false,
                error: `NFC card ID is already assigned to another student`,
              });
              failed++;
              continue;
            }

            nfcCardId = normalizedId;
          }

          // Update student
          await this.studentModelAction.update({
            identifierOptions: { id: student.id },
            updatePayload: {
              nfc_card_id: nfcCardId,
            },
            transactionOptions: {
              useTransaction: true,
              transaction: manager,
            },
          });

          results.push({
            student_identifier: assignment.student_identifier,
            success: true,
            nfc_card_id: nfcCardId,
          });
          successful++;
        } catch (error: any) {
          this.logger.error(
            `Failed to assign NFC card for student ${assignment.student_identifier}: ${error.message}`,
          );
          results.push({
            student_identifier: assignment.student_identifier,
            success: false,
            error: error.message || 'Unknown error',
          });
          failed++;
        }
      }
    });

    return {
      message: `Bulk NFC card assignment completed: ${successful} successful, ${failed} failed`,
      status_code: HttpStatus.OK,
      data: {
        total: dto.assignments.length,
        successful,
        failed,
        results,
      },
    };
  }

  /**
   * Generate QR code for NFC card ID
   */
  async generateNfcQrCode(cardId: string): Promise<{
    message: string;
    status_code: number;
    data: {
      card_id: string;
      qr_code_data_url: string;
    };
  }> {
    const QRCode = require('qrcode');

    try {
      const qrDataUrl = await QRCode.toDataURL(cardId, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });

      return {
        message: 'QR code generated successfully',
        status_code: HttpStatus.OK,
        data: {
          card_id: cardId,
          qr_code_data_url: qrDataUrl,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate QR code: ${error.message}`);
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  /**
   * Export students with NFC card IDs to CSV
   */
  async exportNfcCardsCsv(): Promise<{
    message: string;
    status_code: number;
    data: string; // CSV content
  }> {
    const students = await this.dataSource.manager.find(Student, {
      where: { is_deleted: false },
      relations: ['user'],
      select: {
        id: true,
        registration_number: true,
        nfc_card_id: true,
        user: {
          first_name: true,
          last_name: true,
          middle_name: true,
        },
      },
    });

    // Build CSV
    const headers = [
      'Registration Number',
      'Student Name',
      'NFC Card ID',
      'Student ID',
    ];
    const rows = students.map((student) => {
      const fullName = [
        student.user.first_name,
        student.user.middle_name,
        student.user.last_name,
      ]
        .filter(Boolean)
        .join(' ');

      return [
        student.registration_number || '',
        fullName || '',
        student.nfc_card_id || '',
        student.id || '',
      ];
    });

    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ];

    const csvContent = csvLines.join('\n');

    return {
      message: 'CSV export generated successfully',
      status_code: HttpStatus.OK,
      data: csvContent,
    };
  }
}
