import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

export interface StorePdfInput {
  tenantId: string;
  placementId: string;
  documentId: string;
  version: number;
  documentNumber: string;
  body: Buffer;
  checksum: string;
  contentType: string;
}

export interface StoredPdfResult {
  storageProvider: 'S3' | 'CLOUDINARY';
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StoreAttachmentInput {
  tenantId: string;
  placementId: string;
  attachmentId: string;
  parentType: string;
  body: Buffer;
  checksum: string;
  contentType: string;
  originalFileName: string;
}

export interface StoredAttachmentResult {
  storageProvider: 'S3' | 'CLOUDINARY';
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SignedDocumentUrlResult {
  url: string;
  expiresAt: Date;
  mimeType: string;
  fileName: string;
}

export interface StoredObjectResult {
  body: Buffer;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

type DocumentStorageProviderName = 's3' | 'cloudinary';

type CloudinaryResourceType = 'raw';
type CloudinaryDeliveryType = 'authenticated';

interface S3DocumentStorageConfig {
  bucket: string;
  region: string;
  prefix: string;
  endpoint?: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
}

interface CloudinaryDocumentStorageConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  rootFolder: string;
  signedUrlTtlSeconds: number;
}

type DocumentStorageReference =
  | { provider: 's3'; objectKey: string }
  | {
      provider: 'cloudinary';
      publicId: string;
      resourceType: CloudinaryResourceType;
      deliveryType: CloudinaryDeliveryType;
    };

const CLOUDINARY_OBJECT_KEY_PREFIX = 'cloudinary';
const CLOUDINARY_RESOURCE_TYPE: CloudinaryResourceType = 'raw';
const CLOUDINARY_DELIVERY_TYPE: CloudinaryDeliveryType = 'authenticated';

@Injectable()
export class S3DocumentStorageService {
  private client?: S3Client;

  async storePdf(input: StorePdfInput): Promise<StoredPdfResult> {
    if (this.providerName() === 'cloudinary') {
      return this.storePdfInCloudinary(input);
    }
    return this.storePdfInS3(input);
  }

  async storeAttachment(
    input: StoreAttachmentInput,
  ): Promise<StoredAttachmentResult> {
    if (this.providerName() === 'cloudinary') {
      return this.storeAttachmentInCloudinary(input);
    }
    return this.storeAttachmentInS3(input);
  }

  async signedDownloadUrl(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<SignedDocumentUrlResult> {
    const reference = this.parseReference(input.objectKey);

    if (reference.provider === 'cloudinary') {
      return this.cloudinarySignedDownloadUrl(reference, input);
    }

    return this.s3SignedDownloadUrl(reference.objectKey, input);
  }

  async readStoredObject(input: {
    objectKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<StoredObjectResult> {
    const reference = this.parseReference(input.objectKey);

    if (reference.provider === 'cloudinary') {
      return this.readCloudinaryObject(reference, input);
    }

    return this.readS3Object(reference.objectKey, input);
  }

  private async storePdfInS3(input: StorePdfInput): Promise<StoredPdfResult> {
    const config = this.s3Config();
    const objectKey = this.objectKey(config.prefix, input);
    const fileName = `${input.documentNumber}.pdf`;

    await this.s3(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          checksum: input.checksum,
          tenantId: input.tenantId,
          placementId: input.placementId,
          documentId: input.documentId,
        },
      }),
    );

    return {
      storageProvider: 'S3',
      objectKey,
      fileName,
      mimeType: input.contentType,
      sizeBytes: input.body.byteLength,
    };
  }

  private async storeAttachmentInS3(
    input: StoreAttachmentInput,
  ): Promise<StoredAttachmentResult> {
    const config = this.s3Config();
    const fileName = this.safeFileName(input.originalFileName);
    const objectKey = this.attachmentObjectKey(config.prefix, input, fileName);

    await this.s3(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          checksum: input.checksum,
          tenantId: input.tenantId,
          placementId: input.placementId,
          attachmentId: input.attachmentId,
          parentType: input.parentType,
        },
      }),
    );

    return {
      storageProvider: 'S3',
      objectKey,
      fileName,
      mimeType: input.contentType,
      sizeBytes: input.body.byteLength,
    };
  }

  private async storePdfInCloudinary(
    input: StorePdfInput,
  ): Promise<StoredPdfResult> {
    const fileName = `${input.documentNumber}.pdf`;
    const upload = await this.uploadCloudinaryBuffer(input.body, {
      resource_type: CLOUDINARY_RESOURCE_TYPE,
      type: CLOUDINARY_DELIVERY_TYPE,
      folder: this.cloudinaryFolder(
        input.tenantId,
        input.placementId,
        'documents',
        input.documentId,
      ),
      public_id: randomUUID(),
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      filename_override: fileName,
      context: {
        checksum: input.checksum,
        tenantId: input.tenantId,
        placementId: input.placementId,
        documentId: input.documentId,
      },
    });

    if (!upload.public_id) {
      throw new InternalServerErrorException(
        'Cloudinary did not return a Reinsurance document public ID',
      );
    }

    return {
      storageProvider: 'CLOUDINARY',
      objectKey: this.toCloudinaryObjectKey(upload.public_id),
      fileName,
      mimeType: input.contentType,
      sizeBytes: input.body.byteLength,
    };
  }

  private async storeAttachmentInCloudinary(
    input: StoreAttachmentInput,
  ): Promise<StoredAttachmentResult> {
    const fileName = this.safeFileName(input.originalFileName);
    const upload = await this.uploadCloudinaryBuffer(input.body, {
      resource_type: CLOUDINARY_RESOURCE_TYPE,
      type: CLOUDINARY_DELIVERY_TYPE,
      folder: this.cloudinaryFolder(
        input.tenantId,
        input.placementId,
        'attachments',
        input.parentType.toLowerCase(),
        input.attachmentId,
      ),
      public_id: randomUUID(),
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      filename_override: fileName,
      context: {
        checksum: input.checksum,
        tenantId: input.tenantId,
        placementId: input.placementId,
        attachmentId: input.attachmentId,
        parentType: input.parentType,
      },
    });

    if (!upload.public_id) {
      throw new InternalServerErrorException(
        'Cloudinary did not return a Reinsurance attachment public ID',
      );
    }

    return {
      storageProvider: 'CLOUDINARY',
      objectKey: this.toCloudinaryObjectKey(upload.public_id),
      fileName,
      mimeType: input.contentType,
      sizeBytes: input.body.byteLength,
    };
  }

  private async s3SignedDownloadUrl(
    objectKey: string,
    input: {
      mimeType: string;
      fileName: string;
    },
  ): Promise<SignedDocumentUrlResult> {
    const config = this.s3Config();
    const expiresAt = new Date(Date.now() + config.signedUrlTtlSeconds * 1000);
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ResponseContentType: input.mimeType,
      ResponseContentDisposition: `inline; filename="${input.fileName}"`,
    });

    const url = await getSignedUrl(this.s3(config), command, {
      expiresIn: config.signedUrlTtlSeconds,
    });

    return {
      url,
      expiresAt,
      mimeType: input.mimeType,
      fileName: input.fileName,
    };
  }

  private cloudinarySignedDownloadUrl(
    reference: Extract<DocumentStorageReference, { provider: 'cloudinary' }>,
    input: {
      mimeType: string;
      fileName: string;
    },
  ): SignedDocumentUrlResult {
    const config = this.cloudinaryConfig();
    this.configureCloudinary(config);

    const expiresAt = new Date(Date.now() + config.signedUrlTtlSeconds * 1000);

    const url = cloudinary.utils.private_download_url(
      reference.publicId,
      this.formatFor(input.mimeType, input.fileName),
      {
        resource_type: reference.resourceType,
        type: reference.deliveryType,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        attachment: false,
      },
    );

    return {
      url,
      expiresAt,
      mimeType: input.mimeType,
      fileName: input.fileName,
    };
  }

  private async readS3Object(
    objectKey: string,
    input: {
      mimeType: string;
      fileName: string;
    },
  ): Promise<StoredObjectResult> {
    const config = this.s3Config();
    const response = await this.s3(config).send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ResponseContentType: input.mimeType,
        ResponseContentDisposition: `inline; filename="${input.fileName}"`,
      }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (!bytes?.byteLength) {
      throw new InternalServerErrorException('Stored object body was empty');
    }

    const body = Buffer.from(bytes);

    return {
      body,
      mimeType: input.mimeType,
      fileName: input.fileName,
      sizeBytes: body.byteLength,
    };
  }

  private async readCloudinaryObject(
    reference: Extract<DocumentStorageReference, { provider: 'cloudinary' }>,
    input: {
      mimeType: string;
      fileName: string;
    },
  ): Promise<StoredObjectResult> {
    const signed = this.cloudinarySignedDownloadUrl(reference, input);

    const response = await fetch(signed.url);
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Cloudinary stored object download failed with status ${response.status}`,
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.byteLength) {
      throw new InternalServerErrorException('Stored object body was empty');
    }

    return {
      body: bytes,
      mimeType: input.mimeType,
      fileName: input.fileName,
      sizeBytes: bytes.byteLength,
    };
  }

  private uploadCloudinaryBuffer(
    body: Buffer,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    const config = this.cloudinaryConfig();
    this.configureCloudinary(config);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(this.toCloudinaryUploadError(error));
            return;
          }

          if (!result) {
            reject(
              new InternalServerErrorException(
                'Cloudinary Reinsurance upload returned no result',
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

  private providerName(): DocumentStorageProviderName {
    const provider = this.env('REINSURANCE_DOCUMENT_STORAGE_PROVIDER', 's3')
      .trim()
      .toLowerCase();

    if (provider === 's3' || provider === 'cloudinary') {
      return provider;
    }

    throw new InternalServerErrorException(
      'Reinsurance document storage provider must be one of: s3, cloudinary',
    );
  }

  private parseReference(objectKey: string): DocumentStorageReference {
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

    return {
      provider: 's3',
      objectKey,
    };
  }

  private toCloudinaryObjectKey(publicId: string): string {
    return [
      CLOUDINARY_OBJECT_KEY_PREFIX,
      CLOUDINARY_RESOURCE_TYPE,
      CLOUDINARY_DELIVERY_TYPE,
      publicId,
    ].join(':');
  }

  private s3(config: S3DocumentStorageConfig): S3Client {
    if (!this.client) {
      const clientConfig: S3ClientConfig = {
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      };

      this.client = new S3Client(clientConfig);
    }

    return this.client;
  }

  private s3Config(): S3DocumentStorageConfig {
    const bucket = this.env('REINSURANCE_DOCUMENT_S3_BUCKET');
    const region = this.env('REINSURANCE_DOCUMENT_S3_REGION');

    if (!bucket || !region) {
      throw new InternalServerErrorException(
        'Reinsurance document S3 bucket/region configuration is missing',
      );
    }

    return {
      bucket,
      region,
      prefix: this.env('REINSURANCE_DOCUMENT_S3_PREFIX', 'reinsurance'),
      endpoint: this.env('REINSURANCE_DOCUMENT_S3_ENDPOINT'),
      forcePathStyle:
        this.env('REINSURANCE_DOCUMENT_S3_FORCE_PATH_STYLE', 'false')
          .toLowerCase()
          .trim() === 'true',
      signedUrlTtlSeconds: this.positiveInt(
        this.env('REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS', '300'),
        300,
      ),
    };
  }

  private cloudinaryConfig(): CloudinaryDocumentStorageConfig {
    const cloudName = this.env('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.env('CLOUDINARY_API_KEY');
    const apiSecret = this.env('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Reinsurance Cloudinary cloud name/API key/API secret configuration is missing',
      );
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
      rootFolder: this.env(
        'REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER',
        'workphelo/reinsurance',
      ),
      signedUrlTtlSeconds: this.positiveInt(
        this.env('REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS', '300'),
        300,
      ),
    };
  }

  private configureCloudinary(config: CloudinaryDocumentStorageConfig): void {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  private cloudinaryFolder(
    tenantId: string,
    placementId: string,
    ...segments: string[]
  ): string {
    return [
      this.cleanPrefix(
        this.env(
          'REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER',
          'workphelo/reinsurance',
        ),
      ),
      'tenants',
      this.safePathSegment(tenantId),
      'placements',
      this.safePathSegment(placementId),
      ...segments.map((segment) => this.safePathSegment(segment)),
    ]
      .filter(Boolean)
      .join('/');
  }

  private objectKey(prefix: string, input: StorePdfInput): string {
    return [
      this.cleanPrefix(prefix),
      'tenants',
      input.tenantId,
      'placements',
      input.placementId,
      'documents',
      input.documentId,
      `v${input.version}`,
      `${input.documentNumber}.pdf`,
    ]
      .filter(Boolean)
      .join('/');
  }

  private attachmentObjectKey(
    prefix: string,
    input: StoreAttachmentInput,
    fileName: string,
  ): string {
    return [
      this.cleanPrefix(prefix),
      'tenants',
      input.tenantId,
      'placements',
      input.placementId,
      'attachments',
      input.parentType.toLowerCase(),
      input.attachmentId,
      fileName,
    ]
      .filter(Boolean)
      .join('/');
  }

  private formatFor(mimeType: string, fileName: string): string {
    const extension = fileName.split('.').pop()?.trim().toLowerCase();

    if (extension && /^[a-z0-9]+$/.test(extension)) {
      return extension === 'jpeg' ? 'jpg' : extension;
    }

    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'text/plain') return 'txt';
    if (mimeType === 'text/csv') return 'csv';

    return 'bin';
  }

  private safeFileName(fileName: string): string {
    const cleaned = fileName
      .trim()
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 180);

    return cleaned || 'attachment';
  }

  private safePathSegment(value: string): string {
    const cleaned = value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return cleaned || 'unknown';
  }

  private cleanPrefix(prefix: string): string {
    return prefix.trim().replace(/^\/+|\/+$/g, '');
  }

  private positiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private toCloudinaryUploadError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error('Cloudinary Reinsurance upload failed');
  }

  private env(key: string, fallback = ''): string {
    return process.env[key]?.trim() ?? fallback;
  }
}
