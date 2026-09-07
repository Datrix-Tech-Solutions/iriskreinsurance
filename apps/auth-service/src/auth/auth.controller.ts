import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { RequestUser } from '@work-phelo/types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForceResetPasswordDto } from './dto/force-reset-password.dto';
import { SendSmsOtpDto } from './dto/send-sms-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { MicrosoftAuthGuard } from './guards/microsoft-auth.guard';
import {
  setAuthCookies,
  clearAuthCookies,
  setAccessTokenCookie,
} from '../common/cookie.helper';

interface OAuthCallbackUser {
  profile: Record<string, unknown>;
  tenantSlug: string;
}

const SENSITIVE_AUTH_THROTTLE = {
  short: { limit: 5, ttl: 60_000 },
  medium: { limit: 20, ttl: 60_000 },
};

const OTP_SEND_THROTTLE = {
  short: { limit: 3, ttl: 60_000 },
  medium: { limit: 10, ttl: 60_000 },
};

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful — tokens set as HTTP-only cookies',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({
    status: 403,
    description: 'Tenant suspended or user inactive',
  })
  @ApiBody({
    description: 'Login payload',
    schema: {
      example: {
        tenantSlug: 'acme-ghana',
        email: 'admin@acmeghana.com',
        password: 'Admin123!',
      },
    },
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    if ('requiresMfa' in result || 'requiresPasswordReset' in result)
      return result;
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const {
      accessToken: _accessToken,
      refreshToken: _refreshToken,
      ...safeResult
    } = result;
    return safeResult;
  }

  @Post('admin/login')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SuperAdmin login (platform owner only)' })
  @ApiBody({
    schema: {
      properties: { email: { type: 'string' }, password: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or not a SuperAdmin',
  })
  async adminLogin(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.adminLogin(
      body.email,
      body.password,
      req.ip,
      req.headers['user-agent'],
    );
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const {
      accessToken: _accessToken2,
      refreshToken: _refreshToken2,
      ...safeResult
    } = result;
    return safeResult;
  }

  @Post('verify-email')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP sent on registration' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle(OTP_SEND_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification OTP' })
  @ApiBody({
    description: 'Resend verification payload',
    schema: {
      example: {
        tenantSlug: 'acme-ghana',
        email: 'admin@acmeghana.com',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Verification OTP sent' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh_token cookie' })
  @ApiResponse({ status: 200, description: 'Tokens rotated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.refresh_token;
    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: 'No refresh token provided' };
    }

    const result = await this.authService.refresh({ refreshToken });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { message: 'Tokens refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout current device — clears cookies and revokes refresh token',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const logoutCookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = logoutCookies?.refresh_token;
    if (refreshToken) await this.authService.logout(refreshToken);
    clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout all devices — revokes all refresh tokens' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  async logoutAll(
    @Req() req: Request & { user: RequestUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(req.user.id);
    clearAuthCookies(res);
    return { message: 'Logged out from all devices' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user returned' })
  me(
    @Req() req: Request & { user: RequestUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    setAccessTokenCookie(res, this.authService.signAccessToken(req.user));

    return {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        tenantId: req.user.tenantId,
        tenantSlug: req.user.tenantSlug,
        tenantName: req.user.tenantName,
        firstName: req.user.firstName,
        moduleConfig: req.user.moduleConfig ?? {},
        featureConfig: req.user.featureConfig ?? {},
      },
      permissions: req.user.permissions ?? [],
    };
  }

  @Post('forgot-password')
  @Throttle(OTP_SEND_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset via email link or SMS OTP' })
  @ApiResponse({ status: 200, description: 'Reset instructions sent' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using email link token or SMS OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 400, description: 'Invalid reset request payload' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password — requires current password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or password',
  })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @Post('force-reset-password')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Force reset — used when login returns requiresPasswordReset: true',
  })
  @ApiBody({
    description: 'Force reset payload',
    schema: {
      example: {
        userId: 'replace-with-user-id-from-login-response',
        newPassword: 'TempPass123!Updated',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset and login successful',
  })
  @ApiResponse({
    status: 400,
    description: 'No reset pending or invalid request',
  })
  async forceResetPassword(
    @Body() dto: ForceResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.forceResetPassword(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const {
      accessToken: _accessToken3,
      refreshToken: _refreshToken3,
      ...safeResult
    } = result;
    return safeResult;
  }

  @Post('mfa/setup-totp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Setup TOTP MFA — returns QR code and secret' })
  @ApiResponse({ status: 200, description: 'TOTP setup data generated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  setupTotp(@Req() req: Request & { user: RequestUser }) {
    return this.authService.setupTotp(req.user.id);
  }

  @Post('mfa/verify-totp')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code and enable MFA' })
  @ApiBody({
    schema: {
      example: {
        userId: 'replace-with-user-id',
        totpCode: '123456',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  verifyTotp(@Body() dto: VerifyMfaDto) {
    return this.authService.verifyAndEnableMfa(dto);
  }

  @Post('mfa/send-sms')
  @Throttle(OTP_SEND_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS OTP to registered phone number' })
  @ApiBody({
    schema: {
      example: {
        userId: 'replace-with-user-id',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'SMS OTP sent' })
  @ApiResponse({ status: 400, description: 'No phone number on file' })
  sendSmsOtp(@Body() dto: SendSmsOtpDto) {
    return this.authService.sendSmsMfaOtp(dto);
  }

  @Post('mfa/verify-sms')
  @Throttle(SENSITIVE_AUTH_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify SMS OTP and enable SMS MFA' })
  @ApiBody({
    schema: {
      example: {
        otpCode: '123456',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'SMS MFA enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  verifySmsOtp(
    @Body('otpCode') otpCode: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.verifySmsMfaAndEnable(req.user.id, otpCode);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiBody({
    schema: {
      example: {
        totpCode: '123456',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  disableMfa(
    @Body('totpCode') totpCode: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.disableMfa(req.user.id, totpCode);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth — open in browser only' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google consent screen',
  })
  googleAuth(@Query('tenantSlug') _tenantSlug: string) {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend callback URL',
  })
  async googleCallback(
    @Req() req: Request & { user: OAuthCallbackUser },
    @Res() res: Response,
  ) {
    const { profile, tenantSlug } = req.user;
    const result = await this.authService.handleSocialLogin(
      profile,
      'GOOGLE',
      tenantSlug,
    );
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:3000';
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.redirect(`${frontendUrl}/auth/social-callback`);
  }

  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ summary: 'Initiate Microsoft OAuth — open in browser only' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Microsoft consent screen',
  })
  microsoftAuth(@Query('tenantSlug') _tenantSlug: string) {}

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend callback URL',
  })
  async microsoftCallback(
    @Req() req: Request & { user: OAuthCallbackUser },
    @Res() res: Response,
  ) {
    const { profile, tenantSlug } = req.user;
    const result = await this.authService.handleSocialLogin(
      profile,
      'MICROSOFT',
      tenantSlug,
    );
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:3000';
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.redirect(`${frontendUrl}/auth/social-callback`);
  }
}
