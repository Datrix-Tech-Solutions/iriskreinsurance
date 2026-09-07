import { IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Leave type ID', example: 'leave-type-123' })
  @IsString()
  leaveTypeId!: string;

  @ApiProperty({ description: 'Leave start date', example: '2026-06-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Leave end date', example: '2026-06-05' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Optional leave reason',
    example: 'Annual vacation',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Optional employee who will cover responsibilities during this leave period.',
    example: 'c10f6f65-0c36-4b0f-9a56-f7cfbc2f2d90',
  })
  @IsOptional()
  @IsUUID()
  coverageEmployeeId?: string;

  @ApiPropertyOptional({
    description:
      'Optional note describing the handover or coverage expectations for the selected employee.',
    example: 'Handle payroll reconciliations and urgent finance approvals.',
  })
  @IsOptional()
  @IsString()
  coverageNote?: string;

  @ApiPropertyOptional({
    description:
      'Optional supporting document name. Some leave types require this document before the request can be approved.',
    example: 'Medical Report - May 2026',
  })
  @IsOptional()
  @IsString()
  supportingDocumentName?: string;

  @ApiPropertyOptional({
    description:
      'Optional supporting document URL. Some leave types require this document before the request can be approved.',
    example: 'https://storage.example.com/leave-docs/medical-report-123.pdf',
  })
  @IsOptional()
  @IsString()
  supportingDocumentUrl?: string;
}
