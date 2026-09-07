import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PlacementClaimCashCallStatus } from '../../../prisma/generated/client';

export class UpdatePlacementClaimCashCallStatusDto {
  @ApiProperty({
    enum: PlacementClaimCashCallStatus,
    example: PlacementClaimCashCallStatus.ISSUED,
    description:
      'PR1 supports DRAFT -> ISSUED, DRAFT -> VOID and ISSUED -> VOID. PAID is reserved for future claim settlement payment integration.',
  })
  @IsEnum(PlacementClaimCashCallStatus)
  status!: PlacementClaimCashCallStatus;
}
