import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  HttpStatus,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

import { IMulterFile } from '../../common/types/multer.types';
import * as sysMsg from '../../constants/system.messages';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  UploadControllerDocs,
  UploadPictureDecorators,
  UploadAudioDecorators,
} from './decorators/upload.docs';
import { UploadPictureResponseDto } from './dto';
import { UploadService } from './upload.service';

interface IRequestWithUser extends Request {
  user?: {
    userId?: string;
    email?: string;
    roles?: string[];
  };
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
@UploadControllerDocs()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('picture')
  @UploadPictureDecorators()
  async uploadPicture(
    @UploadedFile() file: IMulterFile,
    @Req() req: IRequestWithUser,
  ): Promise<{
    status_code: number;
    message: string;
    data: UploadPictureResponseDto;
  }> {
    const userId = req.user?.userId;

    const result = await this.uploadService.uploadPicture(file, userId);

    return {
      status_code: HttpStatus.OK,
      message: sysMsg.IMAGE_UPLOAD_SUCCESS,
      data: result,
    };
  }

  @Post('audio')
  @UploadAudioDecorators()
  async uploadAudio(
    @UploadedFile() file: IMulterFile,
    @Req() req: IRequestWithUser,
  ): Promise<{
    status_code: number;
    message: string;
    data: UploadPictureResponseDto;
  }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const userId = req.user?.userId;

    const result = await this.uploadService.uploadAudio(file, userId);

    return {
      status_code: HttpStatus.OK,
      message: 'Audio uploaded successfully',
      data: result,
    };
  }
}
