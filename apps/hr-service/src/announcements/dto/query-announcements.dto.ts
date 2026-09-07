import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AnnouncementAudienceType } from '../../../prisma/generated/client';

export class QueryAnnouncementsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(AnnouncementAudienceType)
  audienceType?: AnnouncementAudienceType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeExpired?: boolean;

  @IsOptional()
  @IsIn(['visible', 'all'])
  view?: 'visible' | 'all';

  @IsOptional()
  @IsIn(['read', 'unread'])
  read?: 'read' | 'unread';
}
