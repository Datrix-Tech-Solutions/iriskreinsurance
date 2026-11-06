import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload, RequestUser } from '@work-phelo/types';
import { PrismaService } from '../../prisma/prisma.service';

// A separate Passport registration keeps archive checks out of live auth flows.
@Injectable()
export class HistoricalStatementsJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-historical-statements',
) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
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
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.tenantId !== 'string' ||
      !payload.tenantId
    ) {
      throw new UnauthorizedException('Invalid token identity');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (
      !user ||
      user.id !== payload.sub ||
      user.tenantId !== payload.tenantId ||
      user.tenant.id !== payload.tenantId ||
      user.status !== 'ACTIVE' ||
      user.tenant.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('User not found or inactive');
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
      // Archive decisions resolve grants afresh through their dedicated resolver.
      permissions: [],
    };
  }
}
