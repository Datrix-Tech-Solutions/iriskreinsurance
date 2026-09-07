import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/platform/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.endsWith(r))) {
    return NextResponse.next();
  }

  // Allow tenant login routes /:tenantSlug/login
  if (pathname.match(/^\/[^/]+\/login$/)) {
    return NextResponse.next();
  }

  // Allow accept-invite, reset-password, and forgot-password routes
  if (
    pathname.includes('/accept-invite') ||
    pathname.includes('/reset-password') ||
    pathname.includes('/verify-account') ||
    pathname.includes('/forgot-password')
  ) {
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!accessToken && !refreshToken) {
    let loginPath = '/login';

    if (pathname.startsWith('/platform')) {
      loginPath = '/platform/login';
    } else {
      // Extract tenantSlug from /:tenantSlug/...
      const tenantMatch = pathname.match(/^\/([^/]+)\//);
      if (tenantMatch) {
        loginPath = `/${tenantMatch[1]}/login`;
      }
    }

    const loginUrl = new URL(loginPath, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.svg$|.*\.ico$|.*\.webp$).*)',
  ],
};
