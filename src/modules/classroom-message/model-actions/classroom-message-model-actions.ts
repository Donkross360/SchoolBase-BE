import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClassroomMessage } from '../entities/classroom-message.entity';

@Injectable()
export class ClassroomMessageModelAction extends AbstractModelAction<ClassroomMessage> {
  constructor(
    @InjectRepository(ClassroomMessage)
    messageRepository: Repository<ClassroomMessage>,
  ) {
    super(messageRepository, ClassroomMessage);
  }
}

