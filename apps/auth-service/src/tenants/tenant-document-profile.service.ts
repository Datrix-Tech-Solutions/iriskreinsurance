import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Tenant,
  TenantBankAccount,
  TenantDocumentProfile,
} from '../../prisma/generated/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  InternalTenantDocumentAssetDto,
  InternalTenantDocumentProfileDto,
} from './dto/internal-tenant-document-profile.dto';
import {
  CreateTenantBankAccountDto,
  TenantBankAccountResponseDto,
  TenantDocumentProfileResponseDto,
  SUPPORTED_DOCUMENT_CURRENCIES,
  UpdateTenantBankAccountDto,
  UpsertTenantDocumentProfileDto,
} from './dto/tenant-document-profile.dto';
import {
  TenantAssetStorageService,
  TenantDocumentAssetType,
} from './tenant-asset-storage.service';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const SIGNATURE_MAX_BYTES = 1024 * 1024;

type TenantWithDocumentProfile = Tenant & {
  documentProfile: TenantDocumentProfile | null;
  bankAccounts: TenantBankAccount[];
};

type ProfileMutableData = {
  displayName?: string;
  legalName?: string;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  physicalAddress?: string | null;
  postalAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  footerText?: string | null;
  defaultCurrency?: string;
  authorizedSignatoryName?: string | null;
  authorizedSignatoryTitle?: string | null;
  isActive?: boolean;
};

@Injectable()
export class TenantDocumentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TenantAssetStorageService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string): Promise<TenantDocumentProfileResponseDto> {
    const tenant = await this.findTenant(tenantId);
    const response = this.toProfileResponse(tenant);
    const signature = await this.resolveSignatureUrl(tenant.documentProfile);
    response.signatureUrl = signature.url;
    response.signatureUrlExpiresAt = signature.expiresAt;
    return response;
  }

  private async resolveSignatureUrl(
    profile: TenantDocumentProfile | null,
  ): Promise<{ url: string | null; expiresAt: string | null }> {
    if (!profile) return { url: null, expiresAt: null };
    const asset = await this.resolveInternalAsset(
      profile.signatureObjectKey,
      profile.signatureMimeType,
      profile.signatureFileName,
      profile.signatureSizeBytes,
    );
    return { url: asset?.readUrl ?? null, expiresAt: asset?.expiresAt ?? null };
  }

  async getInternalResolved(
    tenantId: string,
  ): Promise<InternalTenantDocumentProfileDto> {
    const tenant = await this.findTenant(tenantId);
    const profile = this.toProfileResponse(tenant);
    const [logo, signature] = await Promise.all([
      this.resolveInternalAsset(
        profile.logoObjectKey,
        profile.logoMimeType,
        profile.logoFileName,
        profile.logoSizeBytes,
      ),
      this.resolveInternalAsset(
        profile.signatureObjectKey,
        profile.signatureMimeType,
        profile.signatureFileName,
        profile.signatureSizeBytes,
      ),
    ]);

    return {
      tenantId: profile.tenantId,
      displayName: profile.displayName,
      legalName: profile.legalName,
      registrationNumber: profile.registrationNumber,
      taxNumber: profile.taxNumber,
      physicalAddress: profile.physicalAddress,
      postalAddress: profile.postalAddress,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      footerText: profile.footerText,
      defaultCurrency: profile.defaultCurrency,
      version: profile.version,
      isActive: profile.isActive,
      defaultsApplied: profile.defaultsApplied,
      authorizedSignatoryName: profile.authorizedSignatoryName,
      authorizedSignatoryTitle: profile.authorizedSignatoryTitle,
      logo,
      signature,
      bankAccounts: profile.bankAccounts
        .filter(
          (account) =>
            account.tenantId === profile.tenantId &&
            account.isActive &&
            account.isDefault,
        )
        .map((account) => ({
          id: account.id,
          bankName: account.bankName,
          branchName: account.branchName,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          currency: account.currency,
          swiftCode: account.swiftCode,
          sortCode: account.sortCode,
        })),
    };
  }

  async upsert(
    tenantId: string,
    actorUserId: string,
    dto: UpsertTenantDocumentProfileDto,
  ): Promise<TenantDocumentProfileResponseDto> {
    const tenant = await this.findTenant(tenantId);
    const data = this.profileUpdateData(dto);
    const defaults = this.profileDefaults(tenant);

    await this.prisma.tenantDocumentProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...defaults,
        ...data,
        version: 1,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      update: {
        ...data,
        version: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: tenant.documentProfile ? 'UPDATE' : 'CREATE',
      resource: 'tenant-document-profile',
      resourceId: tenantId,
      changes: { after: { fields: Object.keys(data) } },
    });
    return this.get(tenantId);
  }

  async uploadAsset(
    tenantId: string,
    actorUserId: string,
    assetType: TenantDocumentAssetType,
    file: Express.Multer.File | undefined,
  ): Promise<TenantDocumentProfileResponseDto> {
    const tenant = await this.findTenant(tenantId);
    this.validateAsset(assetType, file);
    const uploadedFile = file as Express.Multer.File;
    const stored = await this.storage.store({
      tenantId,
      tenantSlug: tenant.slug,
      assetType,
      body: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
      originalFileName: uploadedFile.originalname,
    });
    const defaults = this.profileDefaults(tenant);
    const assetData =
      assetType === 'logo'
        ? {
            logoObjectKey: stored.objectKey,
            logoMimeType: stored.mimeType,
            logoFileName: stored.fileName,
            logoSizeBytes: stored.sizeBytes,
          }
        : {
            signatureObjectKey: stored.objectKey,
            signatureMimeType: stored.mimeType,
            signatureFileName: stored.fileName,
            signatureSizeBytes: stored.sizeBytes,
          };

    await this.prisma.tenantDocumentProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...defaults,
        ...assetData,
        version: 1,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      update: {
        ...assetData,
        version: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      resource: 'tenant-document-profile',
      resourceId: tenantId,
      changes: {
        after: {
          assetType,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      },
    });
    return this.get(tenantId);
  }

  async listBankAccounts(
    tenantId: string,
  ): Promise<TenantBankAccountResponseDto[]> {
    await this.assertTenantExists(tenantId);
    return this.prisma.tenantBankAccount.findMany({
      where: { tenantId },
      orderBy: [
        { isActive: 'desc' },
        { isDefault: 'desc' },
        { currency: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async createBankAccount(
    tenantId: string,
    actorUserId: string,
    dto: CreateTenantBankAccountDto,
  ): Promise<TenantBankAccountResponseDto> {
    const tenant = await this.findTenant(tenantId);
    const isActive = dto.isActive ?? true;
    const isDefault = dto.isDefault ?? false;
    const currency = this.supportedCurrency(dto.currency);
    this.assertDefaultAccountState(isDefault, isActive);

    let account: TenantBankAccount;
    try {
      account = await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await this.clearCurrencyDefault(tx, tenantId, currency, actorUserId);
        }
        const created = await tx.tenantBankAccount.create({
          data: {
            tenantId,
            bankName: this.requiredText(dto.bankName),
            branchName: this.optionalText(dto.branchName),
            accountName: this.requiredText(dto.accountName),
            accountNumber: this.requiredText(dto.accountNumber),
            currency,
            swiftCode: this.optionalText(dto.swiftCode),
            sortCode: this.optionalText(dto.sortCode),
            isDefault,
            isActive,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
        await this.bumpProfileVersion(tx, tenant, actorUserId);
        return created;
      });
    } catch (error) {
      this.rethrowDefaultConflict(error);
    }

    await this.auditBankChange(tenantId, actorUserId, account!, 'CREATE');
    return account!;
  }

  async updateBankAccount(
    tenantId: string,
    accountId: string,
    actorUserId: string,
    dto: UpdateTenantBankAccountDto,
  ): Promise<TenantBankAccountResponseDto> {
    const tenant = await this.findTenant(tenantId);
    const existing = await this.findBankAccount(tenantId, accountId);
    const currency = this.supportedCurrency(dto.currency ?? existing.currency);
    const isActive = dto.isActive ?? existing.isActive;
    const isDefault = dto.isDefault ?? existing.isDefault;
    this.assertDefaultAccountState(isDefault, isActive);

    let account: TenantBankAccount;
    try {
      account = await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await this.clearCurrencyDefault(
            tx,
            tenantId,
            currency,
            actorUserId,
            accountId,
          );
        }
        const updated = await tx.tenantBankAccount.update({
          where: { id_tenantId: { id: accountId, tenantId } },
          data: {
            ...(dto.bankName !== undefined
              ? { bankName: this.requiredText(dto.bankName) }
              : {}),
            ...(dto.branchName !== undefined
              ? { branchName: this.optionalText(dto.branchName) }
              : {}),
            ...(dto.accountName !== undefined
              ? { accountName: this.requiredText(dto.accountName) }
              : {}),
            ...(dto.accountNumber !== undefined
              ? { accountNumber: this.requiredText(dto.accountNumber) }
              : {}),
            ...(dto.currency !== undefined ? { currency } : {}),
            ...(dto.swiftCode !== undefined
              ? { swiftCode: this.optionalText(dto.swiftCode) }
              : {}),
            ...(dto.sortCode !== undefined
              ? { sortCode: this.optionalText(dto.sortCode) }
              : {}),
            ...(dto.isDefault !== undefined ? { isDefault } : {}),
            ...(dto.isActive !== undefined ? { isActive } : {}),
            updatedByUserId: actorUserId,
          },
        });
        await this.bumpProfileVersion(tx, tenant, actorUserId);
        return updated;
      });
    } catch (error) {
      this.rethrowDefaultConflict(error);
    }

    await this.auditBankChange(tenantId, actorUserId, account!, 'UPDATE');
    return account!;
  }

  deactivateBankAccount(
    tenantId: string,
    accountId: string,
    actorUserId: string,
  ): Promise<TenantBankAccountResponseDto> {
    return this.updateBankAccount(tenantId, accountId, actorUserId, {
      isActive: false,
      isDefault: false,
    });
  }

  private async findTenant(
    tenantId: string,
  ): Promise<TenantWithDocumentProfile> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        documentProfile: true,
        bankAccounts: {
          orderBy: [
            { isActive: 'desc' },
            { isDefault: 'desc' },
            { currency: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async assertTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
  }

  private async findBankAccount(
    tenantId: string,
    accountId: string,
  ): Promise<TenantBankAccount> {
    const account = await this.prisma.tenantBankAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException('Tenant bank account not found');
    return account;
  }

  private profileDefaults(tenant: Tenant): {
    displayName: string;
    legalName: string;
    physicalAddress: string | null;
    phone: string | null;
    email: string;
    website: string | null;
    defaultCurrency: string;
  } {
    return {
      displayName: tenant.name,
      legalName: tenant.name,
      physicalAddress: tenant.address,
      phone: tenant.phone,
      email: tenant.email,
      website: tenant.website,
      defaultCurrency: this.defaultCurrencyForTenant(tenant.currency),
    };
  }

  private profileUpdateData(
    dto: UpsertTenantDocumentProfileDto,
  ): ProfileMutableData {
    return {
      ...(dto.displayName !== undefined
        ? { displayName: this.requiredText(dto.displayName) }
        : {}),
      ...(dto.legalName !== undefined
        ? { legalName: this.requiredText(dto.legalName) }
        : {}),
      ...(dto.registrationNumber !== undefined
        ? { registrationNumber: this.optionalText(dto.registrationNumber) }
        : {}),
      ...(dto.taxNumber !== undefined
        ? { taxNumber: this.optionalText(dto.taxNumber) }
        : {}),
      ...(dto.physicalAddress !== undefined
        ? { physicalAddress: this.optionalText(dto.physicalAddress) }
        : {}),
      ...(dto.postalAddress !== undefined
        ? { postalAddress: this.optionalText(dto.postalAddress) }
        : {}),
      ...(dto.phone !== undefined
        ? { phone: this.optionalText(dto.phone) }
        : {}),
      ...(dto.email !== undefined
        ? { email: this.optionalText(dto.email) }
        : {}),
      ...(dto.website !== undefined
        ? { website: this.optionalText(dto.website) }
        : {}),
      ...(dto.footerText !== undefined
        ? { footerText: this.optionalText(dto.footerText) }
        : {}),
      ...(dto.defaultCurrency !== undefined
        ? { defaultCurrency: this.supportedCurrency(dto.defaultCurrency) }
        : {}),
      ...(dto.authorizedSignatoryName !== undefined
        ? {
            authorizedSignatoryName: this.optionalText(
              dto.authorizedSignatoryName,
            ),
          }
        : {}),
      ...(dto.authorizedSignatoryTitle !== undefined
        ? {
            authorizedSignatoryTitle: this.optionalText(
              dto.authorizedSignatoryTitle,
            ),
          }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  private async bumpProfileVersion(
    tx: Prisma.TransactionClient,
    tenant: TenantWithDocumentProfile,
    actorUserId: string,
  ): Promise<void> {
    const defaults = this.profileDefaults(tenant);
    await tx.tenantDocumentProfile.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        ...defaults,
        version: 1,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      update: {
        version: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });
  }

  private clearCurrencyDefault(
    tx: Prisma.TransactionClient,
    tenantId: string,
    currency: string,
    actorUserId: string,
    exceptAccountId?: string,
  ) {
    return tx.tenantBankAccount.updateMany({
      where: {
        tenantId,
        currency,
        isDefault: true,
        isActive: true,
        ...(exceptAccountId ? { id: { not: exceptAccountId } } : {}),
      },
      data: { isDefault: false, updatedByUserId: actorUserId },
    });
  }

  private validateAsset(
    assetType: TenantDocumentAssetType,
    file: Express.Multer.File | undefined,
  ): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        `${assetType === 'logo' ? 'Logo' : 'Signature'} image is required.`,
      );
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Image must be PNG, JPEG or WEBP.');
    }
    if (!this.matchesImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'Image content does not match its declared MIME type.',
      );
    }
    const maxBytes =
      assetType === 'logo' ? LOGO_MAX_BYTES : SIGNATURE_MAX_BYTES;
    if (file.size > maxBytes || file.buffer.byteLength > maxBytes) {
      throw new BadRequestException(
        `${assetType === 'logo' ? 'Logo' : 'Signature'} image exceeds the ${maxBytes / 1024 / 1024} MB limit.`,
      );
    }
  }

  private assertDefaultAccountState(
    isDefault: boolean,
    isActive: boolean,
  ): void {
    if (isDefault && !isActive) {
      throw new BadRequestException(
        'An inactive bank account cannot be the default.',
      );
    }
  }

  private matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/png') {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimeType === 'image/jpeg') {
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    }
    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return false;
  }

  private rethrowDefaultConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Only one active default bank account is allowed per currency.',
      );
    }
    throw error;
  }

  private requiredText(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }

  private supportedCurrency(value: string): string {
    const currency = value.trim().toUpperCase();
    if (
      !SUPPORTED_DOCUMENT_CURRENCIES.includes(
        currency as (typeof SUPPORTED_DOCUMENT_CURRENCIES)[number],
      )
    ) {
      throw new BadRequestException(
        `Currency must be one of: ${SUPPORTED_DOCUMENT_CURRENCIES.join(', ')}.`,
      );
    }
    return currency;
  }

  private defaultCurrencyForTenant(value: string): string {
    const currency = value.trim().toUpperCase();
    return SUPPORTED_DOCUMENT_CURRENCIES.includes(
      currency as (typeof SUPPORTED_DOCUMENT_CURRENCIES)[number],
    )
      ? currency
      : 'GHS';
  }

  private optionalText(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned || null;
  }

  private async resolveInternalAsset(
    objectKey: string | null,
    mimeType: string | null,
    fileName: string | null,
    sizeBytes: number | null,
  ): Promise<InternalTenantDocumentAssetDto | null> {
    if (!objectKey || !mimeType || !fileName || sizeBytes === null) return null;
    const signed = await this.storage.createSignedReadUrl({
      objectKey,
      mimeType,
      fileName,
    });
    return {
      mimeType,
      fileName,
      sizeBytes,
      readUrl: signed.readUrl,
      expiresAt: signed.expiresAt,
    };
  }

  private toProfileResponse(
    tenant: TenantWithDocumentProfile,
  ): TenantDocumentProfileResponseDto {
    const profile = tenant.documentProfile;
    const defaults = this.profileDefaults(tenant);
    return {
      id: profile?.id ?? null,
      tenantId: tenant.id,
      displayName: profile?.displayName ?? defaults.displayName,
      legalName: profile?.legalName ?? defaults.legalName,
      registrationNumber: profile?.registrationNumber ?? null,
      taxNumber: profile?.taxNumber ?? null,
      physicalAddress: profile?.physicalAddress ?? defaults.physicalAddress,
      postalAddress: profile?.postalAddress ?? null,
      phone: profile?.phone ?? defaults.phone,
      email: profile?.email ?? defaults.email,
      website: profile?.website ?? defaults.website,
      footerText: profile?.footerText ?? null,
      defaultCurrency: profile?.defaultCurrency ?? defaults.defaultCurrency,
      logoObjectKey: profile?.logoObjectKey ?? null,
      logoMimeType: profile?.logoMimeType ?? null,
      logoFileName: profile?.logoFileName ?? null,
      logoSizeBytes: profile?.logoSizeBytes ?? null,
      signatureObjectKey: profile?.signatureObjectKey ?? null,
      signatureMimeType: profile?.signatureMimeType ?? null,
      signatureFileName: profile?.signatureFileName ?? null,
      signatureSizeBytes: profile?.signatureSizeBytes ?? null,
      signatureUrl: null,
      signatureUrlExpiresAt: null,
      authorizedSignatoryName: profile?.authorizedSignatoryName ?? null,
      authorizedSignatoryTitle: profile?.authorizedSignatoryTitle ?? null,
      isActive: profile?.isActive ?? true,
      version: profile?.version ?? 0,
      createdByUserId: profile?.createdByUserId ?? null,
      updatedByUserId: profile?.updatedByUserId ?? null,
      createdAt: profile?.createdAt ?? null,
      updatedAt: profile?.updatedAt ?? null,
      defaultsApplied: !profile,
      bankAccounts: tenant.bankAccounts,
    };
  }

  private auditBankChange(
    tenantId: string,
    actorUserId: string,
    account: TenantBankAccount,
    action: 'CREATE' | 'UPDATE',
  ): Promise<void> {
    return this.audit.log({
      tenantId,
      userId: actorUserId,
      action,
      resource: 'tenant-bank-account',
      resourceId: account.id,
      changes: {
        after: {
          bankName: account.bankName,
          currency: account.currency,
          isDefault: account.isDefault,
          isActive: account.isActive,
        },
      },
    });
  }
}
