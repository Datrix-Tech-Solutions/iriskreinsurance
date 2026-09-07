import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class PlacementEmailRecipientDto {
  @ApiProperty({ example: 'underwriter@example.com' })
  @TrimmedString()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: 'Avenue Re Underwriting' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}

export class SendPlacementEmailDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mailboxConnectionId!: string;

  @ApiProperty({ type: [PlacementEmailRecipientDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  to!: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  cc?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  bcc?: PlacementEmailRecipientDto[];

  @ApiProperty({ example: 'Offer slip for FAC/2026/001' })
  @TrimmedString()
  @IsString()
  @MaxLength(255)
  subject!: string;

  @ApiPropertyOptional({ example: 'Please review the attached offer details.' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyText?: string;

  @ApiPropertyOptional({
    example: '<p>Please review the attached offer details.</p>',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Generated placement document IDs to attach as PDFs. Phase 1 supports OFFER_SLIP and CLOSING_SLIP documents only.',
    example: ['1c3f2d4a-8b2f-4f0f-b4f2-1f5a2c0a9d18'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Uploaded placement attachment IDs to attach from private storage.',
    example: ['9f5f8ff6-1058-4437-ae97-bae93bb05012'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class ReplyPlacementEmailDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mailboxConnectionId!: string;

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  to?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  cc?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ type: [PlacementEmailRecipientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementEmailRecipientDto)
  bcc?: PlacementEmailRecipientDto[];

  @ApiPropertyOptional({ example: 'Following up on this placement.' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyText?: string;

  @ApiPropertyOptional({ example: '<p>Following up on this placement.</p>' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Generated placement document IDs to attach as PDFs. Phase 1 supports OFFER_SLIP and CLOSING_SLIP documents only.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Uploaded placement attachment IDs to attach from private storage.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
