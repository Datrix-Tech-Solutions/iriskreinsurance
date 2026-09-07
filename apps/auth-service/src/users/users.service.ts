import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { JwtService } from '@nestjs/jwt';
import { InviteUserDto, UserSystemRole } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { generateSecureToken } from '../common/otp.helper';
import * as bcrypt from 'bcrypt';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { AuditService } from '../audit/audit.service';
import { syncUserSystemPermissionSet } from '../permissions/system-permission-sets';
import { normalizeEmail } from '../common/email.helper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async validateInvitedEmployeePermissionSets(
    tenantId: string,
    permissionSetIds: string[],
  ) {
    if (permissionSetIds.length === 0) {
      return [];
    }

    const uniquePermissionSetIds = Array.from(new Set(permissionSetIds));
    const permissionSets = await this.prisma.permissionSet.findMany({
      where: {
        id: { in: uniquePermissionSetIds },
        tenantId,
        isActive: true,
        isSystem: false,
      },
      select: { id: true, name: true },
    });

    if (permissionSets.length !== uniquePermissionSetIds.length) {
      throw new BadRequestException(
        'One or more selected permission sets are invalid for this tenant.',
      );
    }

    return permissionSets;
  }

  async invite(tenantId: string, dto: InviteUserDto, invitedBy?: string) {
    const normalizedEmail = normalizeEmail(dto.email);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Block superadmin email
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail) throw new Error('SUPER_ADMIN_EMAIL is required');
    if (normalizedEmail === normalizeEmail(superAdminEmail)) {
      throw new ForbiddenException(
        'This email is reserved for the platform owner.',
      );
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });
    if (existing)
      throw new ConflictException('A user with this email already exists.');

    const userRole = dto.role ?? UserSystemRole.EMPLOYEE;
    const permissionSetIds = dto.permissionSetIds ?? [];

    // One Company Admin per tenant. Admin reassignment must go through the
    // dedicated tenant-admin flow so we do not silently demote the current admin.
    if (userRole === UserSystemRole.TENANT_ADMIN) {
      if (permissionSetIds.length > 0) {
        throw new BadRequestException(
          'Permission sets can only be selected for employee invites.',
        );
      }

      const existingAdmin = await this.prisma.user.findFirst({
        where: { tenantId, role: 'TENANT_ADMIN' },
        select: { id: true },
      });

      if (existingAdmin) {
        throw new ConflictException(
          'This company already has an administrator. Use the tenant admin update flow instead.',
        );
      }
    }

    const selectedPermissionSets =
      userRole === UserSystemRole.EMPLOYEE
        ? await this.validateInvitedEmployeePermissionSets(
            tenantId,
            permissionSetIds,
          )
        : [];

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: normalizedEmail,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: userRole,
        status: 'PENDING_VERIFICATION',
        forcePasswordReset: true,
        inviteToken,
        inviteExpiresAt,
      },
    });

    await syncUserSystemPermissionSet(
      this.prisma,
      {
        tenantId,
        userId: user.id,
        role: userRole,
        grantedBy: user.id,
      },
      this.logger,
    );

    if (selectedPermissionSets.length > 0) {
      await this.prisma.userPermissionSet.createMany({
        data: selectedPermissionSets.map((permissionSet) => ({
          userId: user.id,
          permissionSetId: permissionSet.id,
          grantedBy: invitedBy ?? user.id,
        })),
        skipDuplicates: true,
      });
    }

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(tenant.slug, inviteToken);

    void this.rabbitmq
      .notificationInviteUser({
        userId: user.id,
        tenantId,
        email: user.email,
        firstName: user.firstName,
        inviteToken,
        acceptInviteUrl,
        tenantName: tenant.name,
        inviteKind:
          userRole === UserSystemRole.TENANT_ADMIN
            ? 'TENANT_ADMIN'
            : 'EMPLOYEE',
      })
      .catch((err) =>
        this.logger.error(`Failed to send invite for ${user.email}`, err),
      );

    await this.audit.log({
      tenantId,
      action: 'CREATE',
      resource: 'users',
      resourceId: user.id,
      changes: {
        after: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: 'PENDING_VERIFICATION',
          permissionSetIds: selectedPermissionSets.map(
            (permissionSet) => permissionSet.id,
          ),
        },
      },
      status: 'SUCCESS',
    });

    const {
      password: _password,
      mfaSecret: _mfaSecret,
      inviteToken: _token,
      ...safeUser
    } = user;
    return { user: safeUser, message: 'Invitation sent successfully' };
  }

  async provisionEmployeeInvite(
    tenantId: string,
    dto: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    const result = await this.invite(tenantId, {
      ...dto,
      role: UserSystemRole.EMPLOYEE,
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      inviteSent: true,
    };
  }

  async deletePendingEmployeeInvite(
    tenantId: string,
    dto: { userId?: string; email: string },
  ) {
    const user = dto.userId
      ? await this.prisma.user.findFirst({
          where: { id: dto.userId, tenantId },
        })
      : await this.prisma.user.findUnique({
          where: {
            tenantId_email: {
              tenantId,
              email: normalizeEmail(dto.email),
            },
          },
        });

    if (!user) {
      return { deleted: false };
    }

    if (user.role !== 'EMPLOYEE') {
      throw new BadRequestException(
        'Only pending employee invites can be rolled back.',
      );
    }

    if (user.status !== 'PENDING_VERIFICATION' || !user.inviteToken) {
      throw new BadRequestException(
        'The employee invite can no longer be rolled back.',
      );
    }

    await this.prisma.user.delete({ where: { id: user.id } });
    return { deleted: true };
  }

  async getUserStatuses(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }

    const uniqueUserIds = Array.from(new Set(userIds));
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: uniqueUserIds } },
      select: { id: true, status: true },
    });

    return users.map((user) => ({ userId: user.id, status: user.status }));
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: dto.inviteToken },
      include: { tenant: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'This link has already been used. Please log in or reset your password.',
      );
    }

    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new ForbiddenException(
        'This invitation has expired. Please contact your platform administrator to resend the invitation.',
      );
    }

    if (user.role === 'TENANT_ADMIN') {
      await this.rabbitmq.hrProvisionTenantWorkspace({
        tenantId: user.tenantId,
        adminEmail: user.tenant.email,
        adminUserId: user.id,
        country: user.tenant.country,
        currency: user.tenant.currency,
      });
    } else {
      await this.rabbitmq.hrLinkEmployeeIdentity({
        tenantId: user.tenantId,
        email: user.email,
        userId: user.id,
      });
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        forcePasswordReset: false,
        inviteToken: null,
        inviteExpiresAt: null,
        lastLoginAt: new Date(),
      },
      include: { tenant: true },
    });

    // Activate tenant when Company Admin accepts invite
    if (updated.role === 'TENANT_ADMIN') {
      await this.prisma.tenant.update({
        where: { id: updated.tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    // Auto-login — issue tokens so frontend redirects straight to dashboard
    const payload = {
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      tenantId: updated.tenantId,
      tenantSlug: updated.tenant.slug,
      tenantName: updated.tenant.name,
      firstName: updated.firstName,
      // Permissions omitted — JwtStrategy.validate() fetches them from DB on each request.
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: updated.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: updated.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        tenantId: updated.tenantId,
        tenantSlug: updated.tenant.slug,
        tenantName: updated.tenant.name,
      },
    };
  }

  async resendInvite(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'PENDING_VERIFICATION') {
      throw new ForbiddenException('User has already accepted the invitation.');
    }

    const inviteToken = generateSecureToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { inviteToken, inviteExpiresAt },
    });

    const acceptInviteUrl = WorkspaceUrl.acceptInvite(
      user.tenant.slug,
      inviteToken,
    );

    void this.rabbitmq
      .notificationInviteUser({
        userId: user.id,
        tenantId,
        email: user.email,
        firstName: user.firstName,
        inviteToken,
        tenantName: user.tenant.name,
        acceptInviteUrl,
        inviteKind: user.role === 'TENANT_ADMIN' ? 'TENANT_ADMIN' : 'EMPLOYEE',
        isResend: true,
      })
      .catch((err) =>
        this.logger.error(`Failed to resend invite for ${user.email}`, err),
      );

    await this.audit.log({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'users',
      resourceId: user.id,
      changes: {
        before: {
          inviteExpiresAt: user.inviteExpiresAt?.toISOString(),
          status: user.status,
        },
        after: {
          resendInvite: true,
          inviteExpiresAt: inviteExpiresAt.toISOString(),
          status: user.status,
        },
      },
      status: 'SUCCESS',
    });

    return { message: 'Invitation resent successfully' };
  }

  async findByEmail(tenantId: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: normalizeEmail(email), mode: 'insensitive' },
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        isMfaEnabled: true,
        mfaMethod: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        forcePasswordReset: true,
      },
    });
  }

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        isMfaEnabled: true,
        mfaMethod: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        forcePasswordReset: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be modified.',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        isMfaEnabled: true,
        updatedAt: true,
      },
    });
  }

  async deactivate(tenantId: string, id: string) {
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be deactivated.',
      );
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });
    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async forcePasswordReset(tenantId: string, id: string) {
    const existing = await this.findById(tenantId, id);
    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'The super admin account cannot be modified.',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: { forcePasswordReset: true },
    });
  }
}
