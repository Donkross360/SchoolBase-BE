import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from '../user/user.module';
import { School } from './entities/school.entity';
import { SchoolModelAction } from './model-actions/school.action';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [TypeOrmModule.forFeature([School]), UserModule],
  controllers: [SchoolController],
  providers: [SchoolService, SchoolModelAction],
  exports: [SchoolModelAction, SchoolService],
})
export class SchoolModule {}
