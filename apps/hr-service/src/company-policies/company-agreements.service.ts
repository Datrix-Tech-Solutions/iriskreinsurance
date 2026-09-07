import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CompanyAgreementSignatureStatus,
  CompanyAgreementSignatureType,
  CompanyAgreementState,
  EmploymentStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyAgreementDto } from './dto/create-company-agreement.dto';
import { DeclineCompanyAgreementDto } from './dto/decline-company-agreement.dto';
import { PublishCompanyAgreementDto } from './dto/publish-company-agreement.dto';
import { QueryCompanyAgreementSignaturesDto } from './dto/query-company-agreement-signatures.dto';
import { SignCompanyAgreementDto } from './dto/sign-company-agreement.dto';
import { UpdateCompanyAgreementDto } from './dto/update-company-agreement.dto';

const AGREEMENT_CONSENT_TEXT =
  'I have read and agree to be bound by this company agreement.';

const SIGNABLE_EMPLOYEE_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
];

@Injectable()
export class CompanyAgreementsService {
  private readonly logger = new Logger(CompanyAgreementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.companyAgreement.findMany({
      where: { tenantId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    dto: CreateCompanyAgreementDto,
    createdBy?: string | null,
  ) {
    const agreement = await this.prisma.companyAgreement.create({
      data: {
        tenantId,
        type: dto.type,
        title: dto.title.trim(),
        details: dto.details.trim(),
        documentUrl: dto.documentUrl?.trim() || null,
        isRequired: dto.isRequired ?? true,
        createdBy: createdBy ?? null,
      },
    });

    this.logAudit('created', {
      tenantId,
      actorUserId: createdBy ?? null,
      agreementId: agreement.id,
    });

    return agreement;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCompanyAgreementDto,
    updatedBy?: string | null,
  ) {
    const existing = await this.findAgreementOrThrow(tenantId, id);
    if (existing.state === CompanyAgreementState.ARCHIVED) {
      throw new BadRequestException('Archived agreements cannot be updated.');
    }

    const agreement = await this.prisma.companyAgreement.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.details !== undefined ? { details: dto.details.trim() } : {}),
        ...(dto.documentUrl !== undefined
          ? { documentUrl: dto.documentUrl?.trim() || null }
          : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
      },
    });

    this.logAudit('updated', {
      tenantId,
      actorUserId: updatedBy ?? null,
      agreementId: id,
    });

    return agreement;
  }

  async publish(
    tenantId: string,
    id: string,
    dto: PublishCompanyAgreementDto,
    publishedBy: string,
  ) {
    const agreement = await this.findAgreementOrThrow(tenantId, id);
    if (agreement.state === CompanyAgreementState.ARCHIVED) {
      throw new BadRequestException('Archived agreements cannot be published.');
    }

    const documentUrl =
      dto.documentUrl?.trim() || agreement.documentUrl?.trim() || null;

    try {
      const version = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.companyAgreementVersion.findFirst({
          where: { tenantId, agreementId: id },
          orderBy: { version: 'desc' },
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;
        const agreementHash = this.hashAgreementVersion({
          tenantId,
          agreementId: id,
          title: agreement.title,
          details: agreement.details,
          documentUrl,
        });

        if (
          latestVersion &&
          this.isSameAgreementSnapshot(latestVersion, {
            title: agreement.title,
            details: agreement.details,
            documentUrl,
          })
        ) {
          throw new BadRequestException(
            'This agreement version is already published.',
          );
        }

        const version = await tx.companyAgreementVersion.create({
          data: {
            tenantId,
            agreementId: id,
            version: nextVersion,
            title: agreement.title,
            details: agreement.details,
            documentUrl,
            agreementHash,
            publishedBy,
            publishedAt: new Date(),
          },
        });

        await tx.companyAgreement.update({
          where: { id },
          data: {
            state: CompanyAgreementState.PUBLISHED,
            activeVersionId: version.id,
            documentUrl,
          },
        });

        return version;
      });

      this.logAudit('published', {
        tenantId,
        actorUserId: publishedBy,
        agreementId: id,
        versionId: version.id,
      });

      return version;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This agreement was updated by another request. Please refresh and try again.',
        );
      }
      throw error;
    }
  }

  async archive(tenantId: string, id: string, archivedBy?: string | null) {
    await this.findAgreementOrThrow(tenantId, id);
    const agreement = await this.prisma.companyAgreement.update({
      where: { id },
      data: { state: CompanyAgreementState.ARCHIVED },
    });

    this.logAudit('archived', {
      tenantId,
      actorUserId: archivedBy ?? null,
      agreementId: id,
    });

    return agreement;
  }

  async remove(tenantId: string, id: string, deletedBy?: string | null) {
    const existing = await this.findAgreementOrThrow(tenantId, id);
    const signatureCount = await this.prisma.companyAgreementSignature.count({
      where: { tenantId, agreementId: id },
    });

    if (
      existing.state !== CompanyAgreementState.DRAFT ||
      signatureCount > 0 ||
      existing.activeVersionId
    ) {
      throw new BadRequestException(
        'Published or signed agreements cannot be deleted. Archive them instead.',
      );
    }

    await this.prisma.companyAgreement.delete({
      where: { id },
    });

    this.logAudit('deleted', {
      tenantId,
      actorUserId: deletedBy ?? null,
      agreementId: id,
    });

    return { message: 'Company agreement deleted successfully' };
  }

  async findMyAgreements(tenantId: string, userId: string) {
    const employee = await this.findEmployeeForUserOrThrow(tenantId, userId);
    const agreements = await this.prisma.companyAgreement.findMany({
      where: {
        tenantId,
        state: CompanyAgreementState.PUBLISHED,
        activeVersionId: { not: null },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const activeVersionIds = agreements
      .map((agreement) => agreement.activeVersionId)
      .filter((versionId): versionId is string => Boolean(versionId));

    const [versions, signatures] = await Promise.all([
      this.prisma.companyAgreementVersion.findMany({
        where: { tenantId, id: { in: activeVersionIds } },
      }),
      this.prisma.companyAgreementSignature.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          versionId: { in: activeVersionIds },
        },
      }),
    ]);

    const versionsById = new Map(
      versions.map((version) => [version.id, version]),
    );
    const signaturesByVersionId = new Map(
      signatures.map((signature) => [signature.versionId, signature]),
    );

    return agreements.flatMap((agreement) => {
      if (!agreement.activeVersionId) return [];
      const version = versionsById.get(agreement.activeVersionId);
      if (!version) return [];
      const signature = signaturesByVersionId.get(version.id);
      return [
        {
          agreement: this.agreementSnapshotForVersion(agreement, version),
          version,
          signature: signature ?? null,
          status: signature?.status ?? 'PENDING',
        },
      ];
    });
  }

  async findMyAgreementVersion(
    tenantId: string,
    userId: string,
    versionId: string,
  ) {
    const employee = await this.findEmployeeForUserOrThrow(tenantId, userId);
    const version = await this.findActiveVersionOrThrow(tenantId, versionId);
    const signature = await this.prisma.companyAgreementSignature.findUnique({
      where: {
        tenantId_versionId_employeeId: {
          tenantId,
          versionId,
          employeeId: employee.id,
        },
      },
    });

    return {
      agreement: this.agreementSnapshotForVersion(version.agreement, version),
      version: this.stripAgreementFromVersion(version),
      signature,
      status: signature?.status ?? 'PENDING',
    };
  }

  async signMyAgreement(
    tenantId: string,
    userId: string,
    versionId: string,
    dto: SignCompanyAgreementDto,
    metadata: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const employee = await this.findEmployeeForUserOrThrow(tenantId, userId);
    const version = await this.findActiveVersionOrThrow(tenantId, versionId);

    try {
      const signature = await this.prisma.companyAgreementSignature.create({
        data: {
          tenantId,
          agreementId: version.agreementId,
          versionId: version.id,
          employeeId: employee.id,
          userId,
          status: CompanyAgreementSignatureStatus.SIGNED,
          signatureType: CompanyAgreementSignatureType.TYPED,
          typedName: dto.typedName.trim(),
          consentText: AGREEMENT_CONSENT_TEXT,
          agreementHash: version.agreementHash,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null,
          signedAt: new Date(),
        },
      });

      this.logAudit('signed', {
        tenantId,
        actorUserId: userId,
        agreementId: version.agreementId,
        versionId: version.id,
        employeeId: employee.id,
      });

      return signature;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This agreement version has already been signed or declined by this employee.',
        );
      }
      throw error;
    }
  }

  async declineMyAgreement(
    tenantId: string,
    userId: string,
    versionId: string,
    dto: DeclineCompanyAgreementDto,
    metadata: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const employee = await this.findEmployeeForUserOrThrow(tenantId, userId);
    const version = await this.findActiveVersionOrThrow(tenantId, versionId);

    try {
      const signature = await this.prisma.companyAgreementSignature.create({
        data: {
          tenantId,
          agreementId: version.agreementId,
          versionId: version.id,
          employeeId: employee.id,
          userId,
          status: CompanyAgreementSignatureStatus.DECLINED,
          signatureType: CompanyAgreementSignatureType.ACKNOWLEDGEMENT,
          consentText: AGREEMENT_CONSENT_TEXT,
          agreementHash: version.agreementHash,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null,
          declinedAt: new Date(),
          declineReason: dto.reason.trim(),
        },
      });

      this.logAudit('declined', {
        tenantId,
        actorUserId: userId,
        agreementId: version.agreementId,
        versionId: version.id,
        employeeId: employee.id,
      });

      return signature;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This agreement version has already been signed or declined by this employee.',
        );
      }
      throw error;
    }
  }

  async getSignatureTracking(
    tenantId: string,
    agreementId: string,
    query: QueryCompanyAgreementSignaturesDto,
  ) {
    const agreement = await this.findAgreementOrThrow(tenantId, agreementId);
    if (!agreement.activeVersionId) {
      return {
        agreement,
        version: null,
        summary: { signed: 0, declined: 0, pending: 0, total: 0 },
        rows: [],
      };
    }

    const [version, employees, signatures] = await Promise.all([
      this.prisma.companyAgreementVersion.findFirst({
        where: {
          tenantId,
          agreementId,
          id: agreement.activeVersionId,
        },
      }),
      this.prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: { in: SIGNABLE_EMPLOYEE_STATUSES },
        },
        select: {
          id: true,
          userId: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          employmentStatus: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      this.prisma.companyAgreementSignature.findMany({
        where: {
          tenantId,
          agreementId,
          versionId: agreement.activeVersionId,
        },
      }),
    ]);

    const signaturesByEmployeeId = new Map(
      signatures.map((signature) => [signature.employeeId, signature]),
    );

    const rows = employees
      .map((employee) => {
        const signature = signaturesByEmployeeId.get(employee.id);
        const status = signature?.status ?? 'PENDING';
        return { employee, signature: signature ?? null, status };
      })
      .filter((row) => !query.status || row.status === query.status);

    const summary = employees.reduce(
      (acc, employee) => {
        const signature = signaturesByEmployeeId.get(employee.id);
        if (!signature) acc.pending += 1;
        else if (signature.status === CompanyAgreementSignatureStatus.SIGNED)
          acc.signed += 1;
        else if (signature.status === CompanyAgreementSignatureStatus.DECLINED)
          acc.declined += 1;
        return acc;
      },
      { signed: 0, declined: 0, pending: 0, total: employees.length },
    );

    return { agreement, version, summary, rows };
  }

  private async findAgreementOrThrow(tenantId: string, id: string) {
    const agreement = await this.prisma.companyAgreement.findFirst({
      where: { id, tenantId },
    });
    if (!agreement) throw new NotFoundException('Company agreement not found');
    return agreement;
  }

  private async findEmployeeForUserOrThrow(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        userId,
        employmentStatus: { in: SIGNABLE_EMPLOYEE_STATUSES },
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee;
  }

  private async findActiveVersionOrThrow(tenantId: string, versionId: string) {
    const version = await this.prisma.companyAgreementVersion.findFirst({
      where: {
        id: versionId,
        tenantId,
        agreement: {
          tenantId,
          state: CompanyAgreementState.PUBLISHED,
          activeVersionId: versionId,
        },
      },
      include: { agreement: true },
    });

    if (!version) {
      throw new NotFoundException('Active company agreement version not found');
    }

    return version;
  }

  private stripAgreementFromVersion<T extends { agreement?: unknown }>(
    version: T,
  ): Omit<T, 'agreement'> {
    const { agreement: _agreement, ...rest } = version;
    return rest;
  }

  private agreementSnapshotForVersion<
    TAgreement extends {
      title: string;
      details: string;
      documentUrl: string | null;
    },
    TVersion extends {
      title: string;
      details: string;
      documentUrl: string | null;
    },
  >(agreement: TAgreement, version: TVersion): TAgreement {
    return {
      ...agreement,
      title: version.title,
      details: version.details,
      documentUrl: version.documentUrl,
    };
  }

  private hashAgreementVersion(input: {
    tenantId: string;
    agreementId: string;
    title: string;
    details: string;
    documentUrl?: string | null;
  }) {
    return crypto
      .createHash('sha256')
      .update(
        [
          input.tenantId,
          input.agreementId,
          input.title,
          input.details,
          input.documentUrl ?? '',
        ].join('|'),
        'utf8',
      )
      .digest('hex');
  }

  private isSameAgreementSnapshot(
    current: {
      title: string;
      details: string;
      documentUrl: string | null;
    },
    next: {
      title: string;
      details: string;
      documentUrl: string | null;
    },
  ) {
    return (
      current.title === next.title &&
      current.details === next.details &&
      (current.documentUrl ?? null) === (next.documentUrl ?? null)
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private logAudit(
    action: string,
    metadata: {
      tenantId: string;
      actorUserId?: string | null;
      agreementId: string;
      versionId?: string | null;
      employeeId?: string | null;
    },
  ) {
    this.logger.log(
      JSON.stringify({
        event: `company_agreement.${action}`,
        tenantId: metadata.tenantId,
        actorUserId: metadata.actorUserId ?? null,
        agreementId: metadata.agreementId,
        versionId: metadata.versionId ?? null,
        employeeId: metadata.employeeId ?? null,
      }),
    );
  }
}
