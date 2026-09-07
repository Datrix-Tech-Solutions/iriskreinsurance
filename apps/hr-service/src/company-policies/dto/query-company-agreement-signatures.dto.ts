import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyAgreementSignatureStatus } from '../../../prisma/generated/client';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryCompanyAgreementSignaturesDto {
  @ApiPropertyOptional({
    enum: CompanyAgreementSignatureStatus,
    description:
      'Optional signature status filter. Pending employees are included when omitted.',
  })
  @IsOptional()
  @IsEnum(CompanyAgreementSignatureStatus)
  status?: CompanyAgreementSignatureStatus;
}
