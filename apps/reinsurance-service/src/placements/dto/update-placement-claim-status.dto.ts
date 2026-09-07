import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlacementClaimStatus } from '../../../prisma/generated/client';

export class UpdatePlacementClaimStatusDto {
  @ApiProperty({
    enum: PlacementClaimStatus,
    example: PlacementClaimStatus.NOTIFIED,
    description:
      'Claim lifecycle status. Settlement/payment statuses are future-safe; PR1 does not create payments or cash calls.',
  })
  @IsEnum(PlacementClaimStatus)
  status!: PlacementClaimStatus;
}
