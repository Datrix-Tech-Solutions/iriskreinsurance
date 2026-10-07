import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementClaimCashCallStatus } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export const RECOVERY_WORKLIST_STATUSES = [
  'UNRECOVERED',
  'PARTIALLY_RECOVERED',
  'FULLY_RECOVERED',
] as const;

export type RecoveryWorklistStatus =
  (typeof RECOVERY_WORKLIST_STATUSES)[number];

export class QueryRecoveriesWorklistDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    example: 'POL-2026',
    maxLength: 100,
    description:
      'Searches policy number, insured/title, risk type, claim number, cash call number and reinsurer name.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reinsurerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cedantId?: string;

  @ApiPropertyOptional({ enum: RECOVERY_WORKLIST_STATUSES })
  @IsOptional()
  @IsIn(RECOVERY_WORKLIST_STATUSES)
  recoveryStatus?: RecoveryWorklistStatus;

  @ApiPropertyOptional({ enum: PlacementClaimCashCallStatus })
  @IsOptional()
  @IsIn(Object.values(PlacementClaimCashCallStatus))
  cashCallStatus?: PlacementClaimCashCallStatus;

  @ApiPropertyOptional({ example: 'GHS', maxLength: 3 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Inclusive occurrence-date lower bound.',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Exclusive occurrence-date upper bound.',
  })
  @IsOptional()
  @IsDateString()
  until?: string;
}
