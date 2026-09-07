import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PlacementClosingStatus } from '../../../prisma/generated/client';

export class UpdatePlacementEndorsementClosingStatusDto {
  @ApiProperty({
    enum: PlacementClosingStatus,
    example: PlacementClosingStatus.ISSUED,
    description:
      'Target endorsement closing status. Only allowed transitions are accepted — invalid moves return 400.\n\n' +
      'Allowed transitions:\n' +
      '  DRAFT → ISSUED, VOID\n' +
      '  ISSUED → CONFIRMED, VOID\n' +
      '  CONFIRMED → terminal (no transitions)\n' +
      '  VOID → terminal (no transitions)',
  })
  @IsEnum(PlacementClosingStatus)
  status!: PlacementClosingStatus;
}
