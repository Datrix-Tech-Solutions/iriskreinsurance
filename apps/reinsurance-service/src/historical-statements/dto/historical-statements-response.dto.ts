import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatementKind } from './historical-statements-query.dto';
export class ArchivePaginationDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
export class ArchiveDatasetDto {
  @ApiProperty() id!: string;
  @ApiProperty() datasetKey!: string;
  @ApiProperty() datasetVersion!: string;
  @ApiProperty({ enum: ['PUBLISHED'] }) status!: 'PUBLISHED';
  @ApiProperty({ type: String, nullable: true }) publishedAt!: string | null;
  @ApiProperty() contractVersion!: string;
  @ApiProperty() fileCount!: number;
  @ApiProperty() insurerRowCount!: number;
  @ApiProperty() reinsurerRowCount!: number;
  @ApiProperty() linkCount!: number;
}
export class ArchiveDatasetsResponseDto {
  @ApiProperty({ type: [ArchiveDatasetDto] }) items!: ArchiveDatasetDto[];
  @ApiProperty({ type: ArchivePaginationDto }) meta!: ArchivePaginationDto;
}
export class ArchiveQualityWarningDto {
  @ApiProperty({
    description:
      'Original loader warning code, e.g. EPOCH_SENTINEL or REVERSED_COVERAGE',
  })
  code!: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 29 }) columnIndex?: number;
  @ApiPropertyOptional({
    description: 'Unmodified source text associated with the warning',
  })
  sourceValue?: string;
}
export class ArchiveRowBaseDto {
  @ApiProperty() id!: string;
  @ApiProperty() datasetId!: string;
  @ApiProperty({ enum: StatementKind }) kind!: StatementKind;
  @ApiProperty() year!: number;
  @ApiProperty() sourceFileName!: string;
  @ApiProperty() sourceSheetName!: string;
  @ApiProperty() sourceRow!: number;
  @ApiProperty() rowSha256!: string;
  @ApiProperty({
    type: [ArchiveQualityWarningDto],
    description: 'Preserved source quality flags, never historical corrections',
  })
  qualityWarnings!: ArchiveQualityWarningDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Original source text',
  })
  policyNumber!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Original source text',
  })
  insuredName!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Original source text',
  })
  businessName!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Source calendar date YYYY-MM-DD; no historical correction',
  })
  offerDate!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Source calendar date YYYY-MM-DD; no historical correction',
  })
  closedDate!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Source calendar date YYYY-MM-DD; no historical correction',
  })
  startDate!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Source calendar date YYYY-MM-DD; no historical correction',
  })
  endDate!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Original source text',
  })
  currency!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  sumInsured100!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  premium100!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  facShare!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  facSumInsured!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  facPremium!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  paidFacPremium!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  paidCommission!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  brokerage!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  brokeragePaid!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  wht!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  nicLevy!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  paidNic!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  netPremiumDueReinsurer!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Exact source Decimal(30,12), serialized as a string; no operational calculation',
  })
  netPremiumPaid!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Original source text',
  })
  offerStatus!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Original source text',
  })
  paymentStatus!: string | null;
}
export class ArchiveInsurerRowDto extends ArchiveRowBaseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  insurerName!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  insurerCommissionPercent!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  netPremiumDueBroker!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  netPremiumDueBrokerPaid!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  paidWht!: string | null;
}
export class ArchiveReinsurerRowDto extends ArchiveRowBaseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  reinsurerName!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  reinsuredName!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  insurerCommissionAmount!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  paidWhtFirst!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Preserved source value; financial values are exact decimal strings',
  })
  paidWhtSecond!: string | null;
}
export class ArchiveOriginalColumnDto {
  @ApiProperty() columnIndex!: number;
  @ApiProperty() columnLetter!: string;
  @ApiProperty({ type: String, nullable: true }) header!: string | null;
  @ApiProperty() sourceAddress!: string;
  @ApiProperty({ enum: ['VALUE', 'BLANK', 'MISSING'] }) state!: string;
  @ApiProperty({ type: String, nullable: true }) cellType!: string | null;
  @ApiProperty({ type: String, nullable: true }) value!: string | null;
  @ApiProperty({ type: String, nullable: true }) xmlValue!: string | null;
  @ApiProperty({ type: Number, nullable: true }) styleIndex!: number | null;
  @ApiProperty({ type: String, nullable: true }) formula!: string | null;
  @ApiProperty({ type: String, nullable: true }) cachedValue!: string | null;
  @ApiProperty({ type: Object, nullable: true }) formulaAttributes!: unknown;
}
export class ArchiveInsurerDetailDto extends ArchiveInsurerRowDto {
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty({ type: [ArchiveOriginalColumnDto] })
  originalColumns!: ArchiveOriginalColumnDto[];
}
export class ArchiveReinsurerDetailDto extends ArchiveReinsurerRowDto {
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty({ type: [ArchiveOriginalColumnDto] })
  originalColumns!: ArchiveOriginalColumnDto[];
}
export class ArchiveInsurerListDto {
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty({ type: [ArchiveInsurerRowDto] }) items!: ArchiveInsurerRowDto[];
  @ApiProperty({ type: ArchivePaginationDto }) meta!: ArchivePaginationDto;
}
export class ArchiveReinsurerListDto {
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty({ type: [ArchiveReinsurerRowDto] })
  items!: ArchiveReinsurerRowDto[];
  @ApiProperty({ type: ArchivePaginationDto }) meta!: ArchivePaginationDto;
}
export class ArchiveLinkDto {
  @ApiProperty() matchId!: string;
  @ApiProperty({ enum: ['SUPPLIED_AUTHORITATIVE', 'APPROVED_CANDIDATE'] })
  basis!: string;
}
export class ArchiveLinkedReinsurerDto {
  @ApiProperty({ type: ArchiveLinkDto }) link!: ArchiveLinkDto;
  @ApiProperty({ type: ArchiveReinsurerRowDto })
  statement!: ArchiveReinsurerRowDto;
}
export class ArchiveLinkedInsurerDto {
  @ApiProperty({ type: ArchiveLinkDto }) link!: ArchiveLinkDto;
  @ApiProperty({ type: ArchiveInsurerRowDto }) statement!: ArchiveInsurerRowDto;
}
export class ArchiveReinsurerLinksDto {
  @ApiProperty({ enum: ['LINKED', 'UNLINKED'] }) state!: 'LINKED' | 'UNLINKED';
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty() insurerId!: string;
  @ApiProperty({ type: [ArchiveLinkedReinsurerDto] })
  items!: ArchiveLinkedReinsurerDto[];
  @ApiProperty({ type: ArchivePaginationDto }) meta!: ArchivePaginationDto;
}
export class ArchiveInsurerLinkDto {
  @ApiProperty({ enum: ['LINKED', 'UNLINKED'] }) state!: 'LINKED' | 'UNLINKED';
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty() reinsurerId!: string;
  @ApiProperty({ type: ArchiveLinkedInsurerDto, nullable: true })
  item!: ArchiveLinkedInsurerDto | null;
}
export class ArchiveFacetsResponseDto {
  @ApiProperty({ type: ArchiveDatasetDto }) dataset!: ArchiveDatasetDto;
  @ApiProperty({ enum: StatementKind }) kind!: StatementKind;
  @ApiProperty({ type: [Number] }) years!: number[];
  @ApiProperty({ type: [String] }) insurers!: string[];
  @ApiProperty({ type: [String] }) reinsurers!: string[];
  @ApiProperty({ type: [String] }) insureds!: string[];
  @ApiProperty({ type: [String] }) businessNames!: string[];
  @ApiProperty({ type: [String] }) currencies!: string[];
  @ApiProperty({ type: [String] }) offerStatuses!: string[];
  @ApiProperty({ type: [String] }) paymentStatuses!: string[];
}
export class ArchiveErrorDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];
  @ApiProperty() error!: string;
}
