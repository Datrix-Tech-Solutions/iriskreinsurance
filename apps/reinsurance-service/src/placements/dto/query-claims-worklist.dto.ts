import { Type } from 'class-transformer';
import {
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
import { PlacementClaimState } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export const CLAIMS_WORKLIST_TABS = ['notification', 'open', 'closed'] as const;

export type ClaimsWorklistTab = (typeof CLAIMS_WORKLIST_TABS)[number];

export class QueryClaimsWorklistDto {
  @ApiPropertyOptional({
    enum: CLAIMS_WORKLIST_TABS,
    default: 'notification',
    description:
      'Claims page tab. Bucket classification is derived server-side from finalized loss and recovery state.',
  })
  @IsOptional()
  @IsIn(CLAIMS_WORKLIST_TABS)
  tab: ClaimsWorklistTab = 'notification';

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
      'Searches policy number, insured/title, class of business and claim number.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by tenant-owned cedant counterparty.',
  })
  @IsOptional()
  @IsUUID()
  cedantId?: string;

  @ApiPropertyOptional({
    enum: PlacementClaimState,
    description:
      'Filter by persisted claim state. Intended for the open tab (PENDING = no allocations, FINALIZED = allocations generated).',
  })
  @IsOptional()
  @IsIn(Object.values(PlacementClaimState))
  claimState?: PlacementClaimState;
}
