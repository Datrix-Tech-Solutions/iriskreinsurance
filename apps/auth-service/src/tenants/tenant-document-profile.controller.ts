import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateTenantBankAccountDto,
  TenantBankAccountResponseDto,
  TenantDocumentProfileResponseDto,
  UpdateTenantBankAccountDto,
  UpsertTenantDocumentProfileDto,
} from './dto/tenant-document-profile.dto';
import { TenantDocumentProfileService } from './tenant-document-profile.service';

type AuthenticatedRequest = Request & { user: RequestUser };

const assetUploadSchema = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description: 'Private PNG, JPEG or WEBP image.',
    },
  },
};

@ApiTags('Tenant Document Profile')
@ApiBearerAuth('access-token')
@Controller('tenants/:tenantId/document-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN')
export class TenantDocumentProfileController {
  constructor(private readonly profiles: TenantDocumentProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Get tenant document profile and bank accounts',
    description:
      'Returns tenant-derived defaults when no document profile has been saved. Private object keys are visible only to authorized tenant administrators and are never converted to public URLs.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkResponse({ type: TenantDocumentProfileResponseDto })
  @ApiForbiddenResponse({ description: 'Cross-tenant access denied.' })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  get(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.get(tenantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Create or update tenant document profile',
    description:
      'Upserts document identity/contact/signatory metadata and increments the profile version. Existing TenantBranding colors are not modified.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiBody({ type: UpsertTenantDocumentProfileDto })
  @ApiOkResponse({ type: TenantDocumentProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid profile values.' })
  @ApiForbiddenResponse({ description: 'Cross-tenant access denied.' })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  upsert(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpsertTenantDocumentProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.upsert(tenantId, request.user.id, dto);
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload private tenant document logo',
    description:
      'Uploads a private image to S3, stores only its object key and metadata, and increments the document profile version.',
  })
  @ApiBody({ schema: assetUploadSchema })
  @ApiOkResponse({ type: TenantDocumentProfileResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing, unsupported or oversized image.',
  })
  uploadLogo(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.uploadAsset(tenantId, request.user.id, 'logo', file);
  }

  @Post('signature')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload private authorized-signatory image',
    description:
      'Uploads a private signature image to S3, stores only its object key and metadata, and increments the document profile version.',
  })
  @ApiBody({ schema: assetUploadSchema })
  @ApiOkResponse({ type: TenantDocumentProfileResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing, unsupported or oversized image.',
  })
  uploadSignature(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.uploadAsset(
      tenantId,
      request.user.id,
      'signature',
      file,
    );
  }

  @Get('bank-accounts')
  @ApiOperation({ summary: 'List tenant document bank accounts' })
  @ApiOkResponse({ type: [TenantBankAccountResponseDto] })
  listBankAccounts(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.listBankAccounts(tenantId);
  }

  @Post('bank-accounts')
  @ApiOperation({
    summary: 'Add tenant document bank account',
    description:
      'Adds an active/inactive account. Setting it as default atomically clears the previous active default for the same currency.',
  })
  @ApiCreatedResponse({ type: TenantBankAccountResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid bank account values.' })
  createBankAccount(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateTenantBankAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.createBankAccount(tenantId, request.user.id, dto);
  }

  @Patch('bank-accounts/:accountId')
  @ApiOperation({ summary: 'Update tenant document bank account' })
  @ApiParam({ name: 'accountId', format: 'uuid' })
  @ApiOkResponse({ type: TenantBankAccountResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant or bank account not found.' })
  updateBankAccount(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateTenantBankAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.updateBankAccount(
      tenantId,
      accountId,
      request.user.id,
      dto,
    );
  }

  @Post('bank-accounts/:accountId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate tenant document bank account',
    description:
      'Retains the account for audit history and clears its default flag.',
  })
  @ApiParam({ name: 'accountId', format: 'uuid' })
  @ApiOkResponse({ type: TenantBankAccountResponseDto })
  deactivateBankAccount(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertAccess(tenantId, request.user);
    return this.profiles.deactivateBankAccount(
      tenantId,
      accountId,
      request.user.id,
    );
  }

  private assertAccess(tenantId: string, user: RequestUser): void {
    if (user.role === 'TENANT_ADMIN' && tenantId !== user.tenantId) {
      throw new ForbiddenException(
        'You can only manage document settings for your own company.',
      );
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
      throw new ForbiddenException(
        'Only Super Admins and Tenant Admins can manage document settings.',
      );
    }
  }
}
