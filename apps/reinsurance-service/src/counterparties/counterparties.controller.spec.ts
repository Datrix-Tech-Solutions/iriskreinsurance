import { RequestUser } from '@work-phelo/types';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { CounterpartiesController } from './counterparties.controller';
import { CounterpartyPermission } from './counterparty.permissions';
import { CounterpartiesService } from './counterparties.service';

describe('CounterpartiesController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
  };
  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates list queries using only the authenticated tenant context', async () => {
    const controller = new CounterpartiesController(
      service as unknown as CounterpartiesService,
    );
    const query = { page: 1, limit: 20 };

    await controller.findAll(query, { user } as never);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it.each([
    ['findAll', CounterpartyPermission.VIEW],
    ['findOne', CounterpartyPermission.VIEW],
    ['create', CounterpartyPermission.CREATE],
    ['update', CounterpartyPermission.EDIT],
    ['archive', CounterpartyPermission.DELETE],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CounterpartiesController.prototype[
          method as keyof CounterpartiesController
        ],
      ),
    ).toEqual([permission]);
  });
});
