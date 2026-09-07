import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePublicHolidayDto {
  @ApiProperty({
    description: 'Public holiday name',
    example: 'Independence Day',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Official public holiday date',
    example: '2026-03-06',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description:
      'Optional country scope. Leave empty to make the holiday tenant-wide.',
    example: 'Ghana',
  })
  @IsOptional()
  @IsString()
  countryScope?: string;

  @ApiPropertyOptional({
    description:
      'Optional region scope. Used together with country scope for location-aware leave validation.',
    example: 'Greater Accra',
  })
  @IsOptional()
  @IsString()
  regionScope?: string;
}
