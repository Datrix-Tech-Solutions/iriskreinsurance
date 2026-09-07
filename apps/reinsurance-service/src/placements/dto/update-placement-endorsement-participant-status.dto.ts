import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlacementEndorsementParticipantStatus } from '../../../prisma/generated/client';

export class UpdatePlacementEndorsementParticipantStatusDto {
  @ApiProperty({
    enum: PlacementEndorsementParticipantStatus,
    example: PlacementEndorsementParticipantStatus.OFFER_SENT,
    description:
      'Moves an endorsement participant through the endorsement-scoped market response lifecycle.',
  })
  @IsEnum(PlacementEndorsementParticipantStatus)
  status!: PlacementEndorsementParticipantStatus;
}
