import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ClassModule } from '../class/class.module';
import { ClassTeacher } from '../class/entities/class-teacher.entity';
import { ClassStudent } from '../class/entities/class-student.entity';
import { Class } from '../class/entities/class.entity';
import { StudentModule } from '../student/student.module';
import { Student } from '../student/entities/student.entity';
import { TeachersModule } from '../teacher/teacher.module';
import { Teacher } from '../teacher/entities/teacher.entity';
import { UploadModule } from '../upload/upload.module';
import { ClassroomMessageController } from './controllers/classroom-message.controller';
import { ClassroomMessage } from './entities/classroom-message.entity';
import { ClassroomMessageModelAction } from './model-actions/classroom-message-model-actions';
import { ClassroomMessageService } from './services/classroom-message.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassroomMessage,
      Class,
      ClassTeacher,
      ClassStudent,
      Student,
      Teacher,
    ]),
    forwardRef(() => ClassModule),
    forwardRef(() => TeachersModule),
    forwardRef(() => StudentModule),
    forwardRef(() => AuthModule),
    UploadModule, // For audio file uploads
  ],
  controllers: [ClassroomMessageController],
  providers: [ClassroomMessageService, ClassroomMessageModelAction],
  exports: [ClassroomMessageService, ClassroomMessageModelAction],
})
export class ClassroomMessageModule {}

