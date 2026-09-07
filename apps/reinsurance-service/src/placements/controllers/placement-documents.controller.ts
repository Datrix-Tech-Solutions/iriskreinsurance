import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../../auth/decorators/feature.decorator';
import { RequireModule } from '../../auth/decorators/module.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../../auth/guards/feature.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../dto/placement-response.dto';
import {
  PlacementDocumentListResponseDto,
  PlacementDocumentResponseDto,
} from '../dto/placement-document-response.dto';
import { PlacementDocumentDownloadUrlDto } from '../dto/placement-document-download-url.dto';
import { VoidPlacementDocumentDto } from '../dto/void-placement-document.dto';
import { PlacementDocumentsService } from '../documents/documents.service';
import { PlacementPermission } from '../placement.permissions';

@Controller('placements')
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
export class PlacementDocumentsController {
  constructor(private readonly documentsService: PlacementDocumentsService) {}

  @Get(':id/documents')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement document registry entries',
    description:
      'Returns generated document registry rows for the placement, including immutable source snapshots, status/version metadata and backend-rendered document references where available.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementDocumentListResponseDto })
  async findDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.documentsService.findAll(
      request.user.tenantId,
      id,
    );
    return { items };
  }

  @Get(':id/documents/:documentId')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get placement document registry entry',
    description:
      'Returns one generated document registry row including sourceSnapshot and renderPayload. VOID documents remain readable.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Placement document ID.',
  })
  @ApiOkResponse({ type: PlacementDocumentResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or document is missing, archived or belongs to another tenant.',
  })
  findDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.findOne(request.user.tenantId, id, documentId);
  }

  @Post(':id/documents/:documentId/render-pdf')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Render a placement document as PDF',
    description:
      'Renders an existing generated OFFER_SLIP, CLOSING_SLIP, placement debit/credit note or endorsement debit/credit note registry row to a PDF using PlacementDocument.renderPayload only. The immutable sourceSnapshot and renderPayload are not mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Placement document ID.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Rendered closing slip PDF.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The document is VOID, unsupported for PDF rendering or has an invalid renderPayload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or document is missing, archived or belongs to another tenant.',
  })
  async renderDocumentPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const pdf = await this.documentsService.renderPdf(
      request.user.tenantId,
      id,
      documentId,
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="placement-document-${documentId}.pdf"`,
    });
  }

  @Post(':id/documents/:documentId/render-and-store')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Render and store a placement document PDF in private S3',
    description:
      'Renders a supported generated placement document from PlacementDocument.renderPayload, uploads the PDF to private S3, stores object metadata and checksum on the document row, and returns the updated registry entry. Existing stored PDFs are not overwritten in the MVP.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Placement document ID.',
  })
  @ApiOkResponse({ type: PlacementDocumentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The document is VOID, unsupported for PDF rendering or has invalid renderPayload.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'The document already has stored PDF metadata.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or document is missing, archived or belongs to another tenant.',
  })
  renderAndStoreDocumentPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.renderAndStorePdf(
      request.user.tenantId,
      id,
      documentId,
    );
  }

  @Get(':id/documents/:documentId/download-url')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Create a short-lived signed document download URL',
    description:
      'Returns a private, short-lived signed URL for a stored document PDF. No public URL is stored on PlacementDocument, and VOID documents remain downloadable if they already have stored object metadata.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Placement document ID.',
  })
  @ApiOkResponse({ type: PlacementDocumentDownloadUrlDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'The document PDF has not been stored yet.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or document is missing, archived or belongs to another tenant.',
  })
  getDocumentDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.createDownloadUrl(
      request.user.tenantId,
      id,
      documentId,
    );
  }

  @Post(':id/documents/:documentId/void')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Void placement document registry entry',
    description:
      'Marks a generated document registry entry VOID with a reason. The row remains readable and document numbers are never reused.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Placement document ID.',
  })
  @ApiOkResponse({ type: PlacementDocumentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'The document is already VOID or the void reason is empty.',
  })
  voidDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: VoidPlacementDocumentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.void(request.user, id, documentId, dto);
  }

  @Post(':id/documents/offer-slip')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate offer slip document registry entry',
    description:
      'Creates a GENERATED OFFER_SLIP document row from the current offer slip preview payload. This does not render a PDF, upload to S3 or email the slip.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateOfferSlipDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateOfferSlip(request.user, id);
  }

  @Post(':id/participants/:participantId/documents/offer-slip')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate participant-scoped offer slip document registry entry',
    description:
      'Creates or reuses an active GENERATED OFFER_SLIP document row scoped to one placement reinsurer. The payload is addressed/contextualized to that participant, can be rendered through the shared render-pdf endpoint, and does not mutate placement or participant records.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is missing, archived or belongs to another tenant.',
  })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The participant is not a reinsurer eligible for an offer slip.',
  })
  generateParticipantOfferSlipDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateParticipantOfferSlip(
      request.user,
      id,
      participantId,
    );
  }

  @Post(':id/closings/:closingId/documents/closing-slip')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate placement closing slip document registry entry',
    description:
      'Creates a GENERATED CLOSING_SLIP document row from the immutable PlacementClosing snapshot.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Placement closing ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateClosingSlipDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateClosingSlip(
      request.user,
      id,
      closingId,
    );
  }

  @Post(':id/notes/:noteId/documents')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate note document registry entry',
    description:
      'Creates a generated placement or endorsement debit/credit note document row from immutable PlacementNote values. The endpoint infers the document type from the note record and captures placement, closing, endorsement and counterparty context for PDF rendering.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateNoteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateNoteDocument(request.user, id, noteId);
  }

  @Post(':id/endorsements/:endorsementId/documents/endorsement-slip')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate endorsement slip document registry entry',
    description:
      'Creates a GENERATED ENDORSEMENT_SLIP document row from the endorsement version snapshot. Original placement records are not mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateEndorsementSlipDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateEndorsementSlip(
      request.user,
      id,
      endorsementId,
    );
  }

  @Post(
    ':id/endorsements/:endorsementId/closings/:closingId/documents/closing-slip',
  )
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate endorsement closing slip document registry entry',
    description:
      'Creates a GENERATED CLOSING_SLIP document row from the immutable PlacementEndorsementClosing snapshot.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Endorsement closing ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateEndorsementClosingSlipDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateEndorsementClosingSlip(
      request.user,
      id,
      endorsementId,
      closingId,
    );
  }

  @Post(
    ':id/endorsements/:endorsementId/closings/:closingId/documents/endorsement-certificate',
  )
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate endorsement certificate document registry entry',
    description:
      'Creates or reuses an active GENERATED ENDORSEMENT_CERTIFICATE document row from a confirmed PlacementEndorsementClosing snapshot. The original placement and original closing records are not mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Confirmed endorsement closing ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateEndorsementCertificateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateEndorsementCertificate(
      request.user,
      id,
      endorsementId,
      closingId,
    );
  }

  @Post(':id/claims/:claimId/documents/claim-notice')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate claim notice document registry entry',
    description:
      'Creates a GENERATED CLAIM_NOTICE document row from the PlacementClaim snapshot.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateClaimNoticeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateClaimNotice(request.user, id, claimId);
  }

  @Post(':id/claims/:claimId/cash-calls/:cashCallId/documents')
  @ApiTags('Reinsurance - Documents')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate claim cash call document registry entry',
    description:
      'Creates a GENERATED CLAIM_CASH_CALL document row from the PlacementClaimCashCall snapshot.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'cashCallId',
    format: 'uuid',
    description: 'Claim cash call ID.',
  })
  @ApiCreatedResponse({ type: PlacementDocumentResponseDto })
  generateClaimCashCallDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.documentsService.generateClaimCashCall(
      request.user,
      id,
      claimId,
      cashCallId,
    );
  }
}
