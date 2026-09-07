import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditPayload {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'APPROVE'
    | 'REVOKE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'EXPORT'
    | 'ASSIGN'
    | 'RUN';
  resource: string;
  resourceId?: string;
  changes?: { before?: Record<string, any>; after?: Record<string, any> };
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: payload.tenantId,
          userId: payload.userId,
          userEmail: payload.userEmail,
          userRole: payload.userRole,
          action: payload.action,
          resource: payload.resource,
          resourceId: payload.resourceId,
          changes: payload.changes as Prisma.InputJsonValue,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          status: payload.status || 'SUCCESS',
          failureReason: payload.failureReason,
        },
      });
    } catch (err) {
      // Audit failures must never crash the main operation
      this.logger.error('Failed to write audit log', err);
    }
  }

  async query(
    tenantId: string,
    filters: {
      resource?: string;
      userId?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const take = Math.min(filters.limit || 50, 200);
    const skip = ((filters.page || 1) - 1) * take;

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(filters.resource ? { resource: filters.resource } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action as AuditAction } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      meta: {
        total,
        page: filters.page || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
