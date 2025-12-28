import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as sharp from 'sharp';

import * as sysMsg from '../../constants/system.messages';
import { UserRole } from '../shared/enums';

import { CreateInstallationDto } from './dto/create-installation.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolModelAction } from './model-actions/school.action';
import { UserModelAction } from '../user/model-actions/user-actions';

interface IUploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class SchoolService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'logos');

  constructor(
    private readonly schoolModelAction: SchoolModelAction,
    private readonly userModelAction: UserModelAction,
  ) {}

  async processInstallation(
    createInstallationDto: CreateInstallationDto,
    logoFile?: IUploadedFile,
  ) {
    // Check for ANY existing school (not just completed ones)
    // This allows us to update a school that was partially set up
    const { payload: allSchools } = await this.schoolModelAction.list({
      order: { createdAt: 'DESC' }, // Get most recent school
    });

    const existingSchool =
      allSchools && allSchools.length > 0 ? allSchools[0] : null;

    if (existingSchool) {
      // UPDATE PATH - School installation already exists
      // Process new logo if provided, otherwise keep existing logo
      let logoUrl = existingSchool.logo_url;
      if (logoFile) {
        logoUrl = await this.uploadLogo(logoFile);
      }

      // Update existing school record
      const updatedSchool = await this.schoolModelAction.update({
        identifierOptions: { id: existingSchool.id },
        updatePayload: {
          name: createInstallationDto.name,
          address: createInstallationDto.address,
          email: createInstallationDto.email,
          phone: createInstallationDto.phone,
          logo_url: logoUrl,
          primary_color: createInstallationDto.primary_color,
          secondary_color: createInstallationDto.secondary_color,
          accent_color: createInstallationDto.accent_color,
          installation_completed: true,
        },
        transactionOptions: { useTransaction: false },
      });

      return {
        id: updatedSchool.id,
        name: updatedSchool.name,
        address: updatedSchool.address,
        email: updatedSchool.email,
        phone: updatedSchool.phone,
        logo_url: updatedSchool.logo_url,
        primary_color: updatedSchool.primary_color,
        secondary_color: updatedSchool.secondary_color,
        accent_color: updatedSchool.accent_color,
        installation_completed: updatedSchool.installation_completed,
        message: sysMsg.INSTALLATION_UPDATED,
      };
    } else {
      // CREATE PATH - First time installation
      // Process logo file if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await this.uploadLogo(logoFile);
      }

      // Create school record
      const school = await this.schoolModelAction.create({
        createPayload: {
          name: createInstallationDto.name,
          address: createInstallationDto.address,
          email: createInstallationDto.email,
          phone: createInstallationDto.phone,
          logo_url: logoUrl,
          primary_color: createInstallationDto.primary_color,
          secondary_color: createInstallationDto.secondary_color,
          accent_color: createInstallationDto.accent_color,
          installation_completed: true,
        },
        transactionOptions: { useTransaction: false },
      });

      // Create first admin user if admin details are provided
      if (
        createInstallationDto.admin_first_name &&
        createInstallationDto.admin_last_name &&
        createInstallationDto.admin_password &&
        createInstallationDto.email
      ) {
        // Check if user already exists
        const existingUser = await this.userModelAction.get({
          identifierOptions: { email: createInstallationDto.email },
        });

        // Hash password
        const hashedPassword = await bcrypt.hash(
          createInstallationDto.admin_password,
          10,
        );

        if (!existingUser) {
          // Create first admin user
          await this.userModelAction.create({
            createPayload: {
              email: createInstallationDto.email,
              first_name: createInstallationDto.admin_first_name,
              last_name: createInstallationDto.admin_last_name,
              password: hashedPassword,
              role: [UserRole.ADMIN],
              phone: createInstallationDto.phone || null,
              gender: null,
              dob: null,
              is_active: true,
              is_verified: true,
            },
            transactionOptions: { useTransaction: false },
          });
        } else {
          // Update existing admin user with new password and details during setup
          // This ensures the user can log in with the credentials from the setup form
          await this.userModelAction.update({
            identifierOptions: { email: createInstallationDto.email },
            updatePayload: {
              first_name: createInstallationDto.admin_first_name,
              last_name: createInstallationDto.admin_last_name,
              password: hashedPassword,
              phone: createInstallationDto.phone || existingUser.phone || null,
              is_active: true,
              is_verified: true,
            },
            transactionOptions: { useTransaction: false },
          });
        }
      }

      return {
        id: school.id,
        name: school.name,
        address: school.address,
        email: school.email,
        phone: school.phone,
        logo_url: school.logo_url,
        primary_color: school.primary_color,
        secondary_color: school.secondary_color,
        accent_color: school.accent_color,
        installation_completed: school.installation_completed,
        message: sysMsg.INSTALLATION_COMPLETED,
      };
    }
  }

  private async uploadLogo(file: IUploadedFile): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true });

    const filename = `logo-${crypto.randomBytes(16).toString('hex')}.png`;
    const filepath = path.join(this.uploadDir, filename);

    await sharp(file.buffer).resize(200, 200).png().toFile(filepath);

    return `/uploads/logos/${filename}`;
  }

  /**
   * Get school details for configuration/routing
   * Returns the school even if installation is not complete, so frontend can check status
   */
  async getSchoolDetails() {
    // Get the most recently created school (or first one if multiple exist)
    // Don't filter by installation_completed - we want to return even incomplete installations
    const { payload } = await this.schoolModelAction.list({
      order: { createdAt: 'DESC' },
    });

    if (!payload || payload.length === 0) {
      // No school exists at all - return 404
      throw new ConflictException(sysMsg.SCHOOL_NOT_FOUND);
    }

    // Return the most recent school (regardless of installation_completed status)
    const school = payload[0];

    return {
      id: school.id,
      name: school.name,
      address: school.address,
      email: school.email,
      phone: school.phone,
      logo_url: school.logo_url,
      primary_color: school.primary_color,
      secondary_color: school.secondary_color,
      accent_color: school.accent_color,
      installation_completed: school.installation_completed,
    };
  }

  async update(updateSchoolDto: UpdateSchoolDto, logoFile?: IUploadedFile) {
    // Get existing school
    const { payload } = await this.schoolModelAction.list({
      filterRecordOptions: { installation_completed: true },
    });

    if (!payload || payload.length === 0) {
      throw new ConflictException(sysMsg.SCHOOL_NOT_FOUND);
    }

    const existingSchool = payload[0];

    // Process logo if provided
    let logoUrl = existingSchool.logo_url;
    if (logoFile) {
      logoUrl = await this.uploadLogo(logoFile);
    }

    // Build update payload (only include fields that are provided)
    const updatePayload: Partial<typeof existingSchool> = {};
    if (updateSchoolDto.name !== undefined) updatePayload.name = updateSchoolDto.name;
    if (updateSchoolDto.address !== undefined) updatePayload.address = updateSchoolDto.address;
    if (updateSchoolDto.email !== undefined) updatePayload.email = updateSchoolDto.email;
    if (updateSchoolDto.phone !== undefined) updatePayload.phone = updateSchoolDto.phone;
    if (updateSchoolDto.primary_color !== undefined) updatePayload.primary_color = updateSchoolDto.primary_color;
    if (updateSchoolDto.secondary_color !== undefined) updatePayload.secondary_color = updateSchoolDto.secondary_color;
    if (updateSchoolDto.accent_color !== undefined) updatePayload.accent_color = updateSchoolDto.accent_color;
    if (logoUrl !== undefined) updatePayload.logo_url = logoUrl;

    // Update school record
    const updatedSchool = await this.schoolModelAction.update({
      identifierOptions: { id: existingSchool.id },
      updatePayload,
      transactionOptions: { useTransaction: false },
    });

    return {
      id: updatedSchool.id,
      name: updatedSchool.name,
      address: updatedSchool.address,
      email: updatedSchool.email,
      phone: updatedSchool.phone,
      logo_url: updatedSchool.logo_url,
      primary_color: updatedSchool.primary_color,
      secondary_color: updatedSchool.secondary_color,
      accent_color: updatedSchool.accent_color,
      installation_completed: updatedSchool.installation_completed,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} school`;
  }

  remove(id: number) {
    return `This action removes a #${id} school`;
  }
}
