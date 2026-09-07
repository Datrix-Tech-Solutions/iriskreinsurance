import { PartialType } from '@nestjs/swagger';
import { CreatePlacementEndorsementParticipantDto } from './create-placement-endorsement-participant.dto';

export class UpdatePlacementEndorsementParticipantDto extends PartialType(
  CreatePlacementEndorsementParticipantDto,
) {}
