import { ConflictException, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { ReinsuranceAccountingIntegrationActiveGuard } from './integration-active.guard';

const user = (overrides: Partial<RequestUser> = {}): RequestUser => ({
  id: 'user-1',
  email: 'user@example.com',
  role: 'EMPLOYEE',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant',
  tenantName: 'Tenant',
  firstName: 'User',
  permissions: [],
  moduleConfig: { operations: true, accounting: true },
  featureConfig: { operations: { reinsurance: true } },
  integrationConfig: { 'operations.reinsurance->accounting': true },
  ...overrides,
});

function context(requestUser: RequestUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }),
  } as unknown as ExecutionContext;
}

describe('ReinsuranceAccountingIntegrationActiveGuard', () => {
  it('allows an explicitly connected tenant with both modules enabled', () => {
    expect(
      new ReinsuranceAccountingIntegrationActiveGuard().canActivate(
        context(user()),
      ),
    ).toBe(true);
  });

  it('rejects a deliberately disconnected tenant', () => {
    expect(() =>
      new ReinsuranceAccountingIntegrationActiveGuard().canActivate(
        context(user({ integrationConfig: {} })),
      ),
    ).toThrow(ConflictException);
  });

  it('rejects when Accounting is unavailable', () => {
    expect(() =>
      new ReinsuranceAccountingIntegrationActiveGuard().canActivate(
        context(
          user({ moduleConfig: { operations: true, accounting: false } }),
        ),
      ),
    ).toThrow(ConflictException);
  });
});
