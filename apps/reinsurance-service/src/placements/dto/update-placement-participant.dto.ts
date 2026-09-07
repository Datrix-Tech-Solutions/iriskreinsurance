import { PartialType } from '@nestjs/swagger';
import { CreatePlacementParticipantDto } from './create-placement-participant.dto';

export class UpdatePlacementParticipantDto extends PartialType(
  CreatePlacementParticipantDto,
) {}
