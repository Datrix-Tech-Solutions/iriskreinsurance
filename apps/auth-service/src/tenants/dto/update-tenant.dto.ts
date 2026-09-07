import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Ghana Ltd' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: '100-500',
    enum: ['1-10', '10-50', '50-100', '100-500', '500+'],
  })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'Manufacturing' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'GH' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '+233244000001' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '12 Independence Avenue, Accra' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}
