import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { generateSecureToken } from '../common/otp.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { syncUserSystemPermissionSet } from '../permissions/system-permission-sets';
import { normalizeEmail } from '../common/email.helper';

@Injectable()
export class TenantAdminService {
  private readonly logger = new Logger(TenantAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
  ) {}

  async updateTenantAdmin(id: string, dto: UpdateTenantAdminDto) {
    const normalizedEmail = normalizeEmail(dto.email);

    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const emailIsChanging = normalizedEmail !== tenant.email;

    if (emailIsChanging) {
      const conflict = await this.prisma.tenant.findFirst({
        where: { email: normalizedEmail, id: { not: id } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(
          'This email is already registered to another company',
        );
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
    });

    if (existing) {
      const shouldResendInvite = existing.status === 'PENDING_VERIFICATION';
      const inviteToken = shouldResendInvite
        ? generateSecureToken()
        : undefined;
      const inviteExpiresAt = shouldResendInvite
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : undefined;

      let updated: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        status: string;
      };

      try {
        ({ updated } = await this.prisma.$transaction(async (tx) => {
          const txUpdated = await tx.user.update({
            where: { id: existing.id },
            data: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: normalizedEmail,
              ...(shouldResendInvite ? { inviteToken, inviteExpiresAt } : {}),
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              status: true,
            },
          });

          if (emailIsChanging) {
            await tx.tenant.update({
              where: { id },
              data: { email: normalizedEmail },
            });
          }

          return { updated: txUpdated };
        }));
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'This email is already in use within this company',
          );
        }
        throw error;
      }

      if (shouldResendInvite && inviteToken) {
        void this.rabbitmq
          .notificationInviteUser({
            userId: updated.id,
            tenantId: id,
            email: updated.email,
            firstName: updated.firstName,
            inviteToken,
            acceptInviteUrl: WorkspaceUrl.acceptInvite(
              tenant.slug,
              inviteToken,
            ),
            tenantName: tenant.name,
            inviteKind: 'TENANT_ADMIN',
            isResend: true,
          })
          .catch((err) =>
            this.logger.error(
              `Failed to emit invite for ${updated.email}`,
              err,
            ),
          );
      }

      await this.audit.log({
        tenantId: id,
        userId: existing.id,
        userEmail: updated.email,
        userRole: updated.role,
        action: 'UPDATE',
        resource: 'tenant_admin',
        resourceId: existing.id,
        changes: {
          before: {
            email: existing.email,
            firstName: existing.firstName,
            lastName: existing.lastName,
          },
          after: {
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
          },
        },
        status: 'SUCCESS',
      });

      return {
        message: shouldResendInvite
          ? 'Admin updated successfully. New invite sent.'
          : 'Admin updated successfully',
        user: updated,
      };
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      status: string;
    };

    try {
      ({ user } = await this.prisma.$transaction(async (tx) => {
        const txUser = await tx.user.create({
          data: {
            tenantId: id,
            email: normalizedEmail,
            password: '',
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: 'TENANT_ADMIN',
            status: 'PENDING_VERIFICATION',
            forcePasswordReset: true,
            inviteToken,
            inviteExpiresAt,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        });

        if (emailIsChanging) {
          await tx.tenant.update({
            where: { id },
            data: { email: normalizedEmail },
          });
        }

        return { user: txUser };
      }));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This email is already in use within this company',
        );
      }
      throw error;
    }

    await syncUserSystemPermissionSet(
      this.prisma,
      {
        tenantId: id,
        userId: user.id,
        role: user.role,
        grantedBy: user.id,
      },
      this.logger,
    );

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);
    void this.rabbitmq
      .notificationInviteUser({
        email: user.email,
        firstName: user.firstName,
        tenantName: tenant.name,
        acceptInviteUrl,
        inviteKind: 'TENANT_ADMIN',
      })
      .catch((err) =>
        this.logger.error(`Failed to emit invite for ${user.email}`, err),
      );

    await this.audit.log({
      tenantId: id,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      resource: 'tenant_admin',
      resourceId: user.id,
      changes: {
        after: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
      status: 'SUCCESS',
    });

    return { message: 'Admin assigned. Invite email sent.', user };
  }

  async resendAdminInvite(tenantId: string) {
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, role: 'TENANT_ADMIN', status: 'PENDING_VERIFICATION' },
      include: { tenant: true },
    });
    if (!admin) {
      throw new NotFoundException(
        'No pending Company Admin found for this company.',
      );
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: admin.id },
      data: { inviteToken, inviteExpiresAt },
    });

    void this.rabbitmq
      .notificationInviteUser({
        userId: admin.id,
        tenantId,
        email: admin.email,
        firstName: admin.firstName,
        inviteToken,
        acceptInviteUrl: WorkspaceUrl.acceptInvite(
          admin.tenant.slug,
          inviteToken,
        ),
        tenantName: admin.tenant.name,
        inviteKind: 'TENANT_ADMIN',
        isResend: true,
      })
      .catch((err) =>
        this.logger.error(`Failed to resend invite for ${admin.email}`, err),
      );

    await this.audit.log({
      tenantId,
      userId: admin.id,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'UPDATE',
      resource: 'tenant_admin',
      resourceId: admin.id,
      changes: {
        before: {
          inviteExpiresAt: admin.inviteExpiresAt?.toISOString(),
        },
        after: {
          resendInvite: true,
          inviteExpiresAt: inviteExpiresAt.toISOString(),
        },
      },
      status: 'SUCCESS',
    });

    return { message: 'Invitation resent successfully' };
  }
}
