import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Class } from '../class/entities/class.entity';
import { ClassTeacher } from '../class/entities/class-teacher.entity';
import { ClassStudent } from '../class/entities/class-student.entity';
import { Student } from '../student/entities/student.entity';
import { WhiteboardController } from './controllers/whiteboard.controller';
import { Whiteboard } from './entities/whiteboard.entity';
import { WhiteboardModelAction } from './model-actions/whiteboard-model-actions';
import { WhiteboardService } from './services/whiteboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Whiteboard,
      Class,
      ClassTeacher,
      ClassStudent,
      Student,
    ]),
  ],
  controllers: [WhiteboardController],
  providers: [WhiteboardService, WhiteboardModelAction],
  exports: [WhiteboardModelAction, WhiteboardService],
})
export class WhiteboardModule {}

