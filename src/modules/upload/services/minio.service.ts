import * as path from 'path';

import {
  Injectable,
  BadRequestException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as minio from 'minio';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

import { IMulterFile } from '../../../common/types/multer.types';
import * as sysMsg from '../../../constants/system.messages';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger: Logger;
  private minioClient: minio.Client;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({ context: MinioService.name });
    this.bucketName = this.configService.get<string>('minio.bucket');

    // Initialize MinIO client
    this.minioClient = new minio.Client({
      endPoint: this.configService.get('minio.endPoint'),
      port: this.configService.get('minio.port'),
      useSSL: this.configService.get('minio.useSSL'),
      accessKey: this.configService.get('minio.accessKey'),
      secretKey: this.configService.get('minio.secretKey'),
    });
  }

  async onModuleInit() {
    this.logger.info('Minio service initialized');
    // Optional: Check if bucket exists on startup
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        this.logger.warn(
          `Bucket ${this.bucketName} does not exist. Creating...`,
        );
        await this.minioClient.makeBucket(this.bucketName, '');
      }
    } catch (error) {
      this.logger.error('Error checking/creating Minio bucket', error);
    }
  }

  /**
   * Upload an image file to Minio
   * @param file - The file to upload (Multer file object)
   * @param folder - Optional folder path (used as prefix in Minio)
   * @returns Promise with url and publicId (mapped to Minio object name)
   */
  async uploadImage(
    file: IMulterFile,
    folder?: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!file || !file.buffer) {
      this.logger.error('Invalid file provided for upload');
      throw new BadRequestException(sysMsg.FILE_REQUIRED);
    }

    try {
      // Generate a unique filename
      const filename = `${uuidv4()}${path.extname(file.originalname)}`;

      // Construct the object path (folder/filename)
      // If folder is provided, use it as a prefix.
      const objectName = folder ? `${folder}/${filename}` : filename;

      // Define metadata
      const metaData = {
        contentType: file.mimetype,
        originalName: file.originalname,
      };

      // Upload to Minio
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        metaData,
      );

      this.logger.info(`Image uploaded successfully to Minio: ${objectName}`);

      // Construct URL manually since Minio.putObject doesn't return it
      // Note: This assumes the bucket handles public read access.
      // If private, you'd need presignedGetObject() here.
      const protocol = this.configService.get('minio.useSSL')
        ? 'https'
        : 'http';
      const endPoint = this.configService.get('minio.endPoint');
      const port = this.configService.get('minio.port');

      // Handle standard ports to avoid ugliness (e.g. :80 or :443)
      const portString = port === 80 || port === 443 ? '' : `:${port}`;

      const url = `${protocol}://${endPoint}${portString}/${this.bucketName}/${objectName}`;

      return {
        url: url,
        publicId: objectName, // In S3/Minio terms, the Key is the ID
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown upload error';
      this.logger.error(
        `Failed to upload image to Minio: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(sysMsg.IMAGE_UPLOAD_FAILED);
    }
  }

  /**
   * Upload any file to Minio (generic method)
   * @param file - The file to upload (Multer file object)
   * @param folder - Optional folder path (used as prefix in Minio)
   * @returns Promise with url and publicId (mapped to Minio object name)
   */
  async uploadFile(
    file: IMulterFile,
    folder?: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) {
      this.logger.error('No file provided for upload');
      throw new BadRequestException('No file provided');
    }

    if (!file.buffer) {
      this.logger.error('File buffer is missing. File details:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fieldname: file.fieldname,
      });
      throw new BadRequestException('File buffer is missing. Ensure the file was uploaded correctly.');
    }

    if (!this.bucketName) {
      this.logger.error('MinIO bucket name is not configured');
      throw new BadRequestException('Storage configuration error');
    }

    try {
      // Generate a unique filename
      const filename = `${uuidv4()}${path.extname(file.originalname)}`;

      // Construct the object path (folder/filename)
      const objectName = folder ? `${folder}/${filename}` : filename;

      // Define metadata
      const metaData = {
        contentType: file.mimetype,
        originalName: file.originalname,
      };

      this.logger.info(`Attempting to upload file to Minio: ${objectName}`, {
        bucket: this.bucketName,
        size: file.size,
        mimetype: file.mimetype,
      });

      // Upload to Minio
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        metaData,
      );

      this.logger.info(`File uploaded successfully to Minio: ${objectName}`);

      // Construct URL
      const protocol = this.configService.get('minio.useSSL')
        ? 'https'
        : 'http';
      const endPoint = this.configService.get('minio.endPoint');
      const port = this.configService.get('minio.port');
      const portString = port === 80 || port === 443 ? '' : `:${port}`;

      const url = `${protocol}://${endPoint}${portString}/${this.bucketName}/${objectName}`;

      return {
        url: url,
        publicId: objectName,
      };
    } catch (error) {
      // Extract error message with better handling, including AggregateError
      let errorMessage = 'Unknown upload error';
      let errorDetails: any = {};

      if (error instanceof Error) {
        errorMessage = error.message || error.toString();
        
        // Handle AggregateError (common with MinIO connection issues)
        if (error.name === 'AggregateError' && 'errors' in error) {
          const aggregateError = error as any;
          const errorMessages = aggregateError.errors?.map((e: any) => {
            if (e instanceof Error) {
              return e.message || e.toString();
            }
            return String(e);
          }).join('; ') || 'Multiple errors occurred';
          errorMessage = `MinIO connection error: ${errorMessages}`;
          errorDetails.aggregateErrors = aggregateError.errors;
        }
        
        // Handle other common MinIO errors
        if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
          errorMessage = `MinIO connection failed: Unable to connect to storage server`;
        } else if (error.message?.includes('InvalidAccessKeyId') || error.message?.includes('SignatureDoesNotMatch')) {
          errorMessage = `MinIO authentication failed: Invalid credentials`;
        } else if (error.message?.includes('NoSuchBucket')) {
          errorMessage = `MinIO bucket not found: ${this.bucketName}`;
        }
        
        errorDetails.stack = error.stack;
        errorDetails.name = error.name;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
        errorDetails = error;
      }

      // Log full error details
      this.logger.error(
        `Failed to upload file to Minio: ${errorMessage}`,
        {
          error: error instanceof Error ? error.stack : error,
          errorDetails,
          fileDetails: {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            bufferLength: file.buffer?.length,
          },
          bucket: this.bucketName,
          minioConfig: {
            endPoint: this.configService.get('minio.endPoint'),
            port: this.configService.get('minio.port'),
            useSSL: this.configService.get('minio.useSSL'),
            bucket: this.bucketName,
          },
        },
      );

      // Provide more detailed error message for debugging
      throw new BadRequestException(
        `Failed to upload file: ${errorMessage}`,
      );
    }
  }

  /**
   * Delete an image from Minio
   * @param publicId - The object name to delete
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, publicId);
      this.logger.info(`Image deleted from Minio: ${publicId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown deletion error';
      this.logger.error(
        `Failed to delete image from Minio: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Failed to delete image');
    }
  }
}
