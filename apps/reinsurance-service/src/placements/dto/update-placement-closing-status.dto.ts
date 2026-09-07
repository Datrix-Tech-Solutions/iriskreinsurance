import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlacementClosingStatus } from '../../../prisma/generated/client';

export class UpdatePlacementClosingStatusDto {
  @ApiProperty({
    enum: PlacementClosingStatus,
    example: PlacementClosingStatus.ISSUED,
    description:
      'Target closing status. Only allowed transitions are accepted — an invalid move returns 400.\n\n' +
      'Allowed transitions:\n' +
      '  DRAFT → ISSUED, VOID\n' +
      '  ISSUED → CONFIRMED, VOID\n' +
      '  CONFIRMED → terminal (no transitions)\n' +
      '  VOID → terminal (no transitions)',
  })
  @IsEnum(PlacementClosingStatus)
  status!: PlacementClosingStatus;
}
