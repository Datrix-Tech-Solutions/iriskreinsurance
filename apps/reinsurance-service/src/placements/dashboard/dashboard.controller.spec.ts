import { RequestUser } from '@work-phelo/types';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { ReinsuranceDashboardController } from './dashboard.controller';
import { ReinsuranceDashboardService } from './dashboard.service';

describe('ReinsuranceDashboardController', () => {
  const dashboardService = {
    getOverview: jest.fn(),
    getPlacements: jest.fn(),
    getFinancials: jest.fn(),
    getClaims: jest.fn(),
  };
  const user = { tenantId: 'tenant-1' } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new ReinsuranceDashboardController(
      dashboardService as unknown as ReinsuranceDashboardService,
    );

  it('requires dashboard view permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, ReinsuranceDashboardController),
    ).toEqual(['operations.reinsurance.dashboard:VIEW']);
  });

  it('delegates dashboard reads using the authenticated tenant context', async () => {
    const controller = createController();

    await controller.getOverview({ user } as never);
    await controller.getPlacements({ user } as never);
    await controller.getFinancials({ user } as never);
    await controller.getClaims({}, { user } as never);

    expect(dashboardService.getOverview).toHaveBeenCalledWith('tenant-1');
    expect(dashboardService.getPlacements).toHaveBeenCalledWith('tenant-1');
    expect(dashboardService.getFinancials).toHaveBeenCalledWith('tenant-1');
    expect(dashboardService.getClaims).toHaveBeenCalledWith('tenant-1', {});
  });
});
