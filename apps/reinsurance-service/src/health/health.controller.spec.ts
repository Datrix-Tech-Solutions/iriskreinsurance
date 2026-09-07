import { HealthController } from './health.controller';

describe('HealthController', () => {
  const database = {
    check: jest.fn(),
  };
  const controller = new HealthController(database as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns readiness when the reinsurance database is reachable', async () => {
    database.check.mockResolvedValueOnce(undefined);

    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      service: 'reinsurance-service',
    });
    expect(database.check).toHaveBeenCalled();
  });

  it('fails readiness when the database is unavailable', async () => {
    database.check.mockRejectedValueOnce(new Error('database down'));

    await expect(controller.check()).rejects.toMatchObject({
      response: {
        status: 'error',
        service: 'reinsurance-service',
        message: 'Reinsurance database is unavailable',
      },
    });
  });
});
