import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlacementNoteStatus } from '../../../prisma/generated/client';

export class UpdatePlacementNoteStatusDto {
  @ApiProperty({
    enum: [PlacementNoteStatus.ISSUED],
    example: PlacementNoteStatus.ISSUED,
    description:
      'Only DRAFT -> ISSUED is supported through this endpoint. VOID uses the dedicated void endpoint.',
  })
  @IsEnum(PlacementNoteStatus)
  status!: PlacementNoteStatus;
}
