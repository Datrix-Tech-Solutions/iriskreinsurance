import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, RequestUser } from '@work-phelo/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      // Extract JWT from cookie first, fall back to Authorization header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.access_token ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Fetch permissions from DB — the JWT no longer embeds them to keep
    // the Set-Cookie header small. SUPER_ADMIN and TENANT_ADMIN bypass
    // permission guards via role checks so they don't need a list.
    let permissions: string[] = [];
    if (user.role === 'EMPLOYEE') {
      const [directPerms, setAssignments] = await Promise.all([
        this.prisma.userPermission.findMany({
          where: { tenantId: user.tenantId, userId: user.id },
          include: { resource: true },
        }),
        this.prisma.userPermissionSet.findMany({
          where: { userId: user.id, permissionSet: { isActive: true } },
          include: {
            permissionSet: {
              include: { resources: { include: { resource: true } } },
            },
          },
        }),
      ]);

      const direct = directPerms
        .filter((p) => p.isActive && (!p.expiresAt || p.expiresAt > new Date()))
        .map((p) => `${p.resource.name}:${p.action}`);

      const fromSets = setAssignments.flatMap((a) =>
        a.permissionSet.resources.map((r) => `${r.resource.name}:${r.action}`),
      );

      permissions = [...new Set([...direct, ...fromSets])];
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      tenantName: user.tenant.name,
      firstName: user.firstName,
      moduleConfig: (user.tenant.moduleConfig as Record<string, boolean>) ?? {},
      featureConfig:
        (user.tenant.featureConfig as Record<
          string,
          Record<string, boolean>
        >) ?? {},
      integrationConfig:
        (user.tenant.integrationConfig as Record<string, boolean>) ?? {},
      permissions,
    };
  }
}
