import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantAdminService } from './tenant-admin.service';
import { TenantBrandingService } from './tenant-branding.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { QueryTenantsDto } from './dto/query-tenants.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import {
  PublicTenantBrandingResponseDto,
  TENANT_BRANDING_ASSET_TYPES,
  TenantBrandingResponseDto,
  TenantBrandingUploadAssetType,
  UpdateTenantBrandingDto,
} from './dto/tenant-branding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user: RequestUser };

const brandingAssetUploadSchema = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description:
        'Private branding image. Logos support PNG, JPEG or WEBP. Favicons also support ICO.',
    },
  },
};

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly lifecycle: TenantLifecycleService,
    private readonly config: TenantConfigService,
    private readonly admin: TenantAdminService,
    private readonly branding: TenantBrandingService,
  ) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new company — SuperAdmin only' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created — OTP sent to admin email for verification',
    schema: {
      example: {
        message:
          'Registration submitted. Check your email for verification code.',
        tenantId: 'uuid',
        tenantName: 'Acme Ghana Ltd',
        tenantSlug: 'acme-ghana',
        workspaceUrl: 'https://workphelo.com/acme-ghana/login',
        userId: 'uuid',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email or slug already exists' })
  @ApiBody({
    description: 'Tenant registration payload',
    schema: {
      example: {
        name: 'Acme Ghana Ltd',
        slug: 'acme-ghana',
        email: 'admin@acmeghana.com',
        password: 'Admin123!',
        firstName: 'Abena',
        lastName: 'Mensah',
        phone: '+233244111001',
        country: 'GH',
        industry: 'Manufacturing',
        size: '100-500',
      },
    },
  })
  register(@Body() dto: CreateTenantDto) {
    return this.lifecycle.register(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List tenants — SuperAdmin sees all, Tenant Admin sees own only',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Tenants list' })
  findAll(@Req() req: AuthenticatedRequest, @Query() query: QueryTenantsDto) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const tenantId = isSuperAdmin ? undefined : req.user?.tenantId;
    return this.lifecycle.findAll({ ...query, tenantId });
  }

  @Get(':id/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all users for a tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  getTenantUsers(@Param('id') id: string) {
    return this.lifecycle.getTenantUsers(id);
  }

  @Get(':id/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get audit logs for a tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  getTenantAudit(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.lifecycle.getTenantAuditLogs(id, { page, limit });
  }

  @Get('me/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get own tenant branding — Tenant Admin self-service',
  })
  @ApiResponse({
    status: 200,
    type: TenantBrandingResponseDto,
    description: 'Tenant branding returned.',
  })
  getOwnBranding(@Req() req: AuthenticatedRequest) {
    return this.branding.findByTenantId(this.requireOwnTenantId(req.user));
  }

  @Patch('me/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update own tenant branding — Tenant Admin self-service',
  })
  @ApiBody({ type: UpdateTenantBrandingDto })
  @ApiResponse({
    status: 200,
    type: TenantBrandingResponseDto,
    description: 'Tenant branding updated.',
  })
  updateOwnBranding(
    @Body() dto: UpdateTenantBrandingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.branding.update(
      this.requireOwnTenantId(req.user),
      dto,
      req.user.id,
    );
  }

  @Post('me/branding/assets/:assetType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload own tenant branding asset — Tenant Admin self-service',
  })
  @ApiParam({ name: 'assetType', enum: TENANT_BRANDING_ASSET_TYPES })
  @ApiBody({ schema: brandingAssetUploadSchema })
  @ApiResponse({
    status: 200,
    type: TenantBrandingResponseDto,
    description: 'Tenant branding asset uploaded.',
  })
  uploadOwnBrandingAsset(
    @Param('assetType') assetType: TenantBrandingUploadAssetType,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.branding.uploadAsset(
      this.requireOwnTenantId(req.user),
      req.user.id,
      assetType,
      file,
    );
  }

  @Get('slug/:slug/branding')
  @ApiOperation({
    summary: 'Get safe public tenant branding by workspace slug',
    description:
      'Public read-only bootstrap endpoint for login/workspace theming. Returns safe display colors and display URLs only; object storage keys and audit metadata are never exposed.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Tenant workspace slug, for example acme-ghana.',
  })
  @ApiResponse({
    status: 200,
    type: PublicTenantBrandingResponseDto,
    description: 'Safe tenant branding returned.',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getPublicBrandingBySlug(@Param('slug') slug: string) {
    return this.branding.findPublicBySlug(slug);
  }

  @Get(':id/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get tenant branding — SuperAdmin or owning Tenant Admin',
    description:
      'Returns the canonical tenant branding record with S3-ready object keys for authenticated administrators. WorkPhelo defaults are returned when no branding row exists.',
  })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    type: TenantBrandingResponseDto,
    description: 'Tenant branding returned.',
  })
  @ApiResponse({
    status: 403,
    description: 'Tenant Admin tried to access another tenant branding record.',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getBranding(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.assertBrandingAccess(id, req.user);
    return this.branding.findByTenantId(id);
  }

  @Patch(':id/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update tenant branding — SuperAdmin or owning Tenant Admin',
    description:
      'Upserts S3-ready tenant branding metadata. Hex colors are validated. Public URLs are not treated as source of truth when object keys exist.',
  })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiBody({
    type: UpdateTenantBrandingDto,
    examples: {
      colors: {
        summary: 'Brand colors only',
        value: {
          primaryColor: '#0D2244',
          secondaryColor: '#85B7EB',
          accentColor: '#1E3A8A',
          sidebarColor: '#0D2244',
          emailHeaderColor: '#0D2244',
          documentHeaderColor: '#0D2244',
        },
      },
      s3ReadyAssets: {
        summary: 'Future S3 object keys',
        value: {
          logoObjectKey: 'tenant-branding/tenant-123/logo/v1/logo.png',
          faviconObjectKey: 'tenant-branding/tenant-123/favicon/v1/favicon.ico',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: TenantBrandingResponseDto,
    description: 'Tenant branding updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid hex color value.' })
  @ApiResponse({
    status: 403,
    description: 'Tenant Admin tried to update another tenant branding record.',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  updateBranding(
    @Param('id') id: string,
    @Body() dto: UpdateTenantBrandingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertBrandingAccess(id, req.user);
    return this.branding.update(id, dto, req.user.id);
  }

  @Post(':id/branding/assets/:assetType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload tenant branding asset — Super Admin override or owning Tenant Admin',
    description:
      'Stores private branding assets in S3 and updates TenantBranding. This is separate from TenantDocumentProfile document logos.',
  })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiParam({ name: 'assetType', enum: TENANT_BRANDING_ASSET_TYPES })
  @ApiBody({ schema: brandingAssetUploadSchema })
  @ApiResponse({
    status: 200,
    type: TenantBrandingResponseDto,
    description: 'Tenant branding asset uploaded.',
  })
  uploadBrandingAsset(
    @Param('id') id: string,
    @Param('assetType') assetType: TenantBrandingUploadAssetType,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertBrandingAccess(id, req.user);
    return this.branding.uploadAsset(id, req.user.id, assetType, file);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string) {
    return this.lifecycle.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update tenant details — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.lifecycle.updateTenant(id, dto);
  }

  @Patch(':id/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign or update tenant admin — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    description: 'Admin assigned/updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateTenantAdminDto) {
    return this.admin.updateTenantAdmin(id, dto);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve pending tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant approved successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  approve(@Param('id') id: string) {
    return this.lifecycle.approveTenant(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate active tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  deactivate(@Param('id') id: string) {
    return this.lifecycle.deactivateTenant(id);
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Suspend active tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant suspended successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  suspend(@Param('id') id: string) {
    return this.lifecycle.suspendTenant(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Permanently delete a company — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Company deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  deleteTenant(@Param('id') id: string) {
    return this.lifecycle.deleteTenant(id);
  }

  @Patch(':id/modules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update module configuration for a company' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({
    schema: {
      example: { hr: true, accounting: false, marketing: true },
    },
  })
  @ApiResponse({ status: 200, description: 'Module config updated' })
  updateModules(
    @Param('id') id: string,
    @Body() dto: Record<string, boolean>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.config.updateModules(id, dto, req.user.id);
  }

  @Get(':id/integrations/reinsurance-accounting')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @ApiBearerAuth('access-token')
  getReinsuranceAccountingIntegration(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.role === 'TENANT_ADMIN' && id !== req.user.tenantId) {
      throw new ForbiddenException('You can only access your own company.');
    }
    return this.config.getReinsuranceAccountingIntegration(id);
  }

  @Patch(':id/integrations/reinsurance-accounting')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  updateReinsuranceAccountingIntegration(
    @Param('id') id: string,
    @Body() dto: { enabled: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.config.updateReinsuranceAccountingIntegration(
      id,
      Boolean(dto.enabled),
      req.user.id,
    );
  }

  @Patch(':id/features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Update feature config for a module within a company — SuperAdmin or Tenant Admin',
  })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({
    schema: {
      example: {
        module: 'hr',
        features: { leave: true, payroll: true, time: false },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Feature config updated' })
  @ApiResponse({
    status: 400,
    description: 'At least one feature must remain enabled',
  })
  updateFeatures(
    @Param('id') id: string,
    @Body() dto: { module: string; features: Record<string, boolean> },
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.role === 'TENANT_ADMIN' && id !== req.user.tenantId) {
      throw new ForbiddenException(
        'You can only update features for your own company.',
      );
    }
    return this.config.updateFeatures(
      id,
      dto.module,
      dto.features,
      req.user.id,
    );
  }

  @Get(':id/feature-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get feature configuration change history for a company',
  })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Feature history returned' })
  getFeatureHistory(@Param('id') id: string) {
    return this.config.getFeatureHistory(id);
  }

  @Post(':id/admin/resend-invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend invite to pending Company Admin — SuperAdmin only',
  })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({
    status: 200,
    description:
      'Invite resent successfully. Previous invite link is invalidated.',
    schema: { example: { message: 'Invitation resent successfully' } },
  })
  @ApiResponse({
    status: 404,
    description: 'No pending admin found for this company',
  })
  async resendAdminInvite(@Param('id') tenantId: string) {
    return this.admin.resendAdminInvite(tenantId);
  }

  private assertBrandingAccess(tenantId: string, user: RequestUser): void {
    if (user.role === 'TENANT_ADMIN' && tenantId !== user.tenantId) {
      throw new ForbiddenException(
        'You can only manage branding for your own company.',
      );
    }
  }

  private requireOwnTenantId(user: RequestUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException(
        'Tenant branding self-service requires a tenant-scoped user.',
      );
    }
    return user.tenantId;
  }
}
