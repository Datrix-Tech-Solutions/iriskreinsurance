import { ApiProperty } from '@nestjs/swagger';
import { CompanyAgreementType } from '../../../prisma/generated/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCompanyAgreementDto {
  @ApiProperty({
    enum: CompanyAgreementType,
    example: CompanyAgreementType.NDA,
  })
  @IsEnum(CompanyAgreementType)
  type!: CompanyAgreementType;

  @ApiProperty({
    example: 'Employee Non-Disclosure Agreement 2026',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    example:
      'This agreement covers confidentiality obligations and handling of internal information.',
  })
  @IsString()
  details!: string;

  @ApiProperty({
    required: false,
    description:
      'Optional source document URL or storage path. MVP signing uses details text as the source of truth.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  documentUrl?: string;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Whether employees are expected to sign this agreement.',
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
