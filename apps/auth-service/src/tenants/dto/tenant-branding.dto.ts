import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const HEX_COLOR_MESSAGE = 'Color must be a hex value such as #0D2244 or #fff';

export const TENANT_BRANDING_THEME_MODES = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export type TenantBrandingThemeMode =
  (typeof TENANT_BRANDING_THEME_MODES)[number];

export const TENANT_BRANDING_ASSET_TYPES = [
  'app-logo',
  'sidebar-logo',
  'login-logo',
  'favicon',
] as const;
export type TenantBrandingUploadAssetType =
  (typeof TENANT_BRANDING_ASSET_TYPES)[number];

export class UpdateTenantBrandingDto {
  @ApiPropertyOptional({
    description: 'Tenant-facing application name shown in the WorkPhelo UI.',
    example: 'Acme Portal',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  appName?: string | null;

  @ApiPropertyOptional({
    description:
      'Private object-storage key for the tenant logo. This is the future S3 source of truth.',
    example: 'tenant-branding/tenant-123/logo/v1/logo.png',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  logoObjectKey?: string | null;

  @ApiPropertyOptional({
    description:
      'Temporary display URL only for current non-S3 assets. Ignored as source of truth when logoObjectKey is present.',
    example: 'https://cdn.example.com/tenant-logo.png',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoDisplayUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Private object-storage key for the tenant favicon.',
    example: 'tenant-branding/tenant-123/favicon/v1/favicon.ico',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  faviconObjectKey?: string | null;

  @ApiPropertyOptional({
    description:
      'Temporary display URL only for current non-S3 favicon assets. Ignored as source of truth when faviconObjectKey is present.',
    example: 'https://cdn.example.com/favicon.ico',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  faviconDisplayUrl?: string | null;

  @ApiPropertyOptional({ example: '#0D2244', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  primaryColor?: string | null;

  @ApiPropertyOptional({ example: '#85B7EB', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  secondaryColor?: string | null;

  @ApiPropertyOptional({ example: '#1E3A8A', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  accentColor?: string | null;

  @ApiPropertyOptional({ example: '#0D2244', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  sidebarColor?: string | null;

  @ApiPropertyOptional({ example: '#0D2244', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  emailHeaderColor?: string | null;

  @ApiPropertyOptional({ example: '#0D2244', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  documentHeaderColor?: string | null;

  @ApiPropertyOptional({
    enum: TENANT_BRANDING_THEME_MODES,
    example: 'LIGHT',
    nullable: true,
  })
  @IsOptional()
  @IsIn(TENANT_BRANDING_THEME_MODES)
  themeMode?: TenantBrandingThemeMode | null;
}

export class TenantBrandingAssetResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Always null in API responses. Private object keys are stored server-side only.',
  })
  objectKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sizeBytes!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Short-lived signed read URL for authenticated admin responses or safe public bootstrap responses.',
  })
  readUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  readUrlExpiresAt!: string | null;
}

export class TenantBrandingResponseDto {
  @ApiProperty({ example: 'tenant-uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'acme-ghana' })
  tenantSlug!: string;

  @ApiProperty({ example: 'Acme Ghana Ltd' })
  tenantName!: string;

  @ApiProperty({ example: 'Acme Portal' })
  appName!: string;

  @ApiProperty({ enum: TENANT_BRANDING_THEME_MODES, example: 'LIGHT' })
  themeMode!: TenantBrandingThemeMode;

  @ApiProperty({ type: TenantBrandingAssetResponseDto })
  appLogo!: TenantBrandingAssetResponseDto;

  @ApiProperty({ type: TenantBrandingAssetResponseDto })
  sidebarLogo!: TenantBrandingAssetResponseDto;

  @ApiProperty({ type: TenantBrandingAssetResponseDto })
  loginLogo!: TenantBrandingAssetResponseDto;

  @ApiProperty({ type: TenantBrandingAssetResponseDto })
  favicon!: TenantBrandingAssetResponseDto;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Legacy compatibility field. Private object keys are not exposed in responses.',
  })
  logoObjectKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoDisplayUrl!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Legacy compatibility field. Private object keys are not exposed in responses.',
  })
  faviconObjectKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  faviconDisplayUrl!: string | null;

  @ApiProperty({ example: '#0D2244' })
  primaryColor!: string;

  @ApiProperty({ example: '#85B7EB' })
  secondaryColor!: string;

  @ApiProperty({ example: '#1E3A8A' })
  accentColor!: string;

  @ApiProperty({ example: '#0D2244' })
  sidebarColor!: string;

  @ApiProperty({ example: '#0D2244' })
  emailHeaderColor!: string;

  @ApiProperty({ example: '#0D2244' })
  documentHeaderColor!: string;

  @ApiPropertyOptional({ nullable: true })
  updatedByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({
    description:
      'True when WorkPhelo defaults are being returned because no tenant branding row exists.',
    example: true,
  })
  defaultsApplied!: boolean;
}

export class PublicTenantBrandingResponseDto {
  @ApiProperty({ example: 'acme-ghana' })
  tenantSlug!: string;

  @ApiProperty({ example: 'Acme Ghana Ltd' })
  tenantName!: string;

  @ApiProperty({ example: 'Acme Portal' })
  appName!: string;

  @ApiProperty({ enum: TENANT_BRANDING_THEME_MODES, example: 'LIGHT' })
  themeMode!: TenantBrandingThemeMode;

  @ApiPropertyOptional({ nullable: true })
  appLogoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sidebarLogoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  loginLogoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  faviconUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoDisplayUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  faviconDisplayUrl!: string | null;

  @ApiProperty({ example: '#0D2244' })
  primaryColor!: string;

  @ApiProperty({ example: '#85B7EB' })
  secondaryColor!: string;

  @ApiProperty({ example: '#1E3A8A' })
  accentColor!: string;

  @ApiProperty({ example: '#0D2244' })
  sidebarColor!: string;

  @ApiProperty({ example: '#0D2244' })
  emailHeaderColor!: string;

  @ApiProperty({ example: '#0D2244' })
  documentHeaderColor!: string;

  @ApiProperty({ example: false })
  defaultsApplied!: boolean;
}
