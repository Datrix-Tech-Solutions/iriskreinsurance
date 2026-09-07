'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setLoading, setPermissions } = useAuthStore();
  const pathname = usePathname();

  const isPublicAuthRoute = Boolean(
    pathname === '/login' ||
    pathname === '/platform/login' ||
    /^\/[^/]+\/login$/.test(pathname) ||
    pathname.includes('/accept-invite') ||
    pathname.includes('/reset-password') ||
    pathname.includes('/verify-account') ||
    pathname.includes('/forgot-password'),
  );

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }

    if (isPublicAuthRoute) {
      setLoading(false);
      return;
    }

    api
      .get<{ user: User; permissions: string[] }>('/auth/me')
      .then(async (res) => {
        const authUser = res.data.user;

        // SUPER_ADMIN and TENANT_ADMIN bypass permission checks — no array needed.
        // All other roles (EMPLOYEE, MANAGER, or any custom role) load permissions from the response.
        if (authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'TENANT_ADMIN') {
          setPermissions(res.data.permissions ?? []);

          // /auth/me does not currently return lastName for employee users.
          try {
            const empRes = await api.get<{ lastName?: string }>('/hr/employees/me');
            if (empRes.data.lastName) authUser.lastName = empRes.data.lastName;
          } catch {
            // Not critical — keep the auth payload as-is.
          }
        }

        setUser(authUser);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [isPublicAuthRoute, setLoading, setPermissions, setUser, user]);

  return <>{children}</>;
}
