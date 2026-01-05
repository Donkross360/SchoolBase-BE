import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({
    example: 'John',
    description: 'The first name of the admin',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    example: 'Doe',
    description: 'The last name of the admin',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'The email address of the admin',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'The phone number of the admin',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'The password for the admin account (min 8 characters). If not provided, a random password will be generated.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;
}

