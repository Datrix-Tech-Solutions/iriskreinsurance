import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, PrismaClient } from '../../prisma/generated/client';
import { isResourceEnabledForTenant } from '../permissions/permission-entitlements';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { HistoricalStatementsEntitlementDto } from './dto/historical-statements-entitlement.dto';

const RESOURCE = 'operations.reinsurance.historical-statements';

@Injectable()
export class HistoricalStatementsEntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  private async currentUser(
    identity: RequestUser,
    db: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    const user = await db.user.findUnique({
      where: { id: identity.id },
      include: { tenant: true },
    });
    if (
      !user ||
      user.id !== identity.id ||
      user.tenantId !== identity.tenantId ||
      user.tenant.id !== identity.tenantId ||
      user.status !== 'ACTIVE' ||
      user.tenant.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return user;
  }

  async getAccess(identity: RequestUser) {
    return this.available(async () => {
      const user = await this.currentUser(identity);
      const enabled =
        user.tenant.historicalStatementsEnabled === true &&
        isResourceEnabledForTenant(
          { name: RESOURCE, module: 'OPERATIONS' },
          {
            moduleConfig: user.tenant.moduleConfig as Record<string, boolean>,
            featureConfig: user.tenant.featureConfig as Record<
              string,
              Record<string, boolean>
            >,
          },
        );
      const admin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user.role);
      const grants =
        enabled && !admin
          ? (
              await this.permissions.getHistoricalStatementsPermissions(
                user.tenantId,
                user.id,
              )
            ).effectivePermissions
          : [];
      const canView = enabled && (admin || grants.includes(`${RESOURCE}:VIEW`));
      return {
        tenantId: user.tenantId,
        userId: user.id,
        enabled,
        canView,
        canExport: canView && (admin || grants.includes(`${RESOURCE}:EXPORT`)),
        // Administrative import cannot be delegated to a non-administrator.
        canImport: enabled && admin,
      };
    });
  }

  async update(
    tenantId: string,
    dto: HistoricalStatementsEntitlementDto,
    identity: RequestUser,
  ) {
    return this.available(() =>
      this.prisma.$transaction(
        async (tx) => {
          // Check the current DB role again; token roles cannot authorize a grant.
          const actor = await this.currentUser(identity, tx);
          if (actor.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Super admin required');
          }
          const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
          });
          if (!tenant) throw new NotFoundException('Tenant not found');
          await tx.tenant.update({
            where: { id: tenantId },
            data: { historicalStatementsEnabled: dto.enabled },
          });
          // Unlike best-effort operational logging, this audit must commit with
          // the platform entitlement or the entire change must roll back.
          await tx.auditLog.create({
            data: {
              tenantId,
              userId: actor.id,
              userEmail: actor.email,
              userRole: actor.role,
              action: 'UPDATE',
              resource: 'tenants.historical-statements-entitlement',
              resourceId: tenantId,
              changes: {
                before: { enabled: tenant.historicalStatementsEnabled },
                after: { enabled: dto.enabled, reason: dto.reason.trim() },
              },
            },
          });
          return { tenantId, enabled: dto.enabled };
        },
        {
          // Concurrent toggles must serialize or fail, never audit a stale before-state.
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  private async available<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Access decision unavailable');
    }
  }
}
