import { ApiProperty } from '@nestjs/swagger';
import { PlacementClosingResponseDto } from './placement-closing-response.dto';
import { PlacementParticipantResponseDto } from './placement-response.dto';

export class AcceptPlacementParticipantResponseDto {
  @ApiProperty({
    type: PlacementParticipantResponseDto,
    description: 'The accepted placement participant after the workflow.',
  })
  participant!: PlacementParticipantResponseDto;

  @ApiProperty({
    type: PlacementClosingResponseDto,
    description:
      'The active placement closing after creation, issue and confirmation.',
  })
  closing!: PlacementClosingResponseDto;
}
