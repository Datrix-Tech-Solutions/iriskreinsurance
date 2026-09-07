import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForceResetPasswordDto } from './dto/force-reset-password.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { SendSmsOtpDto } from './dto/send-sms-otp.dto';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { RequestUser } from '@work-phelo/types';
import { generateSecureToken } from '../common/otp.helper';
import { normalizeEmail } from '../common/email.helper';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
  ) {}

  signAccessToken(user: RequestUser): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenantSlug,
        tenantName: user.tenantName,
        firstName: user.firstName,
        moduleConfig: user.moduleConfig,
        featureConfig: user.featureConfig,
        integrationConfig: user.integrationConfig,
        // Permissions omitted — gateway fetches them from /me on each request,
        // keeping the JWT small regardless of how many permissions a user holds.
      },
      { expiresIn: '15m' },
    );
  }

  // ── Token Generation ────────────────────────────────────────────────────
  private async generateTokens(
    user: {
      id: string;
      email: string;
      role: string;
      tenantId: string;
      firstName: string;
    },
    tenant: {
      id: string;
      slug: string;
      name: string;
      moduleConfig: unknown;
      featureConfig: unknown;
      integrationConfig: unknown;
    },
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      firstName: user.firstName,
      moduleConfig: (tenant.moduleConfig as Record<string, boolean>) ?? {
        hr: false,
        accounting: false,
        marketing: false,
      },
      featureConfig:
        (tenant.featureConfig as Record<string, Record<string, boolean>>) ?? {},
      integrationConfig:
        (tenant.integrationConfig as Record<string, boolean>) ?? {},
      // Permissions omitted — gateway fetches them from /me on each request.
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: '8h' },
    );
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.refreshToken.upsert({
      where: { token },
      update: {
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      },
      create: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      },
    });
  }

  // ── Account Lockout Helpers ─────────────────────────────────────────────
  private async handleFailedLogin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const newAttempts = (user.failedLoginAttempts || 0) + 1;

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(
        Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: newAttempts, lockedUntil },
      });
      throw new ForbiddenException(
        `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: newAttempts },
    });

    const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
    throw new UnauthorizedException(
      `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout.`,
    );
  }

  private async clearFailedAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  private checkLockout(user: { lockedUntil: Date | null }) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60),
      );
      throw new ForbiddenException(
        `Account is locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      );
    }
  }

  // ── Login ───────────────────────────────────────────────────────────────
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = normalizeEmail(dto.email);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');
    if (tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant account is not active');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new ForbiddenException(
        'Please accept your invite and set your password first.',
      );
    }

    // Check lockout before verifying password
    this.checkLockout(user);

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Your account has been suspended. Contact your administrator.',
      );
    }
    if (user.status === 'INACTIVE') {
      throw new ForbiddenException(
        'Your account has been deactivated. Please contact your HR administrator.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      await this.handleFailedLogin(user.id);
    }

    // Clear failed attempts on successful password verification
    if (user.failedLoginAttempts > 0) {
      await this.clearFailedAttempts(user.id);
    }

    // Force password reset
    if (user.forcePasswordReset) {
      return { requiresPasswordReset: true, userId: user.id };
    }

    // MFA check
    if (user.isMfaEnabled) {
      return {
        requiresMfa: true,
        mfaMethod: user.mfaMethod,
        userId: user.id,
      };
    }

    const { accessToken, refreshToken } = await this.generateTokens(
      user,
      tenant,
    );
    await this.storeRefreshToken(user.id, refreshToken, ipAddress, userAgent);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN',
      resource: 'auth',
      resourceId: user.id,
      status: 'SUCCESS',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        moduleConfig: (tenant.moduleConfig as Record<string, boolean>) ?? {
          hr: false,
          accounting: false,
          marketing: false,
        },
        featureConfig:
          (tenant.featureConfig as Record<string, Record<string, boolean>>) ??
          {},
        integrationConfig:
          (tenant.integrationConfig as Record<string, boolean>) ?? {},
      },
    };
  }

  async adminLogin(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        role: 'SUPER_ADMIN',
      },
      include: { tenant: true },
    });

    if (!user || !user.password)
      throw new UnauthorizedException('Invalid credentials');

    this.checkLockout(user);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) await this.handleFailedLogin(user.id);

    if (user.failedLoginAttempts > 0) await this.clearFailedAttempts(user.id);

    const { accessToken, refreshToken } = await this.generateTokens(
      user,
      user.tenant,
    );
    await this.storeRefreshToken(user.id, refreshToken, ipAddress, userAgent);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN',
      resource: 'auth',
      resourceId: user.id,
      status: 'SUCCESS',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  // ── Email Verification ──────────────────────────────────────────────────
  async verifyEmail(dto: VerifyEmailDto) {
    const normalizedEmail = normalizeEmail(dto.email);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        code: dto.otp,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp)
      throw new UnauthorizedException('Invalid or expired verification code');

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const normalizedEmail = normalizeEmail(dto.email);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (!tenant)
      return {
        message: 'If that email exists, a verification code has been sent',
      };

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      include: { tenant: true },
    });
    if (!user)
      return {
        message: 'If that email exists, a verification code has been sent',
      };

    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, type: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    void this.rabbitmq.notificationEmailVerification({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      otp: code,
      tenantName: tenant.name,
    });

    return {
      message: 'If that email exists, a verification code has been sent',
    };
  }

  // ── Token Refresh ───────────────────────────────────────────────────────
  async refresh(dto: RefreshTokenDto) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: { include: { tenant: true } } },
    });

    if (
      !storedToken ||
      storedToken.isRevoked ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (
      storedToken.user.status !== 'ACTIVE' ||
      storedToken.user.tenant.status !== 'ACTIVE'
    ) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('User or tenant is no longer active');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const { accessToken, refreshToken } = await this.generateTokens(
      storedToken.user,
      storedToken.user.tenant,
    );
    await this.storeRefreshToken(storedToken.userId, refreshToken);

    return { accessToken, refreshToken };
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ── Password Reset ──────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = normalizeEmail(dto.email);
    // Scope lookup to the tenant — prevents cross-tenant OTP token pollution
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    // Always return the same message regardless of whether tenant/user exists
    // to prevent tenant enumeration via timing attacks
    if (!tenant || tenant.status !== 'ACTIVE') {
      return {
        message: "If this email is registered, you'll receive a code shortly",
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    if (!user) {
      return {
        message: "If this email is registered, you'll receive a code shortly",
      };
    }

    // Resend rate limit: max 3 OTPs per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.otpCode.count({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        createdAt: { gt: oneHourAgo },
      },
    });

    if (recentCount >= 3) {
      return {
        message: 'Too many attempts. Please try again in one hour.',
      };
    }

    // Invalidate any existing unused reset tokens for this user
    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    });

    if (dto.method === 'sms' && user.phone) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.prisma.otpCode.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          code,
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 15 minutes
        },
      });
      void this.rabbitmq
        .notificationPasswordResetOtp({
          phone: user.phone,
          otp: code,
          firstName: user.firstName,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit password_reset_otp for user ${user.id}`,
            err,
          ),
        );
    } else {
      const resetToken = generateSecureToken();
      await this.prisma.otpCode.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          code: resetToken,
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 15 minutes
        },
      });
      const resetLink = WorkspaceUrl.resetPassword(tenant.slug, resetToken);
      void this.rabbitmq
        .notificationPasswordResetLink({
          email: user.email,
          firstName: user.firstName,
          resetLink,
          tenantName: tenant.name,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit password_reset_link for ${user.email}`,
            err,
          ),
        );
    }

    return {
      message: "If this email is registered, you'll receive a code shortly",
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const credential = dto.token || dto.otpCode;
    if (!credential)
      throw new BadRequestException('Reset token or OTP code is required');

    let record;
    if (dto.token) {
      if (!dto.tenantSlug) {
        throw new BadRequestException(
          'Tenant workspace slug is required for reset links.',
        );
      }

      record = await this.prisma.otpCode.findFirst({
        where: {
          type: 'PASSWORD_RESET',
          code: dto.token,
          usedAt: null,
          user: {
            tenant: {
              slug: dto.tenantSlug,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { tenant: true } } },
      });
    } else {
      if (!dto.tenantSlug || !dto.email) {
        throw new BadRequestException(
          'Tenant workspace slug and email are required when using a reset code.',
        );
      }

      const normalizedEmail = normalizeEmail(dto.email);

      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: dto.tenantSlug },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');

      const user = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      });
      if (!user)
        throw new BadRequestException('Invalid or expired reset token');

      record = await this.prisma.otpCode.findFirst({
        where: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          usedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { tenant: true } } },
      });
    }

    if (!record) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if locked due to too many attempts
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new BadRequestException(
        'Too many incorrect attempts. Please try again in 30 minutes.',
      );
    }

    // Check expiry
    if (record.expiresAt < new Date()) {
      throw new BadRequestException(
        'This code has expired. Please request a new one.',
      );
    }

    // Check code correctness
    if (record.code !== credential) {
      const newAttempts = record.attempts + 1;
      const updateData: { attempts: number; lockedUntil?: Date } = {
        attempts: newAttempts,
      };

      if (newAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }

      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: updateData,
      });

      if (newAttempts >= 5) {
        throw new BadRequestException(
          'Too many incorrect attempts. Your reset code has been locked for 30 minutes.',
        );
      }

      throw new BadRequestException(
        `Incorrect code. Please try again. ${5 - newAttempts} attempt(s) remaining.`,
      );
    }

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: record.user.id },
      data: {
        password: hashed,
        passwordChangedAt: new Date(),
        forcePasswordReset: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.user.id },
      data: { isRevoked: true },
    });

    return { message: 'Password reset successfully. Please log in again.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, passwordChangedAt: new Date() },
    });

    return { message: 'Password changed successfully' };
  }

  async forceResetPassword(dto: ForceResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.forcePasswordReset) {
      throw new BadRequestException('No password reset required for this user');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        password: hashed,
        forcePasswordReset: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'ACTIVE',
      },
    });

    const { accessToken, refreshToken } = await this.generateTokens(
      user,
      user.tenant,
    );
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
      },
    };
  }

  // ── MFA ─────────────────────────────────────────────────────────────────
  async setupTotp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = speakeasy.generateSecret({
      name: `WorkPhelo (${user.email})`,
      length: 20,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32, mfaMethod: 'TOTP' },
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { qrCode: qrCodeUrl, secret: secret.base32 };
  }

  async verifyAndEnableMfa(dto: VerifyMfaDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user || !user.mfaSecret)
      throw new BadRequestException('MFA not set up');

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: dto.totpCode,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { isMfaEnabled: true },
    });

    return { message: 'MFA enabled successfully' };
  }

  async sendSmsMfaOtp(dto: SendSmsOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user || !user.phone)
      throw new BadRequestException('No phone number on file');

    await this.prisma.otpCode.updateMany({
      where: { userId: dto.userId, type: 'MFA_SMS', usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.otpCode.create({
      data: {
        userId: dto.userId,
        type: 'MFA_SMS',
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    void this.rabbitmq.notificationSmsOtp({
      userId: user.id,
      tenantId: user.tenantId,
      phone: user.phone,
      otp: code,
      context: 'login',
    });

    return { message: 'OTP sent to your registered phone number' };
  }

  async verifySmsMfaAndEnable(userId: string, otpCode: string) {
    const record = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        type: 'MFA_SMS',
        code: otpCode,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) throw new UnauthorizedException('Invalid or expired OTP');

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: true, mfaMethod: 'SMS' },
    });

    return { message: 'SMS MFA enabled successfully' };
  }

  async disableMfa(userId: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isMfaEnabled)
      throw new BadRequestException('MFA is not enabled');

    if (user.mfaMethod === 'TOTP' && user.mfaSecret) {
      const valid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpCode,
        window: 1,
      });
      if (!valid) throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: false, mfaSecret: null, mfaMethod: null },
    });

    return { message: 'MFA disabled successfully' };
  }

  // ── Social Login ────────────────────────────────────────────────────────
  async handleSocialLogin(
    profile: Record<string, unknown>,
    provider: 'GOOGLE' | 'MICROSOFT',
    tenantSlug: string,
  ) {
    const normalizedEmail = normalizeEmail(profile.email as string);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerId: { provider, providerId: profile.id as string },
      },
      include: { user: { include: { tenant: true } } },
    });

    if (existing) {
      const { accessToken, refreshToken } = await this.generateTokens(
        existing.user,
        existing.user.tenant,
      );
      await this.storeRefreshToken(existing.userId, refreshToken);
      return { accessToken, refreshToken };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    if (!user)
      throw new NotFoundException(
        'No account found for this email. Contact your administrator.',
      );

    await this.prisma.socialAccount.create({
      data: {
        userId: user.id,
        provider,
        providerId: profile.id as string,
        email: normalizedEmail,
      },
    });

    if (user.emailVerifiedAt === null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      });
    }

    const { accessToken, refreshToken } = await this.generateTokens(
      user,
      tenant,
    );
    await this.storeRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }
}
