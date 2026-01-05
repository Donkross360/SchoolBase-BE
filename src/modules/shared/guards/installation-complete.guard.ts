import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as sysMsg from '../../../constants/system.messages';
import { SchoolModelAction } from '../../school/model-actions/school.action';

@Injectable()
export class InstallationCompleteGuard implements CanActivate {
  constructor(
    private readonly schoolModelAction: SchoolModelAction,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(): Promise<boolean> {
    // Check if disabling super admin login after installation is enabled via env var
    // Default to false, meaning super admin can login after installation by default
    const disableAfterInstallation =
      this.configService.get<string>('DISABLE_SUPERADMIN_LOGIN_AFTER_INSTALLATION', 'false') ===
      'true';

    // If disabling is not enabled, allow access
    if (!disableAfterInstallation) {
      return true;
    }

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

