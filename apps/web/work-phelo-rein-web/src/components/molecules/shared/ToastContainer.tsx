'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { Icons } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';

const LOGIN_PATHS = [
  '/login',
  '/forgot-password',
  '/forgot-password/verify',
  '/forgot-password/reset',
];

function isLoginPage(pathname: string): boolean {
  return LOGIN_PATHS.some((p) => pathname === p || pathname.endsWith(p));
}

export function ToastContainer() {
  const pathname = usePathname();
  const onLoginPage = isLoginPage(pathname);

  return (
    <div
      className={cn(
        onLoginPage && 'fixed top-0 left-0 w-full lg:w-[42%] transform pointer-events-none',
      )}
    >
      <Toaster
        position="top-center"
        closeButton
        gap={8}
        duration={10000}
        icons={{
          success: (
            <div
              className="shrink-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center"
              style={{ animation: 'toast-icon-pop 3s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            >
              <Icons.Check className="text-white toast-icon-draw" size={16} strokeWidth={5} />
            </div>
          ),
          error: (
            <div
              className="shrink-0 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center"
              style={{ animation: 'toast-icon-pop 3s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            >
              <Icons.X className="text-white toast-icon-draw" size={16} strokeWidth={5} />
            </div>
          ),
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              'pointer-events-auto flex items-center gap-3 w-full min-w-70 max-w-sm pl-4 pr-8 py-3 rounded-card bg-white shadow-md border border-gray-100',
            title: 'text-sm text-[#374151]',
            closeButton:
              '!absolute !right-2 !left-auto !transform-none !bg-transparent !border-none text-[#9ca3af] hover:text-[#374151] transition-colors w-5 h-5',
            success: '!border-l-4 !border-l-green-500',
            error: '!border-l-4 !border-l-red-500',
          },
        }}
      />
    </div>
  );
}
