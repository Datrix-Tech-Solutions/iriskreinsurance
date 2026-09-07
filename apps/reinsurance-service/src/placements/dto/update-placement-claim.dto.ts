import { PartialType } from '@nestjs/swagger';
import { CreatePlacementClaimDto } from './create-placement-claim.dto';

export class UpdatePlacementClaimDto extends PartialType(
  CreatePlacementClaimDto,
) {}
