import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateInstallationDto {
  @ApiProperty({
    description: 'Name of the school',
    example: 'Green Valley High School',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'School logo file',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  @ValidateIf(() => false) // Skip validation for file field
  logo?: unknown;

  @ApiProperty({
    description: 'School address',
    example: '123 Main Street, Springfield',
  })
  @IsString()
  @Length(5, 255)
  address: string;

  @ApiProperty({
    description: 'School email address',
    example: 'contact@greenvalleys.edu',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'School phone number',
    example: '+1234567890',
  })
  @IsString()
  @Matches(/^[0-9+\-()\s]*$/, {
    message: 'phone must contain only numbers and valid phone characters',
  })
  phone: string;

  @ApiProperty({
    description: 'Primary color for school branding',
    example: '#1E40AF',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primary_color must be a valid hex color code',
  })
  primary_color?: string;

  @ApiProperty({
    description: 'Secondary color for school branding',
    example: '#3B82F6',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'secondary_color must be a valid hex color code',
  })
  secondary_color?: string;

  @ApiProperty({
    description: 'Accent color for school branding',
    example: '#60A5FA',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'accent_color must be a valid hex color code',
  })
  accent_color?: string;

  @ApiProperty({
    description: 'First name of the first admin user (optional, for creating first admin)',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  admin_first_name?: string;

  @ApiProperty({
    description: 'Last name of the first admin user (optional, for creating first admin)',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  admin_last_name?: string;

  @ApiProperty({
    description: 'Password for the first admin user (optional, for creating first admin)',
    example: 'SecurePassword123!',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  admin_password?: string;
}
