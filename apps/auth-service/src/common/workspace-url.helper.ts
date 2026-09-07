/**
 * Workspace URL Helper
 *
 * Single source of truth for all tenant-scoped URL generation.
 * Uses FRONTEND_BASE_URL env var so migration to subdomains later
 * only requires changing this one file.
 *
 * Current pattern:  {FRONTEND_BASE_URL}/{slug}/...
 * Future subdomain: https://{slug}.workphelo.com/...
 */

function baseUrl(): string {
  return (
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  );
}

export const WorkspaceUrl = {
  /** Workspace login page — sent in registration confirmation email */
  login: (slug: string) => `${baseUrl()}/${slug}/login`,

  /** Accept invite link — sent in invite emails */
  acceptInvite: (slug: string, token: string) =>
    `${baseUrl()}/${slug}/accept-invite?token=${encodeURIComponent(token)}`,

  /** Password reset link — sent in forgot-password emails */
  resetPassword: (slug: string, token: string) =>
    `${baseUrl()}/${slug}/forgot-password/reset?token=${encodeURIComponent(token)}`,

  /** Email verification deep link — sent in registration emails */
  verifyEmail: (slug: string) => `${baseUrl()}/${slug}/verify-account`,

  /** Dashboard root — used in OAuth social login redirects */
  dashboard: (slug: string) => `${baseUrl()}/${slug}/dashboard`,
};
