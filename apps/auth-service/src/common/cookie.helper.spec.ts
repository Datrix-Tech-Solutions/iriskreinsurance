describe('cookie helper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAME_SITE = 'lax';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function mockResponse() {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  }

  it('does not set a Domain attribute when COOKIE_DOMAIN is unset', async () => {
    delete process.env.COOKIE_DOMAIN;
    const { setAuthCookies } = await import('./cookie.helper');
    const res = mockResponse();

    setAuthCookies(res as never, 'access-token', 'refresh-token');

    const accessOptions = res.cookie.mock.calls[0][2];
    const refreshOptions = res.cookie.mock.calls[1][2];

    expect(res.cookie).toHaveBeenCalledWith('access_token', 'access-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    expect(accessOptions).not.toHaveProperty('domain');
    expect(refreshOptions).not.toHaveProperty('domain');
  });

  it('sets Domain on access and refresh cookies when COOKIE_DOMAIN is set', async () => {
    process.env.COOKIE_DOMAIN = 'iriskreinsurance.com';
    const { setAuthCookies } = await import('./cookie.helper');
    const res = mockResponse();

    setAuthCookies(res as never, 'access-token', 'refresh-token');

    expect(res.cookie.mock.calls[0][2]).toMatchObject({
      domain: 'iriskreinsurance.com',
    });
    expect(res.cookie.mock.calls[1][2]).toMatchObject({
      domain: 'iriskreinsurance.com',
    });
  });

  it('uses the same Domain attributes when clearing cookies', async () => {
    process.env.COOKIE_DOMAIN = 'iriskreinsurance.com';
    const { clearAuthCookies } = await import('./cookie.helper');
    const res = mockResponse();

    clearAuthCookies(res as never);

    const expectedOptions = {
      secure: true,
      sameSite: 'lax',
      path: '/',
      domain: 'iriskreinsurance.com',
    };

    expect(res.clearCookie).toHaveBeenCalledWith(
      'access_token',
      expectedOptions,
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expectedOptions,
    );
  });
});
