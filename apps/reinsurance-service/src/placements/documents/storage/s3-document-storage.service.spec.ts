import { InternalServerErrorException } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import { S3DocumentStorageService } from './s3-document-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
    utils: {
      private_download_url: jest.fn(),
    },
  },
}));

describe('S3DocumentStorageService', () => {
  const originalEnv = process.env;
  let sendMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-12T10:00:00.000Z'));
    process.env = {
      ...originalEnv,
      REINSURANCE_DOCUMENT_STORAGE_PROVIDER: 's3',
      REINSURANCE_DOCUMENT_S3_BUCKET: 'workphelo-documents',
      REINSURANCE_DOCUMENT_S3_REGION: 'eu-west-1',
      REINSURANCE_DOCUMENT_S3_PREFIX: 'reinsurance',
      REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS: '300',
    };
    sendMock = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://signed.example/document.pdf',
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('uploads PDFs to private S3 with a tenant/placement/document/version object key', async () => {
    const service = new S3DocumentStorageService();

    const result = await service.storePdf({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      documentId: 'document-1',
      version: 2,
      documentNumber: 'DOC-CS-001',
      body: Buffer.from('%PDF'),
      checksum: 'sha256:abc123',
      contentType: 'application/pdf',
    });

    expect(result).toEqual({
      storageProvider: 'S3',
      objectKey:
        'reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1/v2/DOC-CS-001.pdf',
      fileName: 'DOC-CS-001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
    });
    expect(sendMock).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    const sendCalls = sendMock.mock.calls as Array<
      [PutObjectCommand | GetObjectCommand]
    >;
    const sentCommand = sendCalls[0][0];
    expect(sentCommand).toBeInstanceOf(PutObjectCommand);
    expect(sentCommand.input).toMatchObject({
      Bucket: 'workphelo-documents',
      Key: result.objectKey,
      Body: Buffer.from('%PDF'),
      ContentType: 'application/pdf',
      Metadata: {
        checksum: 'sha256:abc123',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        documentId: 'document-1',
      },
    });
  });

  it('creates short-lived signed download URLs without storing public URLs', async () => {
    const service = new S3DocumentStorageService();

    const result = await service.signedDownloadUrl({
      objectKey: 'reinsurance/document.pdf',
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.any(GetObjectCommand),
      { expiresIn: 300 },
    );
    const signedUrlCalls = (getSignedUrl as jest.Mock).mock.calls as Array<
      [S3Client, GetObjectCommand, { expiresIn: number }]
    >;
    const signedCommand = signedUrlCalls[0][1];
    const signedOptions = signedUrlCalls[0][2];
    expect(signedCommand).toBeInstanceOf(GetObjectCommand);
    expect(signedOptions).toEqual({ expiresIn: 300 });
    expect(signedCommand.input).toMatchObject({
      Bucket: 'workphelo-documents',
      Key: 'reinsurance/document.pdf',
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: 'inline; filename="DOC-CS-001.pdf"',
    });
    expect(result).toEqual({
      url: 'https://signed.example/document.pdf',
      expiresAt: new Date('2026-06-12T10:05:00.000Z'),
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });
  });

  it('reads a private stored object for an outbound workflow attachment', async () => {
    const transformToByteArray = jest
      .fn()
      .mockResolvedValue(Uint8Array.from(Buffer.from('%PDF')));
    sendMock.mockResolvedValueOnce({
      Body: { transformToByteArray },
    } as never);
    const service = new S3DocumentStorageService();

    const result = await service.readStoredObject({
      objectKey: 'reinsurance/document.pdf',
      mimeType: 'application/pdf',
      fileName: 'DOC-OS-001.pdf',
    });

    const sendCalls = sendMock.mock.calls as Array<
      [PutObjectCommand | GetObjectCommand]
    >;
    const sentCommand = sendCalls[0][0];
    expect(sentCommand).toBeInstanceOf(GetObjectCommand);
    expect(sentCommand.input).toMatchObject({
      Bucket: 'workphelo-documents',
      Key: 'reinsurance/document.pdf',
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: 'inline; filename="DOC-OS-001.pdf"',
    });
    expect(transformToByteArray).toHaveBeenCalled();
    expect(result).toEqual({
      body: Buffer.from('%PDF'),
      mimeType: 'application/pdf',
      fileName: 'DOC-OS-001.pdf',
      sizeBytes: 4,
    });
  });

  it('fails fast when required S3 configuration is missing', async () => {
    delete process.env.REINSURANCE_DOCUMENT_S3_BUCKET;
    const service = new S3DocumentStorageService();

    await expect(
      service.storePdf({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        documentId: 'document-1',
        version: 1,
        documentNumber: 'DOC-CS-001',
        body: Buffer.from('%PDF'),
        checksum: 'sha256:abc123',
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('stores new PDFs in authenticated Cloudinary raw storage when configured', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'cloudinary';
    process.env.CLOUDINARY_CLOUD_NAME = 'workphelo-cloud';
    process.env.CLOUDINARY_API_KEY = 'cloudinary-key';
    process.env.CLOUDINARY_API_SECRET = 'cloudinary-secret';
    process.env.REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER =
      'workphelo/reinsurance';

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        _options: unknown,
        callback: (error: unknown, result?: { public_id: string }) => void,
      ) => ({
        end: jest.fn(() =>
          callback(null, {
            public_id:
              'workphelo/reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1/cloudinary-pdf-id',
          }),
        ),
      }),
    );

    const service = new S3DocumentStorageService();

    const result = await service.storePdf({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      documentId: 'document-1',
      version: 1,
      documentNumber: 'DOC-CS-001',
      body: Buffer.from('%PDF'),
      checksum: 'sha256:abc123',
      contentType: 'application/pdf',
    });

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'workphelo-cloud',
      api_key: 'cloudinary-key',
      api_secret: 'cloudinary-secret',
      secure: true,
    });

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        folder:
          'workphelo/reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1',
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        filename_override: 'DOC-CS-001.pdf',
      }),
      expect.any(Function),
    );

    expect(result).toEqual({
      storageProvider: 'CLOUDINARY',
      objectKey:
        'cloudinary:raw:authenticated:workphelo/reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1/cloudinary-pdf-id',
      fileName: 'DOC-CS-001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('stores attachments in Cloudinary without treating them as images', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'cloudinary';
    process.env.CLOUDINARY_CLOUD_NAME = 'workphelo-cloud';
    process.env.CLOUDINARY_API_KEY = 'cloudinary-key';
    process.env.CLOUDINARY_API_SECRET = 'cloudinary-secret';

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        _options: unknown,
        callback: (error: unknown, result?: { public_id: string }) => void,
      ) => ({
        end: jest.fn(() =>
          callback(null, {
            public_id: 'workphelo/reinsurance/attachment-id',
          }),
        ),
      }),
    );

    const service = new S3DocumentStorageService();

    const result = await service.storeAttachment({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      attachmentId: 'attachment-1',
      parentType: 'CLAIM',
      body: Buffer.from('spreadsheet-bytes'),
      checksum: 'sha256:file',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      originalFileName: 'claim workbook.xlsx',
    });

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        folder:
          'workphelo/reinsurance/tenants/tenant-1/placements/placement-1/attachments/claim/attachment-1',
        filename_override: 'claim workbook.xlsx',
      }),
      expect.any(Function),
    );

    expect(result).toEqual({
      storageProvider: 'CLOUDINARY',
      objectKey:
        'cloudinary:raw:authenticated:workphelo/reinsurance/attachment-id',
      fileName: 'claim workbook.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: Buffer.byteLength('spreadsheet-bytes'),
    });
  });

  it('creates authenticated short-lived Cloudinary download URLs for Cloudinary references', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'cloudinary';
    process.env.CLOUDINARY_CLOUD_NAME = 'workphelo-cloud';
    process.env.CLOUDINARY_API_KEY = 'cloudinary-key';
    process.env.CLOUDINARY_API_SECRET = 'cloudinary-secret';
    process.env.REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS = '120';

    (cloudinary.utils.private_download_url as jest.Mock).mockReturnValue(
      'https://cloudinary.example/private/document',
    );

    const service = new S3DocumentStorageService();

    const result = await service.signedDownloadUrl({
      objectKey:
        'cloudinary:raw:authenticated:workphelo/reinsurance/document-id',
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });

    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      'workphelo/reinsurance/document-id',
      'pdf',
      {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: Math.floor(
          new Date('2026-06-12T10:02:00.000Z').getTime() / 1000,
        ),
        attachment: false,
      },
    );

    expect(result).toEqual({
      url: 'https://cloudinary.example/private/document',
      expiresAt: new Date('2026-06-12T10:02:00.000Z'),
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });

    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('reads Cloudinary-backed objects as bytes for email attachments', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'cloudinary';
    process.env.CLOUDINARY_CLOUD_NAME = 'workphelo-cloud';
    process.env.CLOUDINARY_API_KEY = 'cloudinary-key';
    process.env.CLOUDINARY_API_SECRET = 'cloudinary-secret';

    (cloudinary.utils.private_download_url as jest.Mock).mockReturnValue(
      'https://cloudinary.example/private/document',
    );

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(Buffer.from('%PDF')),
    } as unknown as Response);

    const service = new S3DocumentStorageService();

    const result = await service.readStoredObject({
      objectKey:
        'cloudinary:raw:authenticated:workphelo/reinsurance/document-id',
      mimeType: 'application/pdf',
      fileName: 'DOC-OS-001.pdf',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cloudinary.example/private/document',
    );

    expect(result).toEqual({
      body: Buffer.from('%PDF'),
      mimeType: 'application/pdf',
      fileName: 'DOC-OS-001.pdf',
      sizeBytes: 4,
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('continues to read historical plain S3 object keys while Cloudinary is the active write provider', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'cloudinary';
    process.env.CLOUDINARY_CLOUD_NAME = 'workphelo-cloud';
    process.env.CLOUDINARY_API_KEY = 'cloudinary-key';
    process.env.CLOUDINARY_API_SECRET = 'cloudinary-secret';

    const service = new S3DocumentStorageService();

    const result = await service.signedDownloadUrl({
      objectKey:
        'reinsurance/tenants/legacy/placements/placement-1/document.pdf',
      mimeType: 'application/pdf',
      fileName: 'legacy.pdf',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.any(GetObjectCommand),
      { expiresIn: 300 },
    );

    expect(result.url).toBe('https://signed.example/document.pdf');
    expect(cloudinary.utils.private_download_url).not.toHaveBeenCalled();
  });

  it('fails Cloudinary writes when required Cloudinary credentials are missing', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'cloudinary';
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const service = new S3DocumentStorageService();

    await expect(
      service.storePdf({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        documentId: 'document-1',
        version: 1,
        documentNumber: 'DOC-CS-001',
        body: Buffer.from('%PDF'),
        checksum: 'sha256:abc123',
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it('rejects unsupported storage providers', async () => {
    process.env.REINSURANCE_DOCUMENT_STORAGE_PROVIDER = 'filesystem';

    const service = new S3DocumentStorageService();

    await expect(
      service.storePdf({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        documentId: 'document-1',
        version: 1,
        documentNumber: 'DOC-CS-001',
        body: Buffer.from('%PDF'),
        checksum: 'sha256:abc123',
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(sendMock).not.toHaveBeenCalled();
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
});
