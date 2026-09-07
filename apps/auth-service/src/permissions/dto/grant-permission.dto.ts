import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PermissionAction {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  RUN = 'RUN',
  EXPORT = 'EXPORT',
  ASSIGN = 'ASSIGN',
}

export class GrantPermissionDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  resourceId!: string;

  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokePermissionDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  resourceId!: string;

  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignPermissionSetDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  permissionSetId!: string;
}

export class PermissionSetResourceDto {
  @IsUUID()
  resourceId!: string;

  @IsEnum(PermissionAction)
  action!: PermissionAction;
}

export class CreatePermissionSetDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionSetResourceDto)
  resources!: PermissionSetResourceDto[];
}

export class UpdatePermissionSetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionSetResourceDto)
  resources!: PermissionSetResourceDto[];
}
