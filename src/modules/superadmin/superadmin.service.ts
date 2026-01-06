import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

import { EmailTemplateID } from 'src/constants/email-constants';

import config from '../../config/config';
import * as sysMsg from '../../constants/system.messages';
import { AccountCreationService } from '../email/account-creation.service';
import { EmailService } from '../email/email.service';
import { SchoolModelAction } from '../school/model-actions/school.action';
import { UserRole } from '../shared/enums';
import {
  generateResetToken,
  generateStrongPassword,
  hashPassword,
} from '../shared/utils';
import { UserModelAction } from '../user/model-actions/user-actions';

import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateSuperadminDto } from './dto/create-superadmin.dto';
import { LoginSuperadminDto } from './dto/login-superadmin.dto';
import { LogoutDto } from './dto/superadmin-logout.dto';
import { Role } from './entities/superadmin.entity';
import { SuperadminModelAction } from './model-actions/superadmin-actions';
import { SuperadminSessionService } from './session/superadmin-session.service';

@Injectable()
export class SuperadminService {
  private readonly logger: Logger;
  constructor(
    private readonly superadminModelAction: SuperadminModelAction,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => SchoolModelAction))
    private readonly schoolModelAction: SchoolModelAction,
    private readonly superadminSessionService: SuperadminSessionService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UserModelAction))
    private readonly userModelAction: UserModelAction,
    @Inject(forwardRef(() => AccountCreationService))
    private readonly accountCreationService: AccountCreationService,
  ) {
    this.logger = logger.child({ context: SuperadminService.name });
  }

  private async generateTokens(userId: string, email: string) {
    const { jwt } = config();
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwt.secret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwt.refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async sendWelcomeEmail(userName: string, email: string) {
    await this.emailService.sendMail({
      to: [{ email: email, name: userName }],
      subject: 'Welcome to Open School Portal',
      templateNameID: EmailTemplateID.SUPERADMIN_WELCOME,
      templateData: {
        first_name: userName,
        school_name: 'Open School Portal',
        logo_url: 'https://staging.schoolbase.africa/assets/logo.svg',
        role: Role.SUPERADMIN,
        invite_link: `
          ${this.configService.get<string>('frontend.superadmin_login_url')}
          `,
      },
    });
  }

  async createSuperAdmin(createSuperadminDto: CreateSuperadminDto) {
    const { password, confirm_password, email, ...restData } =
      createSuperadminDto;

    if (!password || !confirm_password) {
      throw new ConflictException(sysMsg.SUPERADMIN_PASSWORDS_REQUIRED);
    }

    const existing = await this.superadminModelAction.get({
      identifierOptions: { role: Role.SUPERADMIN },
    });

    const passwordHash: string = await bcrypt.hash(password, 10);

    const createNewRecord = async (manager) => {
      const updatedSuperadminRecord = await this.superadminModelAction.create({
        createPayload: {
          ...restData,
          email,
          password: passwordHash,
          role: Role.SUPERADMIN,
          is_active: createSuperadminDto.school_name ? true : false,
        },
        transactionOptions: { useTransaction: true, transaction: manager },
      });
      return updatedSuperadminRecord;
    };

    const updateRecord = async (manager) => {
      const updatedSuperadminRecord = await this.superadminModelAction.update({
        updatePayload: {
          ...restData,
          email,
          password: passwordHash,
          role: Role.SUPERADMIN,
          is_active: createSuperadminDto.school_name ? true : false,
        },
        identifierOptions: { role: Role.SUPERADMIN },
        transactionOptions: { useTransaction: true, transaction: manager },
      });
      return updatedSuperadminRecord;
    };

    if (existing) {
      const updatedSuperadmin = await this.dataSource.transaction(updateRecord);

      if (updatedSuperadmin.password) delete updatedSuperadmin.password;

      this.logger.info(sysMsg.SUPERADMIN_ACCOUNT_UPDATED);

      return {
        message: sysMsg.SUPERADMIN_ACCOUNT_UPDATED,
        status_code: HttpStatus.OK,
        data: updatedSuperadmin,
      };
    }

    const createdSuperadmin =
      await this.dataSource.transaction(createNewRecord);

    // Check if installation is completed and optionally deactivate super admin
    // Auto-deactivation can be disabled via AUTO_DEACTIVATE_SUPERADMIN env var (default: false)
    const autoDeactivate = this.configService.get<string>('AUTO_DEACTIVATE_SUPERADMIN', 'false') === 'true';
    
    try {
      const { payload: installations } = await this.schoolModelAction.list({
        filterRecordOptions: { installation_completed: true },
      });

      if (installations && installations.length > 0) {
        // Deactivate super admin only if auto-deactivation is enabled
        if (autoDeactivate) {
          await this.superadminModelAction.update({
            identifierOptions: { id: createdSuperadmin.id },
            updatePayload: { is_active: false },
            transactionOptions: { useTransaction: false },
          });
          createdSuperadmin.is_active = false;
          this.logger.info(
            'Super admin deactivated after installation completion (auto-deactivation enabled)',
          );
        } else {
          this.logger.info(
            'Super admin remains active (auto-deactivation disabled)',
          );
        }
      }
    } catch (error) {
      // If school module is not available, log warning but don't fail
      this.logger.warn(
        'Could not check installation status to deactivate super admin',
        error,
      );
    }

    if (createdSuperadmin.password) delete createdSuperadmin.password;

    // Send welcome email (non-blocking - don't fail if email fails)
    try {
      await this.sendWelcomeEmail(
        createdSuperadmin.first_name,
        createdSuperadmin.email,
      );
    } catch (emailError) {
      // Log email error but don't fail the superadmin creation
      this.logger.warn(
        `Failed to send welcome email to ${createdSuperadmin.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
        emailError instanceof Error ? emailError.stack : undefined,
      );
    }

    this.logger.info(sysMsg.SUPERADMIN_ACCOUNT_CREATED);

    return {
      message: sysMsg.SUPERADMIN_ACCOUNT_CREATED,
      status_code: HttpStatus.CREATED,
      data: createdSuperadmin,
    };
  }

  /**
   * Logs in user
   * @param loginSuperadminDto - requires data with which a superadmin is logged on
   */
  async login(loginSuperadminDto: LoginSuperadminDto) {
    // Find superadmin by email
    const superadmin = await this.superadminModelAction.get({
      identifierOptions: { email: loginSuperadminDto.email },
    });
    if (!superadmin) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }

    // Check if active (assuming isActive field)
    if (!superadmin.is_active) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginSuperadminDto.password,
      superadmin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }

    const tokens = await this.generateTokens(superadmin.id, superadmin.email);

    let sessionInfo = null;
    if (this.superadminSessionService && tokens.refresh_token) {
      sessionInfo = await this.superadminSessionService.createSession(
        superadmin.id,
        tokens.refresh_token,
      );
    }

    this.logger.info(sysMsg.LOGIN_SUCCESS);

    return {
      message: sysMsg.LOGIN_SUCCESS,
      data: {
        id: superadmin.id,
        email: superadmin.email,
        first_name: superadmin.first_name,
        last_name: superadmin.last_name,
        school_name: superadmin.school_name,
        ...tokens,
        session_id: sessionInfo?.session_id,
        session_expires_at: sessionInfo?.expires_at,
      },
      status_code: HttpStatus.OK,
    };
  }

  /**
   * logs out a logged on superadmin
   */
  async logout(logoutDto: LogoutDto) {
    if (this.superadminSessionService) {
      // follow the same parameter order used in AuthService tests (superadmin_id, session_id)
      await this.superadminSessionService.revokeSession(
        logoutDto.session_id,
        logoutDto.user_id,
      );
    }

    this.logger.info(sysMsg.LOGOUT_SUCCESS);

    return {
      status_code: HttpStatus.OK,
      message: sysMsg.LOGOUT_SUCCESS,
    };
  }

  /**
   * Gets the current super admin's profile
   * @param superadminId - Super admin ID
   */
  async getMe(superadminId: string) {
    const superadmin = await this.superadminModelAction.get({
      identifierOptions: { id: superadminId },
    });

    if (!superadmin) {
      throw new UnauthorizedException('Super admin not found');
    }

    return {
      message: 'Super admin profile retrieved successfully',
      status_code: HttpStatus.OK,
      data: {
        id: superadmin.id,
        email: superadmin.email,
        first_name: superadmin.first_name,
        last_name: superadmin.last_name,
        school_name: superadmin.school_name,
        is_active: superadmin.is_active,
        role: superadmin.role,
        created_at: superadmin.createdAt,
        updated_at: superadmin.updatedAt,
      },
    };
  }

  /**
   * Creates an admin user account
   * @param createAdminDto - Admin account details
   */
  async createAdmin(createAdminDto: CreateAdminDto) {
    // Check if user with email already exists
    const existingUser = await this.userModelAction.get({
      identifierOptions: { email: createAdminDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email ${createAdminDto.email} already exists.`,
      );
    }

    // Generate password if not provided
    const rawPassword = createAdminDto.password || generateStrongPassword(12);
    const hashedPassword = await hashPassword(rawPassword);

    // Generate reset token for password reset link
    const { resetToken, resetTokenExpiry } = generateResetToken(24);

    // Create user account
    const savedUser = await this.dataSource.transaction(async (manager) => {
      return await this.userModelAction.create({
        createPayload: {
          first_name: createAdminDto.first_name,
          last_name: createAdminDto.last_name,
          email: createAdminDto.email,
          phone: createAdminDto.phone || '',
          gender: 'OTHER', // Default since not provided
          dob: new Date().toISOString().split('T')[0], // Default to today
          password: hashedPassword,
          role: [UserRole.ADMIN],
          is_active: true,
          is_verified: true,
          reset_token: resetToken,
          reset_token_expiry: resetTokenExpiry,
        },
        transactionOptions: {
          useTransaction: true,
          transaction: manager,
        },
      });
    });

    this.logger.info('Admin account created', {
      adminId: savedUser.id,
      email: savedUser.email,
    });

    // Send account creation email
    try {
      await this.accountCreationService.sendAccountCreationEmail(
        `${savedUser.first_name} ${savedUser.last_name}`,
        savedUser.email,
        rawPassword,
        UserRole.ADMIN,
        resetToken,
      );
    } catch (emailError) {
      // Log email error but don't throw - admin has already been created
      this.logger.warn(
        `Failed to send account creation email for admin ${savedUser.id} (${savedUser.email}). Admin account was created successfully.`,
        emailError,
      );
    }

    return {
      message: 'Admin account created successfully',
      status_code: HttpStatus.CREATED,
      data: {
        id: savedUser.id,
        first_name: savedUser.first_name,
        last_name: savedUser.last_name,
        email: savedUser.email,
        phone: savedUser.phone,
        is_active: savedUser.is_active,
        is_verified: savedUser.is_verified,
        created_at: savedUser.createdAt,
      },
    };
  }
}
