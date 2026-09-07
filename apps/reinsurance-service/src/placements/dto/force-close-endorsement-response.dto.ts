import { ApiProperty } from '@nestjs/swagger';
import { PlacementEndorsementStatus } from '../../../prisma/generated/client';
import { PlacementEndorsementClosingResponseDto } from './placement-endorsement-closing-response.dto';
import { PlacementEndorsementResponseDto } from './placement-endorsement-response.dto';
import { PlacementEndorsementSummaryResponseDto } from './placement-endorsement-summary-response.dto';

export class ForceCloseEndorsementResponseDto {
  @ApiProperty({ type: PlacementEndorsementResponseDto })
  endorsement!: PlacementEndorsementResponseDto;

  @ApiProperty({ type: [PlacementEndorsementClosingResponseDto] })
  closings!: PlacementEndorsementClosingResponseDto[];

  @ApiProperty({ type: PlacementEndorsementSummaryResponseDto })
  summary!: PlacementEndorsementSummaryResponseDto;

  @ApiProperty({
    enum: PlacementEndorsementStatus,
    example: PlacementEndorsementStatus.CLOSED,
    description: 'Effective endorsement workflow status after force close.',
  })
  effectiveStatus!: PlacementEndorsementStatus;
}
