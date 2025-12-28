import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';

import * as sysMsg from '../../../constants/system.messages';
import { SchoolModelAction } from '../../school/model-actions/school.action';

@Injectable()
export class InstallationCompleteGuard implements CanActivate {
  constructor(private readonly schoolModelAction: SchoolModelAction) {}

  async canActivate(): Promise<boolean> {
    // Check if installation is completed
    const { payload: installations } = await this.schoolModelAction.list({
      filterRecordOptions: { installation_completed: true },
    });

    const installationCompleted =
      installations && installations.length > 0 && installations[0]?.installation_completed;

    if (installationCompleted) {
      throw new ForbiddenException(
        'Super admin access is disabled after installation setup is complete.',
      );
    }

    return true;
  }
}

