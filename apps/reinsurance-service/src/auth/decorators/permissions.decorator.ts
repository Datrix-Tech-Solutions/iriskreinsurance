import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'resource-permissions';
export const ANY_PERMISSIONS_KEY = 'resource-any-permissions';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
