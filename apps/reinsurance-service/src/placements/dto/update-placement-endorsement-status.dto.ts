import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlacementEndorsementStatus } from '../../../prisma/generated/client';

export class UpdatePlacementEndorsementStatusDto {
  @ApiProperty({
    enum: PlacementEndorsementStatus,
    example: PlacementEndorsementStatus.MARKETING,
    description:
      'MVP lifecycle: DRAFT -> MARKETING/DECLINED/VOID; MARKETING -> PARTIALLY_ACCEPTED/ACCEPTED/DECLINED/VOID; PARTIALLY_ACCEPTED -> ACCEPTED/CLOSING/DECLINED/VOID; ACCEPTED -> CLOSING/DECLINED/VOID; CLOSING -> CLOSED/VOID. CLOSED, DECLINED and VOID are terminal.',
  })
  @IsEnum(PlacementEndorsementStatus)
  status!: PlacementEndorsementStatus;
}
