import { AccessController } from './access.controller';
import { RequestUser } from '@work-phelo/types';

describe('AccessController', () => {
  it('returns the authorized tenant context without exposing user data', () => {
    const user = {
      tenantId: 'tenant-1',
    } as RequestUser;
    const controller = new AccessController();

    expect(controller.verify({ user } as never)).toEqual({
      status: 'ok',
      service: 'reinsurance-service',
      tenantId: 'tenant-1',
      authorized: true,
    });
  });
});
