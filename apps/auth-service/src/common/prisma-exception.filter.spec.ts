import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { GlobalExceptionFilter } from './prisma-exception.filter';

function createHost() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const getResponse = jest.fn(() => ({ status, json }));
  const getRequest = jest.fn(() => ({
    method: 'POST',
    url: '/tenants/tenant-1/document-profile/logo',
  }));
  const switchToHttp = jest.fn(() => ({ getResponse, getRequest }));

  return {
    host: { getType: () => 'http', switchToHttp } as unknown as ArgumentsHost,
    status,
    json,
  };
}

describe('GlobalExceptionFilter', () => {
  it('returns an actionable message for missing database schema errors', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError(
      'The table `TenantDocumentProfile` does not exist.',
      {
        code: 'P2021',
        clientVersion: '5.22.0',
        meta: { table: 'TenantDocumentProfile' },
      },
    );

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message:
        'Database schema is not up to date. Run the latest Auth migrations and retry.',
      error: 'INTERNAL_SERVER_ERROR',
    });
  });
});
