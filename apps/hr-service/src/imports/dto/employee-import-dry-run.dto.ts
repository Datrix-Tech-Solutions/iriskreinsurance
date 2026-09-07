import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EmployeeImportDryRunRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional caller-provided key used to safely reuse an existing dry-run result for the same file.',
    example: 'employees-june-2026',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class EmployeeImportRowIssueDto {
  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'DUPLICATE_IN_FILE' })
  code!: string;

  @ApiProperty({
    example: 'Email appears more than once in this file.',
  })
  message!: string;
}

export class EmployeeImportDryRunRowDto {
  @ApiProperty({ example: 2 })
  rowNumber!: number;

  @ApiProperty({ enum: ['VALID', 'INVALID'], example: 'INVALID' })
  status!: 'VALID' | 'INVALID';

  @ApiProperty({ type: [EmployeeImportRowIssueDto] })
  errors!: EmployeeImportRowIssueDto[];

  @ApiProperty({ type: [EmployeeImportRowIssueDto] })
  warnings!: EmployeeImportRowIssueDto[];
}

export class EmployeeImportDryRunResponseDto {
  @ApiProperty({ example: '2ba1ed3f-5e35-4af7-8d3b-c6b746499328' })
  jobId!: string;

  @ApiProperty({ enum: ['EMPLOYEE'], example: 'EMPLOYEE' })
  entityType!: 'EMPLOYEE';

  @ApiProperty({
    enum: ['DRY_RUN_COMPLETED', 'DRY_RUN_FAILED'],
    example: 'DRY_RUN_COMPLETED',
  })
  status!: 'DRY_RUN_COMPLETED' | 'DRY_RUN_FAILED';

  @ApiProperty({ example: 25 })
  totalRows!: number;

  @ApiProperty({ example: 22 })
  validRows!: number;

  @ApiProperty({ example: 3 })
  invalidRows!: number;

  @ApiProperty({ type: [EmployeeImportDryRunRowDto] })
  rows!: EmployeeImportDryRunRowDto[];
}
