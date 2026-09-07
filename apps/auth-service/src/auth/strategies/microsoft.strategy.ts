import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { Request } from 'express';

interface MicrosoftProfile {
  id: string;
  emails?: Array<{ value: string }>;
  _json?: { mail?: string; userPrincipalName?: string };
  displayName?: string;
}

type OAuthDoneCallback = (err: Error | null, user?: unknown) => void;

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('MICROSOFT_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('MICROSOFT_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('MICROSOFT_CALLBACK_URL'),
      scope: ['user.read'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: MicrosoftProfile,
    done: OAuthDoneCallback,
  ) {
    const query = req.query as Record<string, string>;
    const tenantSlug = query.state || query.tenantSlug;

    // Normalize Microsoft profile to match Google profile shape
    const normalizedProfile = {
      id: profile.id,
      emails: [
        {
          value:
            profile.emails?.[0]?.value ||
            profile._json?.mail ||
            profile._json?.userPrincipalName ||
            '',
        },
      ],
      displayName: profile.displayName,
    };

    done(null, { profile: normalizedProfile, tenantSlug });
  }
}
