import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

export type TenantDocumentAssetType = 'logo' | 'signature';
export type TenantBrandingAssetType =
  | 'app-logo'
  | 'sidebar-logo'
  | 'login-logo'
  | 'favicon';

export interface StoreTenantDocumentAssetInput {
  tenantId: string;
  tenantSlug: string;
  assetType: TenantDocumentAssetType;
  body: Buffer;
  contentType: string;
  originalFileName: string;
}

type StoreTenantBrandingAssetInput = Omit<
  StoreTenantDocumentAssetInput,
  'assetType'
> & {
  assetType: TenantBrandingAssetType;
};

export interface StoredTenantDocumentAsset {
  objectKey: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface SignedTenantDocumentAsset {
  readUrl: string;
  expiresAt: string;
}

type TenantAssetProviderName = 's3' | 'cloudinary';
type TenantAssetNamespace = 'document-profile' | 'branding';
type CloudinaryResourceType = 'image';
type CloudinaryDeliveryType = 'authenticated';

interface TenantAssetStorageProvider {
  store(
    input: StoreTenantDocumentAssetInput | StoreTenantBrandingAssetInput,
    namespace: TenantAssetNamespace,
  ): Promise<StoredTenantDocumentAsset>;
  createSignedReadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedTenantDocumentAsset>;
  delete(objectKey: string): Promise<void>;
}

export interface S3TenantAssetStorageConfig {
  bucket: string;
  region: string;
  prefix: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

export interface CloudinaryTenantAssetStorageConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  rootFolder: string;
  prefix: string;
}

type TenantAssetReference =
  | { provider: 's3'; objectKey: string }
  | {
      provider: 'cloudinary';
      publicId: string;
      resourceType: CloudinaryResourceType;
      deliveryType: CloudinaryDeliveryType;
    };

const CLOUDINARY_OBJECT_KEY_PREFIX = 'cloudinary';
const CLOUDINARY_RESOURCE_TYPE: CloudinaryResourceType = 'image';
const CLOUDINARY_DELIVERY_TYPE: CloudinaryDeliveryType = 'authenticated';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 120;
const MAX_SIGNED_URL_TTL_SECONDS = 900;

@Injectable()
export class TenantAssetStorageService {
  private s3Provider?: S3TenantAssetStorageProvider;
  private cloudinaryProvider?: CloudinaryTenantAssetStorageProvider;

  async store(
    input: StoreTenantDocumentAssetInput,
  ): Promise<StoredTenantDocumentAsset> {
    return this.activeProvider().store(input, 'document-profile');
  }

  async storeBrandingAsset(
    input: StoreTenantBrandingAssetInput,
  ): Promise<StoredTenantDocumentAsset> {
    return this.activeProvider().store(input, 'branding');
  }

  async createSignedReadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedTenantDocumentAsset> {
    return this.providerForObjectKey(input.objectKey).createSignedReadUrl(
      input,
    );
  }

  async delete(objectKey: string): Promise<void> {
    await this.providerForObjectKey(objectKey).delete(objectKey);
  }

  private activeProvider(): TenantAssetStorageProvider {
    const provider = this.providerName();
    return provider === 'cloudinary'
      ? this.cloudinary()
      : this.s3(this.s3Config());
  }

  private providerForObjectKey(objectKey: string): TenantAssetStorageProvider {
    const reference = this.parseReference(objectKey);
    return reference.provider === 'cloudinary'
      ? this.cloudinary()
      : this.s3(this.s3Config());
  }

  private s3(config: S3TenantAssetStorageConfig): S3TenantAssetStorageProvider {
    if (!this.s3Provider) {
      this.s3Provider = new S3TenantAssetStorageProvider(config, () =>
        this.signedUrlTtlSeconds(),
      );
    }
    return this.s3Provider;
  }

  private cloudinary(): CloudinaryTenantAssetStorageProvider {
    if (!this.cloudinaryProvider) {
      this.cloudinaryProvider = new CloudinaryTenantAssetStorageProvider(
        this.cloudinaryConfig(),
        () => this.signedUrlTtlSeconds(),
      );
    }
    return this.cloudinaryProvider;
  }

  private providerName(): TenantAssetProviderName {
    const provider = this.env('AUTH_TENANT_ASSET_STORAGE_PROVIDER', 's3')
      .trim()
      .toLowerCase();
    if (provider === 's3' || provider === 'cloudinary') return provider;
    throw new InternalServerErrorException(
      'Tenant asset storage provider must be one of: s3, cloudinary',
    );
  }

  private s3Config(): S3TenantAssetStorageConfig {
    const bucket = this.env('AUTH_TENANT_ASSET_S3_BUCKET');
    const region = this.env('AUTH_TENANT_ASSET_S3_REGION');
    if (!bucket || !region) {
      throw new InternalServerErrorException(
        'Tenant asset S3 bucket/region configuration is missing',
      );
    }

    return {
      bucket,
      region,
      prefix: this.env('AUTH_TENANT_ASSET_S3_PREFIX', 'tenant-assets'),
      endpoint: this.env('AUTH_TENANT_ASSET_S3_ENDPOINT'),
      forcePathStyle:
        this.env('AUTH_TENANT_ASSET_S3_FORCE_PATH_STYLE', 'false')
          .trim()
          .toLowerCase() === 'true',
    };
  }

  private cloudinaryConfig(): CloudinaryTenantAssetStorageConfig {
    const cloudName = this.env('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.env('CLOUDINARY_API_KEY');
    const apiSecret = this.env('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Tenant asset Cloudinary cloud name/API key/API secret configuration is missing',
      );
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
      rootFolder: this.env('AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER', ''),
      prefix: this.env('AUTH_TENANT_ASSET_S3_PREFIX', 'tenant-assets'),
    };
  }

  private parseReference(objectKey: string): TenantAssetReference {
    const parts = objectKey.split(':');
    if (
      parts.length >= 4 &&
      parts[0] === CLOUDINARY_OBJECT_KEY_PREFIX &&
      parts[1] === CLOUDINARY_RESOURCE_TYPE &&
      parts[2] === CLOUDINARY_DELIVERY_TYPE
    ) {
      return {
        provider: 'cloudinary',
        resourceType: CLOUDINARY_RESOURCE_TYPE,
        deliveryType: CLOUDINARY_DELIVERY_TYPE,
        publicId: parts.slice(3).join(':'),
      };
    }

    return { provider: 's3', objectKey };
  }

  private signedUrlTtlSeconds(): number {
    const parsed = Number(
      this.env(
        'AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS',
        String(DEFAULT_SIGNED_URL_TTL_SECONDS),
      ),
    );
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return DEFAULT_SIGNED_URL_TTL_SECONDS;
    }
    return Math.min(parsed, MAX_SIGNED_URL_TTL_SECONDS);
  }

  private env(name: string, fallback = ''): string {
    return process.env[name]?.trim() || fallback;
  }
}

export class S3TenantAssetStorageProvider implements TenantAssetStorageProvider {
  private client?: S3Client;

  constructor(
    private readonly config: S3TenantAssetStorageConfig,
    private readonly signedUrlTtlSeconds: () => number,
  ) {}

  async store(
    input: StoreTenantDocumentAssetInput | StoreTenantBrandingAssetInput,
    namespace: TenantAssetNamespace,
  ): Promise<StoredTenantDocumentAsset> {
    const fileName = this.safeFileName(input.originalFileName);
    const objectKey = [
      this.cleanPrefix(this.config.prefix),
      'tenants',
      input.tenantId,
      namespace,
      input.assetType,
      `${randomUUID()}-${fileName}`,
    ]
      .filter(Boolean)
      .join('/');

    await this.s3().send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          tenantId: input.tenantId,
          assetType: input.assetType,
        },
      }),
    );

    return {
      objectKey,
      mimeType: input.contentType,
      fileName,
      sizeBytes: input.body.byteLength,
    };
  }

  async createSignedReadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedTenantDocumentAsset> {
    const expiresIn = this.signedUrlTtlSeconds();
    const readUrl = await getSignedUrl(
      this.s3(),
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        ResponseContentType: input.mimeType,
        ResponseContentDisposition: `inline; filename="${this.safeFileName(input.fileName)}"`,
      }),
      { expiresIn },
    );

    return {
      readUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async delete(objectKey: string): Promise<void> {
    await this.s3().send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    );
  }

  private s3(): S3Client {
    if (!this.client) {
      const clientConfig: S3ClientConfig = {
        region: this.config.region,
        forcePathStyle: this.config.forcePathStyle,
        ...(this.config.endpoint ? { endpoint: this.config.endpoint } : {}),
      };
      this.client = new S3Client(clientConfig);
    }
    return this.client;
  }

  private safeFileName(fileName: string): string {
    const cleaned = fileName
      .trim()
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 160);
    return cleaned || 'asset';
  }

  private cleanPrefix(prefix: string): string {
    return prefix.trim().replace(/^\/+|\/+$/g, '');
  }
}

export class CloudinaryTenantAssetStorageProvider implements TenantAssetStorageProvider {
  constructor(
    private readonly config: CloudinaryTenantAssetStorageConfig,
    private readonly signedUrlTtlSeconds: () => number,
  ) {}

  async store(
    input: StoreTenantDocumentAssetInput | StoreTenantBrandingAssetInput,
    namespace: TenantAssetNamespace,
  ): Promise<StoredTenantDocumentAsset> {
    this.configure();
    const fileName = this.safeFileName(input.originalFileName);
    const upload = await this.uploadBuffer(input.body, {
      resource_type: CLOUDINARY_RESOURCE_TYPE,
      type: CLOUDINARY_DELIVERY_TYPE,
      folder: this.folderFor(
        input.tenantId,
        input.tenantSlug,
        namespace,
        input.assetType,
      ),
      public_id: randomUUID(),
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      filename_override: fileName,
    });

    if (!upload.public_id) {
      throw new InternalServerErrorException(
        'Cloudinary did not return a tenant asset public ID',
      );
    }

    return {
      objectKey: this.toCloudinaryObjectKey(upload.public_id),
      mimeType: input.contentType,
      fileName,
      sizeBytes: input.body.byteLength,
    };
  }

  async createSignedReadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedTenantDocumentAsset> {
    this.configure();
    const reference = this.parseCloudinaryObjectKey(input.objectKey);
    const expiresIn = this.signedUrlTtlSeconds();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const format = this.formatFor(input.mimeType, input.fileName);
    const readUrl = cloudinary.utils.private_download_url(
      reference.publicId,
      format,
      {
        resource_type: reference.resourceType,
        type: reference.deliveryType,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        attachment: false,
      },
    );

    return {
      readUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async delete(objectKey: string): Promise<void> {
    this.configure();
    const reference = this.parseCloudinaryObjectKey(objectKey);
    await cloudinary.uploader.destroy(reference.publicId, {
      resource_type: reference.resourceType,
      type: reference.deliveryType,
      invalidate: true,
    });
  }

  private uploadBuffer(
    body: Buffer,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(this.toUploadError(error));
            return;
          }
          if (!result) {
            reject(
              new InternalServerErrorException(
                'Cloudinary tenant asset upload returned no result',
              ),
            );
            return;
          }
          resolve(result);
        },
      );
      stream.end(body);
    });
  }

  private toUploadError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error('Cloudinary tenant asset upload failed');
  }

  private configure(): void {
    cloudinary.config({
      cloud_name: this.config.cloudName,
      api_key: this.config.apiKey,
      api_secret: this.config.apiSecret,
      secure: true,
    });
  }

  private folderFor(
    tenantId: string,
    tenantSlug: string,
    namespace: TenantAssetNamespace,
    assetType: TenantDocumentAssetType | TenantBrandingAssetType,
  ): string {
    return [
      this.cleanPrefix(this.config.rootFolder),
      this.cleanPrefix(this.config.prefix),
      'tenants',
      this.tenantFolderSegment(tenantId, tenantSlug),
      namespace,
      assetType,
    ]
      .filter(Boolean)
      .join('/');
  }

  private tenantFolderSegment(tenantId: string, tenantSlug: string): string {
    const sanitizedSlug =
      tenantSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'tenant';
    const shortId = tenantId.trim().slice(0, 8) || 'unknown';
    return `${sanitizedSlug}--${shortId}`;
  }

  private toCloudinaryObjectKey(publicId: string): string {
    return [
      CLOUDINARY_OBJECT_KEY_PREFIX,
      CLOUDINARY_RESOURCE_TYPE,
      CLOUDINARY_DELIVERY_TYPE,
      publicId,
    ].join(':');
  }

  private parseCloudinaryObjectKey(
    objectKey: string,
  ): Extract<TenantAssetReference, { provider: 'cloudinary' }> {
    const parts = objectKey.split(':');
    if (
      parts.length < 4 ||
      parts[0] !== CLOUDINARY_OBJECT_KEY_PREFIX ||
      parts[1] !== CLOUDINARY_RESOURCE_TYPE ||
      parts[2] !== CLOUDINARY_DELIVERY_TYPE
    ) {
      throw new InternalServerErrorException(
        'Cloudinary tenant asset reference is invalid',
      );
    }

    return {
      provider: 'cloudinary',
      resourceType: CLOUDINARY_RESOURCE_TYPE,
      deliveryType: CLOUDINARY_DELIVERY_TYPE,
      publicId: parts.slice(3).join(':'),
    };
  }

  private formatFor(mimeType: string, fileName: string): string {
    const extension = fileName.split('.').pop()?.trim().toLowerCase();
    if (extension && /^[a-z0-9]+$/.test(extension)) {
      return extension === 'jpeg' ? 'jpg' : extension;
    }
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    if (
      mimeType === 'image/x-icon' ||
      mimeType === 'image/vnd.microsoft.icon'
    ) {
      return 'ico';
    }
    return 'bin';
  }

  private safeFileName(fileName: string): string {
    const cleaned = fileName
      .trim()
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 160);
    return cleaned || 'asset';
  }

  private cleanPrefix(prefix: string): string {
    return prefix.trim().replace(/^\/+|\/+$/g, '');
  }
}
