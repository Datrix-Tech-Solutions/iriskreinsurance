import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PermissionAction } from './grant-permission.dto';

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

export class QueryPermissionRecipientsDto {
  @IsString()
  @MaxLength(100)
  resource!: string;

  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeTenantAdmins?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activeOnly?: boolean;
}
