import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'resource-permissions';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
