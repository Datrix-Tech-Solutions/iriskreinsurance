import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { EmployeeImportDryRunResponseDto } from './dto/employee-import-dry-run.dto';
import { EMPLOYEE_IMPORT_TEMPLATE_FILENAME } from './employee-import-columns';
import { HrEmployeeImportsService } from './hr-employee-imports.service';

@ApiTags('Imports')
@Controller('imports/employees')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class HrImportsController {
  constructor(private readonly importsService: HrEmployeeImportsService) {}

  @Get('template')
  @RequirePermissions(Permission.CREATE_EMPLOYEE)
  @ApiOperation({
    summary: 'Download the CSV template for employee imports',
    description:
      'Returns the exact employee import columns accepted by the dry-run validator, plus one sample row.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'Employee import CSV template',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          example:
            'firstName,lastName,email,department,jobTitle,employmentType,hireDate\\nAma,Mensah,ama.mensah@example.com,Human Resources,HR Officer,FULL_TIME,2026-01-05\\n',
        },
      },
    },
  })
  downloadEmployeeTemplate(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${EMPLOYEE_IMPORT_TEMPLATE_FILENAME}"`,
    );

    return this.importsService.getEmployeeCsvTemplate();
  }

  @Post('dry-run')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CREATE_EMPLOYEE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Dry-run validate a CSV employee import without creating records',
    description:
      'Validates employee CSV rows for the current tenant. This endpoint never creates employees, auth users, leave balances, holidays, or invitation events.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file containing employee rows to validate.',
        },
        idempotencyKey: {
          type: 'string',
          description:
            'Optional caller-provided key used to safely reuse an existing dry-run result for the same file.',
          example: 'employees-june-2026',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'CSV validated and row-level results persisted',
    type: EmployeeImportDryRunResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid file, unsupported file type, invalid CSV, or file exceeds MVP limits',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key was already used for a different file',
  })
  dryRunEmployees(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('idempotencyKey') idempotencyKey: string | undefined,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.importsService.dryRunEmployees(
      req.user.tenantId,
      req.user.id,
      file,
      idempotencyKey,
    );
  }
}
