import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PublicTenantBrandingResponseDto,
  TenantBrandingAssetResponseDto,
  TenantBrandingResponseDto,
  TenantBrandingThemeMode,
  TenantBrandingUploadAssetType,
  UpdateTenantBrandingDto,
} from './dto/tenant-branding.dto';
import {
  TenantAssetStorageService,
  TenantBrandingAssetType,
} from './tenant-asset-storage.service';

const HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const FAVICON_MAX_BYTES = 512 * 1024;

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const FAVICON_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export const WORKPHELO_BRANDING_DEFAULTS = {
  appName: 'WorkPhelo',
  primaryColor: '#0D2244',
  secondaryColor: '#85B7EB',
  accentColor: '#1E3A8A',
  sidebarColor: '#0D2244',
  emailHeaderColor: '#0D2244',
  documentHeaderColor: '#0D2244',
  themeMode: 'LIGHT' as TenantBrandingThemeMode,
} as const;

const tenantBrandingInclude = {
  branding: true,
} as const;

type TenantWithBranding = {
  id: string;
  slug: string;
  name: string;
  branding?: TenantBrandingRecord | null;
};

type TenantBrandingRecord = {
  appName: string | null;
  appLogoObjectKey: string | null;
  appLogoMimeType: string | null;
  appLogoFileName: string | null;
  appLogoSizeBytes: number | null;
  sidebarLogoObjectKey: string | null;
  sidebarLogoMimeType: string | null;
  sidebarLogoFileName: string | null;
  sidebarLogoSizeBytes: number | null;
  loginLogoObjectKey: string | null;
  loginLogoMimeType: string | null;
  loginLogoFileName: string | null;
  loginLogoSizeBytes: number | null;
  logoObjectKey: string | null;
  logoDisplayUrl: string | null;
  faviconObjectKey: string | null;
  faviconDisplayUrl: string | null;
  faviconMimeType: string | null;
  faviconFileName: string | null;
  faviconSizeBytes: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  sidebarColor: string | null;
  emailHeaderColor: string | null;
  documentHeaderColor: string | null;
  themeMode: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type BrandingData = Record<string, string | number | null>;

type BrandingAssetFields = {
  objectKey: keyof TenantBrandingRecord;
  mimeType: keyof TenantBrandingRecord;
  fileName: keyof TenantBrandingRecord;
  sizeBytes: keyof TenantBrandingRecord;
};

const ASSET_FIELD_MAP: Record<
  TenantBrandingUploadAssetType,
  BrandingAssetFields
> = {
  'app-logo': {
    objectKey: 'appLogoObjectKey',
    mimeType: 'appLogoMimeType',
    fileName: 'appLogoFileName',
    sizeBytes: 'appLogoSizeBytes',
  },
  'sidebar-logo': {
    objectKey: 'sidebarLogoObjectKey',
    mimeType: 'sidebarLogoMimeType',
    fileName: 'sidebarLogoFileName',
    sizeBytes: 'sidebarLogoSizeBytes',
  },
  'login-logo': {
    objectKey: 'loginLogoObjectKey',
    mimeType: 'loginLogoMimeType',
    fileName: 'loginLogoFileName',
    sizeBytes: 'loginLogoSizeBytes',
  },
  favicon: {
    objectKey: 'faviconObjectKey',
    mimeType: 'faviconMimeType',
    fileName: 'faviconFileName',
    sizeBytes: 'faviconSizeBytes',
  },
};

@Injectable()
export class TenantBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TenantAssetStorageService,
    private readonly audit: AuditService,
  ) {}

  async findByTenantId(tenantId: string): Promise<TenantBrandingResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: tenantBrandingInclude,
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.toPrivateResponse(tenant as TenantWithBranding);
  }

  async findPublicBySlug(
    slug: string,
  ): Promise<PublicTenantBrandingResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: tenantBrandingInclude,
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.toPublicResponse(tenant as TenantWithBranding);
  }

  async update(
    tenantId: string,
    dto: UpdateTenantBrandingDto,
    actorUserId: string,
  ): Promise<TenantBrandingResponseDto> {
    this.validateBranding(dto);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: tenantBrandingInclude,
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const data = this.buildUpdateData(dto, tenant.branding ?? null);

    await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
        updatedByUserId: actorUserId,
      },
      update: {
        ...data,
        updatedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: tenant.branding ? 'UPDATE' : 'CREATE',
      resource: 'tenant-branding',
      resourceId: tenantId,
      changes: { after: { fields: Object.keys(data) } },
    });

    return this.findByTenantId(tenantId);
  }

  async uploadAsset(
    tenantId: string,
    actorUserId: string,
    assetType: TenantBrandingUploadAssetType,
    file: Express.Multer.File | undefined,
  ): Promise<TenantBrandingResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: tenantBrandingInclude,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    this.validateAsset(assetType, file);
    const uploadedFile = file as Express.Multer.File;
    const stored = await this.storage.storeBrandingAsset({
      tenantId,
      tenantSlug: tenant.slug,
      assetType: assetType as TenantBrandingAssetType,
      body: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
      originalFileName: uploadedFile.originalname,
    });

    const fields = ASSET_FIELD_MAP[assetType];
    // Asset replacement is pointer-based: old private objects stay inaccessible
    // and should be expired by bucket lifecycle/retention policy, preserving audit.
    const data: BrandingData = {
      [fields.objectKey]: stored.objectKey,
      [fields.mimeType]: stored.mimeType,
      [fields.fileName]: stored.fileName,
      [fields.sizeBytes]: stored.sizeBytes,
    };

    if (assetType === 'app-logo') {
      data.logoObjectKey = null;
      data.logoDisplayUrl = null;
    }
    if (assetType === 'favicon') {
      data.faviconDisplayUrl = null;
    }

    await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
        updatedByUserId: actorUserId,
      },
      update: {
        ...data,
        updatedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: tenant.branding ? 'UPDATE' : 'CREATE',
      resource: 'tenant-branding',
      resourceId: tenantId,
      changes: {
        after: {
          assetType,
          mimeType: stored.mimeType,
          fileName: stored.fileName,
          sizeBytes: stored.sizeBytes,
        },
      },
    });

    return this.findByTenantId(tenantId);
  }

  private validateBranding(dto: UpdateTenantBrandingDto): void {
    this.validateColors(dto);
    if (
      dto.themeMode != null &&
      !['LIGHT', 'DARK', 'SYSTEM'].includes(dto.themeMode)
    ) {
      throw new BadRequestException('themeMode must be LIGHT, DARK or SYSTEM');
    }
  }

  private validateColors(dto: UpdateTenantBrandingDto): void {
    const colorFields = [
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'sidebarColor',
      'emailHeaderColor',
      'documentHeaderColor',
    ] as const;

    for (const field of colorFields) {
      const value = dto[field];
      if (value == null) continue;
      if (!HEX_COLOR_PATTERN.test(value)) {
        throw new BadRequestException(
          `${field} must be a hex color value such as #0D2244`,
        );
      }
    }
  }

  private validateAsset(
    assetType: TenantBrandingUploadAssetType,
    file: Express.Multer.File | undefined,
  ): void {
    if (!ASSET_FIELD_MAP[assetType]) {
      throw new BadRequestException(
        'assetType must be app-logo, sidebar-logo, login-logo or favicon.',
      );
    }
    if (!file) {
      throw new BadRequestException('A branding asset file is required.');
    }
    const allowed =
      assetType === 'favicon' ? FAVICON_MIME_TYPES : IMAGE_MIME_TYPES;
    const maxBytes =
      assetType === 'favicon' ? FAVICON_MAX_BYTES : LOGO_MAX_BYTES;
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        assetType === 'favicon'
          ? 'Favicon must be PNG, JPEG, WEBP or ICO.'
          : 'Branding image must be PNG, JPEG or WEBP.',
      );
    }
    if (!file.buffer || file.buffer.byteLength === 0) {
      throw new BadRequestException('Branding asset file is empty.');
    }
    if (file.buffer.byteLength > maxBytes) {
      throw new BadRequestException(
        assetType === 'favicon'
          ? 'Favicon must be 512KB or smaller.'
          : 'Branding image must be 2MB or smaller.',
      );
    }
  }

  private buildUpdateData(
    dto: UpdateTenantBrandingDto,
    existing: TenantBrandingRecord | null,
  ): BrandingData {
    const data: BrandingData = {};
    this.assignIfProvided(data, dto, 'appName');
    this.assignIfProvided(data, dto, 'logoObjectKey');
    this.assignIfProvided(data, dto, 'faviconObjectKey');
    this.assignIfProvided(data, dto, 'primaryColor');
    this.assignIfProvided(data, dto, 'secondaryColor');
    this.assignIfProvided(data, dto, 'accentColor');
    this.assignIfProvided(data, dto, 'sidebarColor');
    this.assignIfProvided(data, dto, 'emailHeaderColor');
    this.assignIfProvided(data, dto, 'documentHeaderColor');
    this.assignIfProvided(data, dto, 'themeMode');

    const legacyLogoObjectKey =
      dto.logoObjectKey !== undefined
        ? dto.logoObjectKey
        : (existing?.logoObjectKey ?? null);
    const faviconObjectKey =
      dto.faviconObjectKey !== undefined
        ? dto.faviconObjectKey
        : (existing?.faviconObjectKey ?? null);

    if (legacyLogoObjectKey) {
      data.logoDisplayUrl = null;
    } else {
      this.assignIfProvided(data, dto, 'logoDisplayUrl');
    }

    if (faviconObjectKey) {
      data.faviconDisplayUrl = null;
    } else {
      this.assignIfProvided(data, dto, 'faviconDisplayUrl');
    }

    return data;
  }

  private assignIfProvided(
    target: BrandingData,
    source: UpdateTenantBrandingDto,
    key: keyof UpdateTenantBrandingDto,
  ): void {
    if (source[key] !== undefined) {
      target[key] = source[key] ?? null;
    }
  }

  private async toPrivateResponse(
    tenant: TenantWithBranding,
  ): Promise<TenantBrandingResponseDto> {
    const branding = tenant.branding ?? null;
    const appLogo = await this.assetResponse(
      branding,
      ASSET_FIELD_MAP['app-logo'],
    );
    const sidebarLogo = await this.assetResponse(
      branding,
      ASSET_FIELD_MAP['sidebar-logo'],
    );
    const loginLogo = await this.assetResponse(
      branding,
      ASSET_FIELD_MAP['login-logo'],
    );
    const favicon = await this.assetResponse(branding, ASSET_FIELD_MAP.favicon);

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      appName:
        this.nonEmptyString(branding?.appName) ??
        tenant.name ??
        WORKPHELO_BRANDING_DEFAULTS.appName,
      themeMode: this.themeMode(branding?.themeMode),
      appLogo,
      sidebarLogo,
      loginLogo,
      favicon,
      logoObjectKey: null,
      logoDisplayUrl:
        appLogo.readUrl ??
        (branding?.logoObjectKey ? null : (branding?.logoDisplayUrl ?? null)),
      faviconObjectKey: null,
      faviconDisplayUrl:
        favicon.readUrl ??
        (branding?.faviconObjectKey
          ? null
          : (branding?.faviconDisplayUrl ?? null)),
      primaryColor:
        branding?.primaryColor ?? WORKPHELO_BRANDING_DEFAULTS.primaryColor,
      secondaryColor:
        branding?.secondaryColor ?? WORKPHELO_BRANDING_DEFAULTS.secondaryColor,
      accentColor:
        branding?.accentColor ?? WORKPHELO_BRANDING_DEFAULTS.accentColor,
      sidebarColor:
        branding?.sidebarColor ?? WORKPHELO_BRANDING_DEFAULTS.sidebarColor,
      emailHeaderColor:
        branding?.emailHeaderColor ??
        WORKPHELO_BRANDING_DEFAULTS.emailHeaderColor,
      documentHeaderColor:
        branding?.documentHeaderColor ??
        WORKPHELO_BRANDING_DEFAULTS.documentHeaderColor,
      updatedByUserId: branding?.updatedByUserId ?? null,
      createdAt: branding?.createdAt ?? null,
      updatedAt: branding?.updatedAt ?? null,
      defaultsApplied: !branding,
    };
  }

  private async toPublicResponse(
    tenant: TenantWithBranding,
  ): Promise<PublicTenantBrandingResponseDto> {
    const response = await this.toPrivateResponse(tenant);
    return {
      tenantSlug: response.tenantSlug,
      tenantName: response.tenantName,
      appName: response.appName,
      themeMode: response.themeMode,
      appLogoUrl: response.appLogo.readUrl,
      sidebarLogoUrl: response.sidebarLogo.readUrl,
      loginLogoUrl: response.loginLogo.readUrl,
      faviconUrl: response.favicon.readUrl,
      logoDisplayUrl: response.logoDisplayUrl,
      faviconDisplayUrl: response.faviconDisplayUrl,
      primaryColor: response.primaryColor,
      secondaryColor: response.secondaryColor,
      accentColor: response.accentColor,
      sidebarColor: response.sidebarColor,
      emailHeaderColor: response.emailHeaderColor,
      documentHeaderColor: response.documentHeaderColor,
      defaultsApplied: response.defaultsApplied,
    };
  }

  private async assetResponse(
    branding: TenantBrandingRecord | null,
    fields: BrandingAssetFields,
  ): Promise<TenantBrandingAssetResponseDto> {
    const objectKey = this.fieldString(branding, fields.objectKey);
    const mimeType = this.fieldString(branding, fields.mimeType);
    const fileName = this.fieldString(branding, fields.fileName);
    const sizeBytes = this.fieldNumber(branding, fields.sizeBytes);
    if (!objectKey || !mimeType || !fileName || !sizeBytes) {
      return this.emptyAssetResponse();
    }

    const signed = await this.storage.createSignedReadUrl({
      objectKey,
      mimeType,
      fileName,
    });
    return {
      objectKey: null,
      mimeType,
      fileName,
      sizeBytes,
      readUrl: signed.readUrl,
      readUrlExpiresAt: signed.expiresAt,
    };
  }

  private emptyAssetResponse(): TenantBrandingAssetResponseDto {
    return {
      objectKey: null,
      mimeType: null,
      fileName: null,
      sizeBytes: null,
      readUrl: null,
      readUrlExpiresAt: null,
    };
  }

  private themeMode(value: string | null | undefined): TenantBrandingThemeMode {
    if (value === 'DARK' || value === 'SYSTEM') return value;
    return 'LIGHT';
  }

  private fieldString(
    branding: TenantBrandingRecord | null,
    key: keyof TenantBrandingRecord,
  ): string | null {
    const value = branding?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private fieldNumber(
    branding: TenantBrandingRecord | null,
    key: keyof TenantBrandingRecord,
  ): number | null {
    const value = branding?.[key];
    return typeof value === 'number' && value > 0 ? value : null;
  }

  private nonEmptyString(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
