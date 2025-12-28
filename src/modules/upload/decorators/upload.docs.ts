import {
  applyDecorators,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { pictureUploadConfig, audioUploadConfig } from '../../../config/multer.config';
import {
  ApiUploadTags,
  ApiUploadBearerAuth,
  ApiUploadPicture,
  ApiUploadAudio,
} from '../docs/upload.swagger';

/**
 * Decorators for Upload module
 */

/**
 * Controller-level decorators for Upload endpoints
 */
export const UploadControllerDocs = () =>
  applyDecorators(ApiUploadTags(), ApiUploadBearerAuth());

/**
 * Decorators for Upload Picture endpoint
 * Combines all decorators needed for the upload picture route
 */
export const UploadPictureDecorators = () =>
  applyDecorators(
    HttpCode(HttpStatus.OK),
    UseInterceptors(FileInterceptor('file', pictureUploadConfig)),
    ApiUploadPicture(),
  );

/**
 * Decorators for Upload Audio endpoint
 * Combines all decorators needed for the upload audio route
 */
export const UploadAudioDecorators = () =>
  applyDecorators(
    HttpCode(HttpStatus.OK),
    UseInterceptors(FileInterceptor('file', audioUploadConfig)),
    ApiUploadAudio(),
  );
