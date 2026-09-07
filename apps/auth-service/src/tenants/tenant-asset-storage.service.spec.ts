import { InternalServerErrorException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import {
  CloudinaryTenantAssetStorageProvider,
  S3TenantAssetStorageProvider,
  TenantAssetStorageService,
} from './tenant-asset-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
    utils: {
      private_download_url: jest.fn(),
    },
  },
}));

const ENV_KEYS = [
  'AUTH_TENANT_ASSET_STORAGE_PROVIDER',
  'AUTH_TENANT_ASSET_S3_BUCKET',
  'AUTH_TENANT_ASSET_S3_REGION',
  'AUTH_TENANT_ASSET_S3_PREFIX',
  'AUTH_TENANT_ASSET_S3_ENDPOINT',
  'AUTH_TENANT_ASSET_S3_FORCE_PATH_STYLE',
  'AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS',
  'AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

function mockCloudinaryUpload(publicId: string): void {
  (
    cloudinary.uploader.upload_stream as unknown as jest.Mock<
      ReturnType<typeof cloudinary.uploader.upload_stream>,
      [UploadApiOptions, (error?: unknown, result?: UploadApiResponse) => void]
    >
  ).mockImplementation(
    (_options, callback) =>
      ({
        end: jest.fn(() => {
          callback?.(undefined, {
            public_id: publicId,
          } as UploadApiResponse);
        }),
      }) as unknown as ReturnType<typeof cloudinary.uploader.upload_stream>,
  );
}

describe('TenantAssetStorageService', () => {
  const originalEnv = new Map(
    ENV_KEYS.map((key) => [key, process.env[key]] as const),
  );

  afterEach(() => {
    jest.clearAllMocks();
    for (const [key, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uploads assets to a tenant-scoped private object key', async () => {
    const provider = new S3TenantAssetStorageProvider(
      {
        bucket: 'private-workphelo-assets',
        region: 'eu-west-1',
        prefix: 'tenant-assets',
        forcePathStyle: false,
      },
      () => 120,
    );
    const send = jest
      .fn<Promise<Record<string, never>>, [PutObjectCommand]>()
      .mockResolvedValue({});
    (
      provider as unknown as {
        client: { send: typeof send };
      }
    ).client = { send };

    const result = await provider.store(
      {
        tenantId: 'tenant-1',
        tenantSlug: 'acme-ghana',
        assetType: 'logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'company logo.png',
      },
      'document-profile',
    );

    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: expect.stringMatching(
        /^tenant-assets\/tenants\/tenant-1\/document-profile\/logo\/.+-company-logo\.png$/,
      ) as string,
      ContentType: 'image/png',
      Metadata: {
        tenantId: 'tenant-1',
        assetType: 'logo',
      },
    });
    expect(command.input).not.toHaveProperty('ACL');
    expect(result.objectKey).toContain(
      'tenant-assets/tenants/tenant-1/document-profile/logo/',
    );
    expect(result).not.toHaveProperty('url');
  });

  it('uploads branding assets to the branding namespace', async () => {
    const provider = new S3TenantAssetStorageProvider(
      {
        bucket: 'private-workphelo-assets',
        region: 'eu-west-1',
        prefix: 'tenant-assets',
        forcePathStyle: false,
      },
      () => 120,
    );
    const send = jest
      .fn<Promise<Record<string, never>>, [PutObjectCommand]>()
      .mockResolvedValue({});
    (
      provider as unknown as {
        client: { send: typeof send };
      }
    ).client = { send };

    const result = await provider.store(
      {
        tenantId: 'tenant-1',
        tenantSlug: 'acme-ghana',
        assetType: 'app-logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'company logo.png',
      },
      'branding',
    );

    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: expect.stringMatching(
        /^tenant-assets\/tenants\/tenant-1\/branding\/app-logo\/.+-company-logo\.png$/,
      ) as string,
      ContentType: 'image/png',
      Metadata: {
        tenantId: 'tenant-1',
        assetType: 'app-logo',
      },
    });
    expect(result.objectKey).toContain(
      'tenant-assets/tenants/tenant-1/branding/app-logo/',
    );
  });

  it('fails clearly when private storage is not configured', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 's3';
    delete process.env.AUTH_TENANT_ASSET_S3_BUCKET;
    delete process.env.AUTH_TENANT_ASSET_S3_REGION;

    await expect(
      new TenantAssetStorageService().store({
        tenantId: 'tenant-1',
        tenantSlug: 'acme-ghana',
        assetType: 'signature',
        body: Buffer.from('signature'),
        contentType: 'image/png',
        originalFileName: 'signature.png',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('creates a short-lived signed read URL for a stored asset', async () => {
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://storage.example/signed-logo');

    const now = jest.spyOn(Date, 'now').mockReturnValue(1_782_980_400_000);
    const provider = new S3TenantAssetStorageProvider(
      {
        bucket: 'private-workphelo-assets',
        region: 'eu-west-1',
        prefix: 'tenant-assets',
        forcePathStyle: false,
      },
      () => 180,
    );
    const client = { send: jest.fn() };
    (
      provider as unknown as {
        client: typeof client;
      }
    ).client = client;

    const result = await provider.createSignedReadUrl({
      objectKey: 'tenant-assets/tenants/tenant-1/logo.png',
      mimeType: 'image/png',
      fileName: 'company logo.png',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      client,
      expect.any(GetObjectCommand),
      { expiresIn: 180 },
    );
    const command = jest.mocked(getSignedUrl).mock
      .calls[0][1] as GetObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: 'tenant-assets/tenants/tenant-1/logo.png',
      ResponseContentType: 'image/png',
      ResponseContentDisposition: 'inline; filename="company-logo.png"',
    });
    expect(result).toEqual({
      readUrl: 'https://storage.example/signed-logo',
      expiresAt: '2026-07-02T08:23:00.000Z',
    });
    now.mockRestore();
  });

  it('selects the S3 provider for new uploads when configured', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 's3';
    process.env.AUTH_TENANT_ASSET_S3_BUCKET = 'private-workphelo-assets';
    process.env.AUTH_TENANT_ASSET_S3_REGION = 'eu-west-1';

    const service = new TenantAssetStorageService();
    const provider = {
      store: jest.fn().mockResolvedValue({
        objectKey:
          'tenant-assets/tenants/tenant-1/document-profile/logo/id.png',
        mimeType: 'image/png',
        fileName: 'logo.png',
        sizeBytes: 4,
      }),
      createSignedReadUrl: jest.fn(),
      delete: jest.fn(),
    };
    (
      service as unknown as {
        s3Provider: typeof provider;
      }
    ).s3Provider = provider;

    await service.store({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-ghana',
      assetType: 'logo',
      body: Buffer.from('logo'),
      contentType: 'image/png',
      originalFileName: 'logo.png',
    });

    expect(provider.store).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        assetType: 'logo',
      }),
      'document-profile',
    );
  });

  it('selects the Cloudinary provider for new uploads when configured', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'cloudinary';

    const service = new TenantAssetStorageService();
    const provider = {
      store: jest.fn().mockResolvedValue({
        objectKey:
          'cloudinary:image:authenticated:workphelo/tenant-assets/tenants/tenant-1/document-profile/logo/id',
        mimeType: 'image/png',
        fileName: 'logo.png',
        sizeBytes: 4,
      }),
      createSignedReadUrl: jest.fn(),
      delete: jest.fn(),
    };
    (
      service as unknown as {
        cloudinaryProvider: typeof provider;
      }
    ).cloudinaryProvider = provider;

    await service.store({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-ghana',
      assetType: 'logo',
      body: Buffer.from('logo'),
      contentType: 'image/png',
      originalFileName: 'logo.png',
    });

    expect(provider.store).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        assetType: 'logo',
      }),
      'document-profile',
    );
  });

  it('fails closed for an unknown tenant asset provider', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'filesystem';

    await expect(
      new TenantAssetStorageService().store({
        tenantId: 'tenant-1',
        tenantSlug: 'acme-ghana',
        assetType: 'logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'logo.png',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('treats historical untagged object keys as S3 after switching new uploads to Cloudinary', async () => {
    process.env.AUTH_TENANT_ASSET_STORAGE_PROVIDER = 'cloudinary';
    process.env.AUTH_TENANT_ASSET_S3_BUCKET = 'private-workphelo-assets';
    process.env.AUTH_TENANT_ASSET_S3_REGION = 'eu-west-1';
    jest.mocked(getSignedUrl).mockResolvedValue('https://s3.example/signed');

    const service = new TenantAssetStorageService();
    const provider = new S3TenantAssetStorageProvider(
      {
        bucket: 'private-workphelo-assets',
        region: 'eu-west-1',
        prefix: 'tenant-assets',
        forcePathStyle: false,
      },
      () => 120,
    );
    const client = { send: jest.fn() };
    (
      provider as unknown as {
        client: typeof client;
      }
    ).client = client;
    (
      service as unknown as {
        s3Provider: S3TenantAssetStorageProvider;
      }
    ).s3Provider = provider;

    await service.createSignedReadUrl({
      objectKey: 'tenant-assets/tenants/tenant-1/document-profile/logo/old.png',
      mimeType: 'image/png',
      fileName: 'old.png',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      client,
      expect.any(GetObjectCommand),
      expect.any(Object),
    );
    expect(cloudinary.utils.private_download_url).not.toHaveBeenCalled();
  });

  it('deletes legacy S3 assets with the S3 object key', async () => {
    const provider = new S3TenantAssetStorageProvider(
      {
        bucket: 'private-workphelo-assets',
        region: 'eu-west-1',
        prefix: 'tenant-assets',
        forcePathStyle: false,
      },
      () => 120,
    );
    const send = jest
      .fn<Promise<Record<string, never>>, [DeleteObjectCommand]>()
      .mockResolvedValue({});
    (
      provider as unknown as {
        client: { send: typeof send };
      }
    ).client = { send };

    await provider.delete(
      'tenant-assets/tenants/tenant-1/document-profile/logo/old.png',
    );

    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: 'private-workphelo-assets',
      Key: 'tenant-assets/tenants/tenant-1/document-profile/logo/old.png',
    });
  });

  it('uploads Cloudinary tenant images as authenticated assets under tenant-scoped folders', async () => {
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 120,
    );
    (
      cloudinary.uploader.upload_stream as unknown as jest.Mock<
        ReturnType<typeof cloudinary.uploader.upload_stream>,
        [
          UploadApiOptions,
          (error?: unknown, result?: UploadApiResponse) => void,
        ]
      >
    ).mockImplementation(
      (_options, callback) =>
        ({
          end: jest.fn(() => {
            callback?.(undefined, {
              public_id:
                'workphelo/tenant-assets/tenants/acme-ghana--tenant-1/document-profile/logo/generated-id',
            } as UploadApiResponse);
          }),
        }) as unknown as ReturnType<typeof cloudinary.uploader.upload_stream>,
    );

    const result = await provider.store(
      {
        tenantId: 'tenant-1',
        tenantSlug: 'acme-ghana',
        assetType: 'logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'company logo.png',
      },
      'document-profile',
    );

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'workphelo-cloud',
      api_key: 'api-key',
      api_secret: 'api-secret',
      secure: true,
    });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'image',
        type: 'authenticated',
        folder:
          'workphelo/tenant-assets/tenants/acme-ghana--tenant-1/document-profile/logo',
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        filename_override: 'company-logo.png',
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      objectKey:
        'cloudinary:image:authenticated:workphelo/tenant-assets/tenants/acme-ghana--tenant-1/document-profile/logo/generated-id',
      mimeType: 'image/png',
      fileName: 'company-logo.png',
      sizeBytes: 4,
    });
    expect(result.objectKey).toContain('/tenants/acme-ghana--tenant-1/');
    expect(result).not.toHaveProperty('url');
  });

  it('uses the readable Cloudinary tenant folder for signatures', async () => {
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 120,
    );
    mockCloudinaryUpload(
      'workphelo/tenant-assets/tenants/acme-ghana--bda1cb0d/document-profile/signature/generated-id',
    );

    await provider.store(
      {
        tenantId: 'bda1cb0d-ebf9-4683-b993-b6d350c8c6b2',
        tenantSlug: 'acme-ghana',
        assetType: 'signature',
        body: Buffer.from('signature'),
        contentType: 'image/png',
        originalFileName: 'signature.png',
      },
      'document-profile',
    );

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder:
          'workphelo/tenant-assets/tenants/acme-ghana--bda1cb0d/document-profile/signature',
      }),
      expect.any(Function),
    );
  });

  it('uses the same readable Cloudinary tenant folder convention for branding assets', async () => {
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 120,
    );
    mockCloudinaryUpload(
      'workphelo/tenant-assets/tenants/acme-ghana--bda1cb0d/branding/app-logo/generated-id',
    );

    await provider.store(
      {
        tenantId: 'bda1cb0d-ebf9-4683-b993-b6d350c8c6b2',
        tenantSlug: 'acme-ghana',
        assetType: 'app-logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'logo.png',
      },
      'branding',
    );

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder:
          'workphelo/tenant-assets/tenants/acme-ghana--bda1cb0d/branding/app-logo',
      }),
      expect.any(Function),
    );
  });

  it('keeps Cloudinary tenant folders unique for similar slugs by appending the short tenant ID', async () => {
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 120,
    );
    mockCloudinaryUpload(
      'workphelo/tenant-assets/tenants/acme-ghana--bda1cb0d/document-profile/logo/generated-id',
    );

    await provider.store(
      {
        tenantId: 'bda1cb0d-ebf9-4683-b993-b6d350c8c6b2',
        tenantSlug: 'acme-ghana',
        assetType: 'logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'logo.png',
      },
      'document-profile',
    );
    await provider.store(
      {
        tenantId: 'c41bce45-8959-4829-9fdf-d78a090709fd',
        tenantSlug: 'acme-ghana',
        assetType: 'logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'logo.png',
      },
      'document-profile',
    );

    expect(cloudinary.uploader.upload_stream).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        folder:
          'workphelo/tenant-assets/tenants/acme-ghana--bda1cb0d/document-profile/logo',
      }),
      expect.any(Function),
    );
    expect(cloudinary.uploader.upload_stream).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        folder:
          'workphelo/tenant-assets/tenants/acme-ghana--c41bce45/document-profile/logo',
      }),
      expect.any(Function),
    );
  });

  it('sanitizes unsafe tenant slugs before building Cloudinary folders', async () => {
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 120,
    );
    mockCloudinaryUpload(
      'workphelo/tenant-assets/tenants/acme-ghana-ltd--bda1cb0d/document-profile/logo/generated-id',
    );

    await provider.store(
      {
        tenantId: 'bda1cb0d-ebf9-4683-b993-b6d350c8c6b2',
        tenantSlug: '../Acme Ghana//Ltd..',
        assetType: 'logo',
        body: Buffer.from('logo'),
        contentType: 'image/png',
        originalFileName: 'logo.png',
      },
      'document-profile',
    );

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder:
          'workphelo/tenant-assets/tenants/acme-ghana-ltd--bda1cb0d/document-profile/logo',
      }),
      expect.any(Function),
    );
  });

  it('generates signed Cloudinary access URLs using the configured TTL', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_782_980_400_000);
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 180,
    );
    jest
      .mocked(cloudinary.utils.private_download_url)
      .mockReturnValue('https://res.cloudinary.com/signed-logo');

    const result = await provider.createSignedReadUrl({
      objectKey:
        'cloudinary:image:authenticated:workphelo/tenant-assets/tenants/tenant-1/document-profile/logo/generated-id',
      mimeType: 'image/png',
      fileName: 'company logo.png',
    });

    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      'workphelo/tenant-assets/tenants/tenant-1/document-profile/logo/generated-id',
      'png',
      {
        resource_type: 'image',
        type: 'authenticated',
        expires_at: 1782980580,
        attachment: false,
      },
    );
    expect(result).toEqual({
      readUrl: 'https://res.cloudinary.com/signed-logo',
      expiresAt: '2026-07-02T08:23:00.000Z',
    });
    expect(result.readUrl).not.toContain('api-secret');
    now.mockRestore();
  });

  it('deletes Cloudinary assets using their original public ID and delivery metadata', async () => {
    const provider = new CloudinaryTenantAssetStorageProvider(
      {
        cloudName: 'workphelo-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        rootFolder: 'workphelo',
        prefix: 'tenant-assets',
      },
      () => 120,
    );
    jest.mocked(cloudinary.uploader.destroy).mockResolvedValue({
      result: 'ok',
    });

    await provider.delete(
      'cloudinary:image:authenticated:workphelo/tenant-assets/tenants/tenant-1/branding/app-logo/generated-id',
    );

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'workphelo/tenant-assets/tenants/tenant-1/branding/app-logo/generated-id',
      {
        resource_type: 'image',
        type: 'authenticated',
        invalidate: true,
      },
    );
  });
});
