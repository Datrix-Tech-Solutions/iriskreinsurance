import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

const INTEGRATION_KEY = 'operations.reinsurance->accounting';

@Injectable()
export class ReinsuranceAccountingIntegrationActiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>().user;
    if (
      !user?.moduleConfig.operations ||
      !user.featureConfig.operations?.reinsurance ||
      !user.moduleConfig.accounting ||
      !user.integrationConfig?.[INTEGRATION_KEY]
    ) {
      throw new ConflictException(
        'Reinsurance Accounting integration is disabled for this tenant.',
      );
    }
    return true;
  }
}
