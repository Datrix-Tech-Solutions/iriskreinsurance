import { PartialType } from '@nestjs/swagger';
import { CreatePlacementDto } from './create-placement.dto';

export class UpdatePlacementDto extends PartialType(CreatePlacementDto) {}
