import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Whiteboard } from '../entities/whiteboard.entity';

@Injectable()
export class WhiteboardModelAction extends AbstractModelAction<Whiteboard> {
  constructor(
    @InjectRepository(Whiteboard)
    whiteboardRepository: Repository<Whiteboard>,
  ) {
    super(whiteboardRepository, Whiteboard);
  }
}

