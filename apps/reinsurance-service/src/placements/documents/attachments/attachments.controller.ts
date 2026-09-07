import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../../../auth/decorators/feature.decorator';
import { RequireModule } from '../../../auth/decorators/module.decorator';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../../../auth/guards/feature.guard';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../../auth/guards/module.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../../dto/placement-response.dto';
import {
  PlacementAttachmentListResponseDto,
  PlacementAttachmentResponseDto,
} from '../../dto/placement-attachment-response.dto';
import { PlacementDocumentDownloadUrlDto } from '../../dto/placement-document-download-url.dto';
import { UploadPlacementAttachmentDto } from '../../dto/upload-placement-attachment.dto';
import { VoidPlacementAttachmentDto } from '../../dto/void-placement-attachment.dto';
import {
  AttachmentParentRef,
  PlacementAttachmentsService,
} from './attachments.service';
import { PlacementPermission } from '../../placement.permissions';

const FILE_LIMIT_BYTES = 25 * 1024 * 1024;

@Controller('placements')
@ApiTags('Reinsurance - Attachments')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Module, feature or required permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class PlacementAttachmentsController {
  constructor(
    private readonly attachmentsService: PlacementAttachmentsService,
  ) {}

  @Post(':id/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a placement-level attachment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  uploadPlacement(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(request.user, id, { type: 'PLACEMENT' }, file, dto);
  }

  @Get(':id/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List placement-level attachments' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listPlacement(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, { type: 'PLACEMENT' });
  }

  @Get(':id/attachments/:attachmentId/download-url')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for placement attachment',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'attachmentId', format: 'uuid' })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadPlacement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'PLACEMENT' },
      attachmentId,
    );
  }

  @Post(':id/attachments/:attachmentId/void')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void placement attachment record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'attachmentId', format: 'uuid' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidPlacement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'PLACEMENT' },
      attachmentId,
      dto,
    );
  }

  @Post(':id/participants/:participantId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload participant attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'PARTICIPANT', id: participantId },
      file,
      dto,
    );
  }

  @Get(':id/participants/:participantId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List participant attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'PARTICIPANT',
      id: participantId,
    });
  }

  @Get(':id/participants/:participantId/attachments/:attachmentId/download-url')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for participant attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'PARTICIPANT', id: participantId },
      attachmentId,
    );
  }

  @Post(':id/participants/:participantId/attachments/:attachmentId/void')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void participant attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'PARTICIPANT', id: participantId },
      attachmentId,
      dto,
    );
  }

  @Post(':id/closings/:closingId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload closing attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'CLOSING', id: closingId },
      file,
      dto,
    );
  }

  @Get(':id/closings/:closingId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List closing attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'CLOSING',
      id: closingId,
    });
  }

  @Get(':id/closings/:closingId/attachments/:attachmentId/download-url')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for closing attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'CLOSING', id: closingId },
      attachmentId,
    );
  }

  @Post(':id/closings/:closingId/attachments/:attachmentId/void')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void closing attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'CLOSING', id: closingId },
      attachmentId,
      dto,
    );
  }

  @Post(':id/endorsements/:endorsementId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload endorsement attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'ENDORSEMENT', id: endorsementId },
      file,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List endorsement attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'ENDORSEMENT',
      id: endorsementId,
    });
  }

  @Get(':id/endorsements/:endorsementId/attachments/:attachmentId/download-url')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for endorsement attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'ENDORSEMENT', id: endorsementId },
      attachmentId,
    );
  }

  @Post(':id/endorsements/:endorsementId/attachments/:attachmentId/void')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void endorsement attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'ENDORSEMENT', id: endorsementId },
      attachmentId,
      dto,
    );
  }

  @Post(
    ':id/endorsements/:endorsementId/participants/:participantId/attachments',
  )
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload endorsement participant attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'ENDORSEMENT_PARTICIPANT', id: participantId, endorsementId },
      file,
      dto,
    );
  }

  @Get(
    ':id/endorsements/:endorsementId/participants/:participantId/attachments',
  )
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List endorsement participant attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'ENDORSEMENT_PARTICIPANT',
      id: participantId,
      endorsementId,
    });
  }

  @Get(
    ':id/endorsements/:endorsementId/participants/:participantId/attachments/:attachmentId/download-url',
  )
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary:
      'Create signed download URL for endorsement participant attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'ENDORSEMENT_PARTICIPANT', id: participantId, endorsementId },
      attachmentId,
    );
  }

  @Post(
    ':id/endorsements/:endorsementId/participants/:participantId/attachments/:attachmentId/void',
  )
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void endorsement participant attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'ENDORSEMENT_PARTICIPANT', id: participantId, endorsementId },
      attachmentId,
      dto,
    );
  }

  @Post(':id/endorsements/:endorsementId/closings/:closingId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload endorsement closing attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadEndorsementClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'ENDORSEMENT_CLOSING', id: closingId, endorsementId },
      file,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/closings/:closingId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List endorsement closing attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listEndorsementClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'ENDORSEMENT_CLOSING',
      id: closingId,
      endorsementId,
    });
  }

  @Get(
    ':id/endorsements/:endorsementId/closings/:closingId/attachments/:attachmentId/download-url',
  )
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for endorsement closing attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadEndorsementClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'ENDORSEMENT_CLOSING', id: closingId, endorsementId },
      attachmentId,
    );
  }

  @Post(
    ':id/endorsements/:endorsementId/closings/:closingId/attachments/:attachmentId/void',
  )
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void endorsement closing attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidEndorsementClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'ENDORSEMENT_CLOSING', id: closingId, endorsementId },
      attachmentId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload claim attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'CLAIM', id: claimId },
      file,
      dto,
    );
  }

  @Get(':id/claims/:claimId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List claim attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, { type: 'CLAIM', id: claimId });
  }

  @Get(':id/claims/:claimId/attachments/:attachmentId/download-url')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Create signed download URL for claim attachment' })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'CLAIM', id: claimId },
      attachmentId,
    );
  }

  @Post(':id/claims/:claimId/attachments/:attachmentId/void')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void claim attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'CLAIM', id: claimId },
      attachmentId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/cash-calls/:cashCallId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload cash call attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'CASH_CALL', id: cashCallId, claimId },
      file,
      dto,
    );
  }

  @Get(':id/claims/:claimId/cash-calls/:cashCallId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List cash call attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'CASH_CALL',
      id: cashCallId,
      claimId,
    });
  }

  @Get(
    ':id/claims/:claimId/cash-calls/:cashCallId/attachments/:attachmentId/download-url',
  )
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for cash call attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'CASH_CALL', id: cashCallId, claimId },
      attachmentId,
    );
  }

  @Post(
    ':id/claims/:claimId/cash-calls/:cashCallId/attachments/:attachmentId/void',
  )
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void cash call attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'CASH_CALL', id: cashCallId, claimId },
      attachmentId,
      dto,
    );
  }

  @Post(':id/payments/:paymentId/attachments')
  @RequirePermissions(PlacementPermission.EDIT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload payment attachment' })
  @ApiBody({ schema: uploadSchema() })
  @ApiCreatedResponse({ type: PlacementAttachmentResponseDto })
  uploadPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.upload(
      request.user,
      id,
      { type: 'PAYMENT', id: paymentId },
      file,
      dto,
    );
  }

  @Get(':id/payments/:paymentId/attachments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'List payment attachments' })
  @ApiOkResponse({ type: PlacementAttachmentListResponseDto })
  listPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.list(request.user.tenantId, id, {
      type: 'PAYMENT',
      id: paymentId,
    });
  }

  @Get(':id/payments/:paymentId/attachments/:attachmentId/download-url')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create signed download URL for payment attachment',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  downloadPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.download(
      request.user.tenantId,
      id,
      { type: 'PAYMENT', id: paymentId },
      attachmentId,
    );
  }

  @Post(':id/payments/:paymentId/attachments/:attachmentId/void')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Void payment attachment record' })
  @ApiOkResponse({ type: PlacementAttachmentResponseDto })
  voidPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: VoidPlacementAttachmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.void(
      request.user,
      id,
      { type: 'PAYMENT', id: paymentId },
      attachmentId,
      dto,
    );
  }

  private async upload(
    user: RequestUser,
    placementId: string,
    parent: AttachmentParentRef,
    file: Express.Multer.File | undefined,
    dto: UploadPlacementAttachmentDto,
  ) {
    return this.attachmentsService.upload(user, placementId, parent, file, dto);
  }

  private async list(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
  ) {
    const items = await this.attachmentsService.findAll(
      tenantId,
      placementId,
      parent,
    );
    return { items };
  }

  private download(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
    attachmentId: string,
  ) {
    return this.attachmentsService.createDownloadUrl(
      tenantId,
      placementId,
      parent,
      attachmentId,
    );
  }

  private void(
    user: RequestUser,
    placementId: string,
    parent: AttachmentParentRef,
    attachmentId: string,
    dto: VoidPlacementAttachmentDto,
  ) {
    return this.attachmentsService.void(
      user,
      placementId,
      parent,
      attachmentId,
      dto,
    );
  }
}

function uploadSchema() {
  return {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description:
          'Private supporting file. Allowed MIME types are configurable; default max size is 25MB.',
      },
      title: {
        type: 'string',
        example: 'Signed policy schedule',
      },
      description: {
        type: 'string',
        example: 'Cedant-supplied supporting schedule.',
      },
    },
  };
}
