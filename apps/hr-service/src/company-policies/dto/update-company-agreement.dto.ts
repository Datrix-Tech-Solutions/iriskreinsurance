import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyAgreementType } from '../../../prisma/generated/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCompanyAgreementDto {
  @ApiPropertyOptional({ enum: CompanyAgreementType })
  @IsOptional()
  @IsEnum(CompanyAgreementType)
  type?: CompanyAgreementType;

  @ApiPropertyOptional({
    example: 'Employee Non-Disclosure Agreement 2026',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({
    example:
      'Updated confidentiality obligations and handling of internal information.',
  })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({
    description:
      'Optional source document URL or storage path. MVP signing uses details text as the source of truth.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  documentUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether employees are expected to sign this agreement.',
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
