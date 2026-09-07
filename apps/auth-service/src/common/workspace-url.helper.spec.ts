import { WorkspaceUrl } from './workspace-url.helper';

describe('WorkspaceUrl', () => {
  const originalFrontendBaseUrl = process.env.FRONTEND_BASE_URL;
  const originalAppUrl = process.env.APP_URL;

  afterEach(() => {
    process.env.FRONTEND_BASE_URL = originalFrontendBaseUrl;
    process.env.APP_URL = originalAppUrl;
  });

  it('builds dev invite links from the dev app domain when configured', () => {
    process.env.FRONTEND_BASE_URL = 'https://dev-app.workphelo.com';
    delete process.env.APP_URL;

    const url = WorkspaceUrl.acceptInvite('acme-ghana', 'invite-token');

    expect(url).toBe(
      'https://dev-app.workphelo.com/acme-ghana/accept-invite?token=invite-token',
    );
    expect(url).not.toContain('dev.workphelo.datrixtechsolutions.com');
    expect(url).not.toContain('localhost');
  });

  it('builds production invite links from the production app domain when configured', () => {
    process.env.FRONTEND_BASE_URL = 'https://app.workphelo.com';
    delete process.env.APP_URL;

    const url = WorkspaceUrl.acceptInvite('acme-ghana', 'invite-token');

    expect(url).toBe(
      'https://app.workphelo.com/acme-ghana/accept-invite?token=invite-token',
    );
    expect(url).not.toContain('https://workphelo.com/');
    expect(url).not.toContain('localhost');
  });
});
