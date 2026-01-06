import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

import {
  ApiCreateSuperadmin,
  ApiLoginSuperadmin,
  ApiLogoutSuperadmin,
} from './docs/superadmin.swagger';
import { CurrentSuperadmin } from './decorators/current-superadmin.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateSuperadminDto } from './dto/create-superadmin.dto';
import { LoginSuperadminDto } from './dto/login-superadmin.dto';
import { LogoutDto } from './dto/superadmin-logout.dto';
import { SuperadminAuthGuard } from './guards/superadmin-auth.guard';
import { SuperadminService } from './superadmin.service';

@UseGuards(RateLimitGuard)
@RateLimit({ maxRequests: 3, windowMs: 15 * 60 * 1000 })
@ApiTags('Super Admin')
@Controller('superadmin')
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Post()
  @ApiCreateSuperadmin()
  async create(@Body() createSuperadminDto: CreateSuperadminDto) {
    return this.superadminService.createSuperAdmin(createSuperadminDto);
  }

  @Post('login')
  @ApiLoginSuperadmin()
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginSuperadminDto: LoginSuperadminDto) {
    return this.superadminService.login(loginSuperadminDto);
  }

  @Post('logout')
  @ApiLogoutSuperadmin()
  @HttpCode(HttpStatus.OK)
  async logout(@Body() logoutDto: LogoutDto) {
    return this.superadminService.logout(logoutDto);
  }

  @Get('me')
  @UseGuards(SuperadminAuthGuard)
  @RateLimit({ maxRequests: 30, windowMs: 15 * 60 * 1000 }) // Higher limit for frequently called authenticated endpoint
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentSuperadmin() superadmin: any) {
    return this.superadminService.getMe(superadmin.id);
  }

  @Post('admins')
  @UseGuards(SuperadminAuthGuard)
  @RateLimit({ maxRequests: 20, windowMs: 15 * 60 * 1000 }) // More lenient limit for authenticated admin creation
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentSuperadmin() superadmin: any,
  ) {
    return this.superadminService.createAdmin(createAdminDto);
  }
}
