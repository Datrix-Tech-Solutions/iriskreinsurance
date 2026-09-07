import { readFileSync } from 'fs';
import { join } from 'path';

const controllerSource = readFileSync(
  join(__dirname, 'auth.controller.ts'),
  'utf8',
);

function methodDecoratorBlock(methodName: string): string {
  const methodMatch = new RegExp(
    `\\n  (?:async\\s+)?${methodName}\\s*\\(`,
  ).exec(controllerSource);
  const methodIndex = methodMatch?.index ?? -1;
  expect(methodIndex).toBeGreaterThan(-1);

  const beforeMethod = controllerSource.slice(0, methodIndex);
  const previousMethodIndex = beforeMethod.lastIndexOf('\n\n');

  return beforeMethod.slice(previousMethodIndex);
}

describe('AuthController throttling', () => {
  it.each([
    'login',
    'adminLogin',
    'verifyEmail',
    'resetPassword',
    'forceResetPassword',
    'verifyTotp',
    'verifySmsOtp',
  ])('applies a sensitive auth throttle to %s', (methodName) => {
    expect(methodDecoratorBlock(methodName)).toContain(
      '@Throttle(SENSITIVE_AUTH_THROTTLE)',
    );
  });

  it.each(['resendVerification', 'forgotPassword', 'sendSmsOtp'])(
    'applies a tighter OTP/send throttle to %s',
    (methodName) => {
      expect(methodDecoratorBlock(methodName)).toContain(
        '@Throttle(OTP_SEND_THROTTLE)',
      );
    },
  );

  it('keeps ordinary authenticated endpoints on the global throttle policy', () => {
    expect(methodDecoratorBlock('me')).not.toContain('@Throttle(');
    expect(methodDecoratorBlock('changePassword')).not.toContain('@Throttle(');
  });

  it('documents concrete low-risk throttle limits in source', () => {
    expect(controllerSource).toContain('short: { limit: 5, ttl: 60_000 }');
    expect(controllerSource).toContain('medium: { limit: 20, ttl: 60_000 }');
    expect(controllerSource).toContain('short: { limit: 3, ttl: 60_000 }');
    expect(controllerSource).toContain('medium: { limit: 10, ttl: 60_000 }');
  });
});
