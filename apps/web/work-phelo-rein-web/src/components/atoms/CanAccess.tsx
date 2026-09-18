'use client';

import { usePermission } from '@/hooks/hr/usePermission';

interface CanAccessProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanAccess({ permission, children, fallback = null }: CanAccessProps) {
  const can = usePermission(permission);
  return can ? <>{children}</> : <>{fallback}</>;
}
