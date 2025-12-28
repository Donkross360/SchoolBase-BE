import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { IMulterFile } from '../../common/types/multer.types';

import { UploadPictureResponseDto } from './dto';
import { MinioService } from './services/minio.service';

@Injectable()
export class UploadService {
  private readonly logger: Logger;

  constructor(
    private readonly minioService: MinioService,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({ context: UploadService.name });
  }

  /**
   * Upload a picture to MinIO
   * @param file - The file to upload
   * @param userId - Optional user ID for organizing uploads
   * @returns Upload response with URL and metadata
   */
  async uploadPicture(
    file: IMulterFile,
    userId?: string,
  ): Promise<UploadPictureResponseDto> {
    this.logger.info(
      `Uploading picture: ${file.originalname} (${file.size} bytes)`,
    );

    try {
      // Determine folder based on user ID if provided
      const folder = userId
        ? `schoolbase-users/${userId}`
        : 'schoolbase-uploads';

      const uploadResult = await this.minioService.uploadImage(file, folder);

      this.logger.info(
        `Picture uploaded successfully: ${uploadResult.publicId}`,
      );

      return {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to upload picture: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Upload an audio file to MinIO
   * @param file - The audio file to upload
   * @param userId - Optional user ID for organizing uploads
   * @returns Upload response with URL and metadata
   */
  async uploadAudio(
    file: IMulterFile,
    userId?: string,
  ): Promise<UploadPictureResponseDto> {
    this.logger.info(
      `Uploading audio: ${file.originalname} (${file.size} bytes)`,
    );

    try {
      // Validate audio MIME type
      const allowedMimeTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/webm',
        'audio/ogg',
        'audio/m4a',
        'audio/x-m4a',
        'audio/aac',
        'audio/mp4', // Added for MediaRecorder compatibility
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error(`Invalid audio format. Allowed types: ${allowedMimeTypes.join(', ')}`);
      }

      // Determine folder based on user ID if provided
      const folder = userId
        ? `schoolbase-users/${userId}/audio`
        : 'schoolbase-uploads/audio';

      const uploadResult = await this.minioService.uploadFile(file, folder);

      this.logger.info(
        `Audio uploaded successfully: ${uploadResult.publicId}`,
      );

      return {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      // Extract error message with better handling
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message || error.toString();
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      this.logger.error(
        `Failed to upload audio: ${errorMessage}`,
        {
          error: error instanceof Error ? error.stack : error,
          fileDetails: file ? {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            bufferLength: file.buffer?.length,
          } : 'No file provided',
        },
      );
      // Re-throw the error to let the controller handle it
      throw error;
    }
  }
}
