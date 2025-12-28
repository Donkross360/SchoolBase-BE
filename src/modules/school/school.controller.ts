import {
  Controller,
  Get,
  Param,
  Delete,
  Post,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../shared/enums';
import { installationApi } from './decorators/installation-api.decorator';
import { DocsGetSchoolDetails } from './docs/school.decorator';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolService } from './school.service';

interface IUploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('School')
@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Post('installation')
  @UseInterceptors(FileInterceptor('logo'))
  @installationApi()
  async processInstallation(
    @Body() createInstallationDto: CreateInstallationDto,
    @UploadedFile() logo?: IUploadedFile,
  ) {
    return this.schoolService.processInstallation(createInstallationDto, logo);
  }

  @Get()
  @Public() // Make this endpoint public so frontend can fetch config without auth
  @DocsGetSchoolDetails()
  getSchoolDetails() {
    return this.schoolService.getSchoolDetails();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('logo'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update school information (ADMIN only)' })
  @ApiBody({ type: UpdateSchoolDto })
  @ApiResponse({
    status: 200,
    description: 'School information updated successfully',
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  async update(
    @Body() updateSchoolDto: UpdateSchoolDto,
    @UploadedFile() logo?: IUploadedFile,
  ) {
    return this.schoolService.update(updateSchoolDto, logo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schoolService.remove(+id);
  }
}
