import { CookieOptions, Response } from 'express';

// COOKIE_SECURE should be 'true' only when running behind HTTPS.
// NODE_ENV=production alone is not sufficient — a production server
// running HTTP (e.g. behind a load balancer terminating SSL elsewhere)
// still needs secure=false at the cookie level.
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const SAME_SITE =
  (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: SAME_SITE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

const clearCookieOptions: CookieOptions = {
  secure: COOKIE_SECURE,
  sameSite: SAME_SITE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  setAccessTokenCookie(res, accessToken);

  res.cookie('refresh_token', refreshToken, {
    ...baseCookieOptions,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    // Keep the cookie available on page requests so frontend middleware can
    // distinguish "fully signed out" from "access token expired but refreshable".
  });
}

export function setAccessTokenCookie(res: Response, accessToken: string) {
  res.cookie('access_token', accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', clearCookieOptions);
  res.clearCookie('refresh_token', clearCookieOptions);
}
