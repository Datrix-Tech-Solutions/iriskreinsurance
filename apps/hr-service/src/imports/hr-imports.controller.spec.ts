import { Response } from 'express';
import { HrImportsController } from './hr-imports.controller';
import { EMPLOYEE_IMPORT_TEMPLATE_FILENAME } from './employee-import-columns';
import { HrEmployeeImportsService } from './hr-employee-imports.service';

describe('HrImportsController', () => {
  let controller: HrImportsController;
  const importsService = {
    getEmployeeCsvTemplate: jest.fn(),
    dryRunEmployees: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    importsService.getEmployeeCsvTemplate.mockReturnValue(
      'firstName,lastName,email\nAma,Mensah,ama.mensah@example.com\n',
    );
    importsService.dryRunEmployees.mockResolvedValue({
      jobId: 'job-1',
      entityType: 'EMPLOYEE',
      status: 'DRY_RUN_COMPLETED',
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [],
    });
    controller = new HrImportsController(
      importsService as unknown as HrEmployeeImportsService,
    );
  });

  it('returns the employee import CSV template with download headers', () => {
    const setHeader = jest.fn();
    const response = {
      setHeader,
    } as unknown as Response;

    const csv = controller.downloadEmployeeTemplate(response);

    expect(csv).toBe(
      'firstName,lastName,email\nAma,Mensah,ama.mensah@example.com\n',
    );
    expect(importsService.getEmployeeCsvTemplate).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="${EMPLOYEE_IMPORT_TEMPLATE_FILENAME}"`,
    );
  });

  it('passes the uploaded multipart file and idempotency key to the service', async () => {
    const file = {
      originalname: 'employees.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from(
        'firstName,lastName,email\nAma,Mensah,a@example.com\n',
      ),
      size: 54,
    } as Express.Multer.File;
    const req = {
      user: {
        tenantId: 'tenant-1',
        id: 'user-1',
      },
    };

    const result = await controller.dryRunEmployees(
      file,
      'employees-june-2026',
      req as never,
    );

    expect(result).toEqual({
      jobId: 'job-1',
      entityType: 'EMPLOYEE',
      status: 'DRY_RUN_COMPLETED',
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [],
    });
    expect(importsService.dryRunEmployees).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      file,
      'employees-june-2026',
    );
  });

  it('lets the service return the clear missing-file validation error', async () => {
    const req = {
      user: {
        tenantId: 'tenant-1',
        id: 'user-1',
      },
    };

    await controller.dryRunEmployees(undefined, undefined, req as never);

    expect(importsService.dryRunEmployees).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      undefined,
      undefined,
    );
  });
});
