import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRiskTypeFieldDto } from './create-risk-type-field.dto';

export class UpdateRiskTypeFieldDto extends PartialType(
  OmitType(CreateRiskTypeFieldDto, ['section', 'fieldKey'] as const),
) {}
