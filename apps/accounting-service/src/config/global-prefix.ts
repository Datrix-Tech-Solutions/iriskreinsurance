import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces/middleware';

export const ACCOUNTING_GLOBAL_PREFIX = 'api';

export const ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS: RouteInfo[] = [
  {
    path: 'internal/source-events',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/subledgers/ensure',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/reinsurance/accounting-readiness',
    method: RequestMethod.POST,
  },
];
