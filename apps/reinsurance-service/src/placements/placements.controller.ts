import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementPaymentDirection,
  PlacementPaymentType,
  PlacementStatus,
} from '../../prisma/generated/client';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { assertUserHasAnyPermission } from '../auth/permissions/permission-assertions';
import {
  ApiErrorResponseDto,
  PaginatedPlacementsResponseDto,
  PlacementResponseDto,
} from './dto/placement-response.dto';
import { EffectivePlacementViewResponseDto } from './dto/placement-effective-view-response.dto';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import {
  PlacementClosingListResponseDto,
  PlacementClosingResponseDto,
} from './dto/placement-closing-response.dto';
import { UpdatePlacementClosingStatusDto } from './dto/update-placement-closing-status.dto';
import { PlacementClosingsService } from './closings/closings.service';
import {
  CreateEffectiveDebitNoteDto,
  EffectiveDebitNoteListResponseDto,
  EffectiveDebitNotePreviewResponseDto,
  EffectiveDebitNoteQueryDto,
} from './dto/effective-debit-note.dto';
import {
  PlacementNoteListResponseDto,
  PlacementNoteResponseDto,
} from './dto/placement-note-response.dto';
import { UpdatePlacementNoteStatusDto } from './dto/update-placement-note-status.dto';
import { VoidPlacementNoteDto } from './dto/void-placement-note.dto';
import { PlacementNotesService } from './transactions/notes.service';
import {
  PlacementPaymentListResponseDto,
  PlacementPaymentResponseDto,
} from './dto/placement-payment-response.dto';
import { PlacementFinancialPositionResponseDto } from './dto/placement-financial-position-response.dto';
import { CancelPlacementPaymentDto } from './dto/cancel-placement-payment.dto';
import { ConfirmPlacementPaymentBankDto } from './dto/confirm-placement-payment-bank.dto';
import { CreatePlacementPaymentDto } from './dto/create-placement-payment.dto';
import { PlacementFinancialPositionService } from './finance/financial-position.service';
import { PlacementPaymentsService } from './transactions/payments.service';
import { PlacementLockStatusDto } from './dto/placement-lock-status.dto';
import {
  ClosingSlipPreviewResponseDto,
  OfferSlipPreviewResponseDto,
} from './dto/slip-preview-response.dto';
import { AcceptPlacementParticipantResponseDto } from './dto/accept-placement-participant-response.dto';
import { ArchivePlacementDto } from './dto/archive-placement.dto';
import { CreatePlacementParticipantDto } from './dto/create-placement-participant.dto';
import { CreatePlacementDto } from './dto/create-placement.dto';
import { QueryPlacementsDto } from './dto/query-placements.dto';
import { UpdatePlacementParticipantStatusDto } from './dto/update-placement-participant-status.dto';
import { UpdatePlacementParticipantDto } from './dto/update-placement-participant.dto';
import { UpdatePlacementStatusDto } from './dto/update-placement-status.dto';
import { UpdatePlacementDto } from './dto/update-placement.dto';
import {
  FacultativeOfferPermission,
  PlacementPermission,
  PremiumPermission,
} from './placement.permissions';
import { PlacementsService } from './placements.service';

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
export class PlacementsController {
  constructor(
    private readonly placementsService: PlacementsService,
    private readonly closingsService: PlacementClosingsService,
    private readonly effectiveViewService: PlacementEffectiveViewService,
    private readonly notesService: PlacementNotesService,
    private readonly paymentsService: PlacementPaymentsService,
    private readonly financialPositionService: PlacementFinancialPositionService,
  ) {}

  @Get('payments/pending-bank-confirmation')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List payments awaiting Accounting financial confirmation',
    description:
      'Returns tenant-scoped RECORDED inbound premium receipts and outbound reinsurer disbursements that Accounting must confirm before financial recognition and posting begin.',
  })
  @ApiOkResponse({ type: PlacementPaymentListResponseDto })
  async findPendingBankConfirmationPayments(
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.paymentsService.findPendingBankConfirmations(
      request.user.tenantId,
    );
    return { items };
  }

  @Get(':id/effective-view')
  @ApiTags('Reinsurance - Placements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get effective placement view',
    description:
      'Returns the read-only effective placement state after confirmed endorsement closings. ' +
      'Original placement records remain immutable; DRAFT, MARKETING and otherwise unconfirmed endorsement activity is reported as pending.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiQuery({
    name: 'asOfDate',
    required: false,
    description:
      'Optional ISO date/time for historical effective-view reconstruction. Defaults to now.',
  })
  @ApiOkResponse({ type: EffectivePlacementViewResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  getEffectiveView(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('asOfDate') asOfDate: string | undefined,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.effectiveViewService.getEffectiveView(
      request.user.tenantId,
      id,
      asOfDate,
    );
  }

  @Get()
  @ApiTags('Reinsurance - Placements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List facultative placements',
    description:
      'Returns active placements by default. Pass archived=true to return archived placements only. ' +
      'Both modes are tenant-scoped and support the same filters and pagination.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'FAC-2026' })
  @ApiQuery({
    name: 'archived',
    required: false,
    schema: { type: 'boolean', default: false },
    description: 'When true, returns archived placements only.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PlacementStatus,
  })
  @ApiQuery({
    name: 'statuses',
    required: false,
    enum: PlacementStatus,
    isArray: true,
    description:
      'Comma-separated placement lifecycle statuses. Applied before pagination.',
  })
  @ApiQuery({
    name: 'placementType',
    required: false,
    enum: ['FACULTATIVE'],
  })
  @ApiQuery({
    name: 'cedantId',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ type: PaginatedPlacementsResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid query filter or pagination value.',
  })
  findAll(
    @Query() query: QueryPlacementsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.findAll(request.user.tenantId, query);
  }

  @Post()
  @ApiTags('Reinsurance - Placements')
  @RequireAnyPermission(
    FacultativeOfferPermission.CREATE_OFFER,
    PlacementPermission.CREATE,
  )
  @ApiOperation({
    summary: 'Create a facultative placement',
    description:
      'Creates a DRAFT placement linked to an active tenant-owned cedant counterparty. Fixed placement fields remain column-backed, while class-specific fields should be supplied under businessDetails and offerDetails based on classOfBusiness.',
  })
  @ApiCreatedResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid payload, missing cedant or invalid participant role.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active placement with this reference already exists.',
  })
  create(
    @Body() dto: CreatePlacementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.create(request.user, dto);
  }

  @Get(':id')
  @ApiTags('Reinsurance - Placements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Get an active placement by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.findOne(request.user.tenantId, id);
  }

  @Get(':id/lock-status')
  @ApiTags('Reinsurance - Financial Locking')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get placement financial lock status',
    description:
      'Returns the current direct-edit policy decision for this placement. ' +
      'Lifecycle locks (for example CLOSED/CANCELLED) are distinct from financial locks. ' +
      'Only actual payment or settlement activity will hard-lock a placement; debit note issuance alone is not a hard lock in the MVP policy. ' +
      'When locked=true, future business changes require the future endorsement workflow.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementLockStatusDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  getLockStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.getLockStatus(request.user.tenantId, id);
  }

  @Get(':id/endorsements/:endorsementId/notes')
  @ApiTags('Reinsurance - Endorsement Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List endorsement debit and credit notes',
    description:
      'Returns endorsement-scoped debit/credit note records generated from confirmed endorsement closing snapshots. ' +
      'Endorsement notes do not mutate original placement notes, closings or participants.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementNoteListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is archived, missing or belongs to another tenant/placement.',
  })
  async findEndorsementNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.notesService.findAllEndorsementNotes(
      request.user.tenantId,
      id,
      endorsementId,
    );
    return { items };
  }

  @Get(':id/endorsements/:endorsementId/notes/:noteId')
  @ApiTags('Reinsurance - Endorsement Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get an endorsement note',
    description:
      'Returns one endorsement debit or credit note scoped to the authenticated tenant, placement and endorsement.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Endorsement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The endorsement note is missing or belongs to another tenant/placement/endorsement.',
  })
  findEndorsementNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.findEndorsementNote(
      request.user.tenantId,
      id,
      endorsementId,
      noteId,
    );
  }

  @Post(':id/endorsements/:endorsementId/notes/debit')
  @ApiTags('Reinsurance - Endorsement Notes')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Create endorsement debit note',
    description:
      'Creates a DRAFT endorsement debit note for the cedant from all CONFIRMED endorsement closing snapshots. ' +
      'Only one active endorsement debit note is allowed per endorsement; VOID notes are inactive and retain their numbers.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'No confirmed endorsement closing exists or required closing currency/amount data is missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active endorsement debit note already exists for this endorsement.',
  })
  createEndorsementDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createEndorsementDebitNote(
      request.user,
      id,
      endorsementId,
    );
  }

  @Post(':id/endorsements/:endorsementId/closings/:closingId/notes/credit')
  @ApiTags('Reinsurance - Endorsement Notes')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Create endorsement closing credit note',
    description:
      'Creates a DRAFT endorsement credit note for one CONFIRMED endorsement closing and its reinsurer. ' +
      'Values are copied from PlacementEndorsementClosing snapshots; original placement records are not recalculated or mutated.',
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
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Endorsement closing is not CONFIRMED, is missing snapshot data, or does not belong to a reinsurer.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active endorsement credit note already exists for this endorsement closing.',
  })
  createEndorsementCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createEndorsementCreditNote(
      request.user,
      id,
      endorsementId,
      closingId,
    );
  }

  @Patch(':id/endorsements/:endorsementId/notes/:noteId/status')
  @ApiTags('Reinsurance - Endorsement Notes')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Issue a draft endorsement note',
    description:
      'Only DRAFT → ISSUED is supported. VOID uses the dedicated void endpoint. Settlement is deferred.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Endorsement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported note status transition.',
  })
  issueEndorsementNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdatePlacementNoteStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.issueEndorsementNote(
      request.user,
      id,
      endorsementId,
      noteId,
      dto,
    );
  }

  @Post(':id/endorsements/:endorsementId/notes/:noteId/void')
  @ApiTags('Reinsurance - Endorsement Notes')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Void a draft or issued endorsement note',
    description:
      'Moves DRAFT or ISSUED endorsement notes to VOID with a required void reason. VOID is terminal.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Endorsement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Void reason is missing or note is already terminal.',
  })
  voidEndorsementNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: VoidPlacementNoteDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.voidEndorsementNote(
      request.user,
      id,
      endorsementId,
      noteId,
      dto,
    );
  }

  @Get(':id/notes')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement debit and credit notes',
    description:
      'Returns debit/credit note records generated from confirmed closing snapshots. ' +
      'Notes do not financially lock placements; payments remain the only hard lock trigger.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementNoteListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  async findNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.notesService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/notes/:noteId')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement note',
    description:
      'Returns one debit or credit note. The note must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or note is archived, missing or belongs to another tenant.',
  })
  findNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.findOne(request.user.tenantId, id, noteId);
  }

  @Post(':id/notes/debit')
  @ApiTags('Reinsurance - Debit Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create placement debit note',
    description:
      'Creates a DRAFT placement-level debit note for the cedant from all CONFIRMED closing snapshots. ' +
      'A debit note does not create a payment and does not financially lock the placement. ' +
      'Only one active debit note is allowed per placement; VOID notes are inactive and retain their numbers.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'No confirmed closing exists or required closing currency/amount data is missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active debit note already exists for this placement.',
  })
  createDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createDebitNote(request.user, id);
  }

  @Post(':id/closings/:closingId/notes/credit')
  @ApiTags('Reinsurance - Credit Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create placement closing credit note',
    description:
      'Creates a DRAFT credit note for one CONFIRMED closing and its reinsurer participant. ' +
      'Values are copied from PlacementClosing snapshots; live participant values are not recalculated. ' +
      'Only one active credit note is allowed per closing; VOID notes are inactive and retain their numbers.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Confirmed placement closing ID.',
  })
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Closing is not CONFIRMED, is missing snapshot data, or does not belong to a reinsurer.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active credit note already exists for this closing.',
  })
  createCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createCreditNote(request.user, id, closingId);
  }

  @Get(':id/effective-debit-note/preview')
  @ApiTags('Reinsurance - Debit Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Preview current effective debit note',
    description:
      'Returns a non-persisted backend-truth preview of the consolidated current-effective cedant debit-note statement. ' +
      'The statement includes original confirmed business plus CLOSED effective endorsements as of the requested date. ' +
      'It is non-posting because original and endorsement-adjustment notes carry financial recognition.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiQuery({
    name: 'asOfDate',
    required: false,
    description:
      'Optional ISO date/time. Future-dated closed endorsements are excluded unless the as-of date reaches them.',
  })
  @ApiOkResponse({ type: EffectiveDebitNotePreviewResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The as-of date is invalid or the current effective cedant obligation is not positive.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The effective debit note contains multiple currencies and cannot be aggregated safely.',
  })
  previewEffectiveDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EffectiveDebitNoteQueryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.previewCurrentEffectiveDebitNote(
      request.user.tenantId,
      id,
      query.asOfDate,
    );
  }

  @Post(':id/effective-debit-note')
  @ApiTags('Reinsurance - Debit Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create current effective debit note',
    description:
      'Creates or reuses a DRAFT current-effective debit-note statement for the same deterministic effective business version. ' +
      'The note is explicitly non-posting, so issuing it does not enqueue an Accounting event and cannot duplicate AR recognition.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiBody({ type: CreateEffectiveDebitNoteDto })
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The as-of date is invalid or the current effective cedant obligation is not positive.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The effective debit note contains multiple currencies and cannot be aggregated safely.',
  })
  createEffectiveDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEffectiveDebitNoteDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createCurrentEffectiveDebitNote(
      request.user,
      id,
      dto.asOfDate,
    );
  }

  @Get(':id/effective-debit-notes')
  @ApiTags('Reinsurance - Debit Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List current effective debit notes',
    description:
      'Lists persisted current-effective debit-note statement versions for the placement. Historical versions remain immutable.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: EffectiveDebitNoteListResponseDto })
  async findEffectiveDebitNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.notesService.findAllCurrentEffectiveDebitNotes(
      request.user.tenantId,
      id,
    );
    return { items };
  }

  @Get(':id/effective-debit-notes/:noteId')
  @ApiTags('Reinsurance - Debit Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get current effective debit note',
    description:
      'Returns a persisted current-effective debit-note statement version scoped to the authenticated tenant and placement.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Current effective debit note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  findEffectiveDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.findCurrentEffectiveDebitNote(
      request.user.tenantId,
      id,
      noteId,
    );
  }

  @Patch(':id/notes/:noteId/status')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Issue a draft placement note',
    description:
      'Only DRAFT → ISSUED is supported. VOID uses the dedicated void endpoint. Settlement is deferred.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported note status transition.',
  })
  issueNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdatePlacementNoteStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.issue(request.user, id, noteId, dto);
  }

  @Post(':id/notes/:noteId/void')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Void a draft or issued placement note',
    description:
      'Moves DRAFT or ISSUED notes to VOID with a required void reason. VOID is terminal. Voiding a note does not unlock a placement.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Void reason is missing or note is already terminal.',
  })
  voidNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: VoidPlacementNoteDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.void(request.user, id, noteId, dto);
  }

  @Get(':id/financial-position')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get placement financial position',
    description:
      'Returns the current effective premium obligation and settlement position for the placement. ' +
      'Original closings, effective endorsement closing snapshots and immutable payment/reversal records are projected without mutating historical records.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiQuery({
    name: 'asOfDate',
    required: false,
    description:
      'Optional ISO date/time for historical or future financial-position reconstruction. Defaults to now.',
  })
  @ApiOkResponse({ type: PlacementFinancialPositionResponseDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The position contains multiple currencies and cannot be aggregated safely.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  getFinancialPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('asOfDate') asOfDate: string | undefined,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.financialPositionService.getFinancialPosition(
      request.user.tenantId,
      id,
      asOfDate,
    );
  }

  @Get(':id/payments')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement payments',
    description:
      'Returns immutable payment and reversal records for a placement. ' +
      'Read-only payment history remains available after the placement is financially locked.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementPaymentListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  async findPayments(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.paymentsService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/payments/:paymentId')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement payment',
    description:
      'Returns one payment or reversal record. The payment must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'paymentId',
    format: 'uuid',
    description: 'Placement payment ID.',
  })
  @ApiOkResponse({ type: PlacementPaymentResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or payment is archived, missing or belongs to another tenant.',
  })
  findPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.findOne(request.user.tenantId, id, paymentId);
  }

  @Post(':id/payments')
  @ApiTags('Reinsurance - Payments')
  @RequireAnyPermission(
    PremiumPermission.RECEIVE_FROM_CEDANT,
    PremiumPermission.DISBURSE_TO_REINSURER,
    PlacementPermission.CREATE,
  )
  @ApiOperation({
    summary: 'Record a placement payment',
    description:
      'Records the first payment foundation financial fact for a placement. ' +
      'The first recorded payment financially locks the placement and future direct placement/participant edits return 409 until endorsements are implemented. ' +
      'Payment creation remains allowed after lock so additional receipts/disbursements can be recorded. ' +
      'Premium received is placement-level and must come from the cedant. Reinsurer disbursement records the operational outbound payment against a confirmed original or endorsement closing. ' +
      'Accounting confirmation, bank reference, FX, withholding tax, bank charges and posting happen in the later Accounting workflow.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementPaymentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid payment type/direction, missing confirmed closing, currency mismatch or invalid counterparty relationship.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement, counterparty, closing or participant is missing or belongs to another tenant.',
  })
  createPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementPaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    this.assertPaymentCreatePermission(request.user, dto);
    return this.paymentsService.create(request.user, id, dto);
  }

  @Post(':id/payments/:paymentId/bank-confirmation')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Confirm payment financial completion',
    description:
      'Accounting-owned workflow step that transitions a RECORDED inbound premium receipt or outbound reinsurer disbursement to BANK_CONFIRMED, stores confirmation facts, and enqueues the corresponding Accounting event for posting.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'paymentId',
    format: 'uuid',
    description:
      'RECORDED premium receipt or reinsurer disbursement payment ID.',
  })
  @ApiBody({ type: ConfirmPlacementPaymentBankDto })
  @ApiOkResponse({ type: PlacementPaymentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The payment is not an original inbound premium receipt/outbound reinsurer disbursement or is in a non-confirmable status.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The payment is already bank-confirmed or changed status before confirmation completed.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or payment is archived, missing or belongs to another tenant.',
  })
  confirmPaymentBankCompletion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ConfirmPlacementPaymentBankDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.confirmBankPayment(
      request.user,
      id,
      paymentId,
      dto,
    );
  }

  @Post(':id/payments/:paymentId/reverse')
  @ApiTags('Reinsurance - Payments')
  @RequireAnyPermission(
    PremiumPermission.REVERSE_PAYMENT,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Reverse a placement payment',
    description:
      'Creates an auditable reversal payment record and marks the original payment as REVERSED. ' +
      'Reversal never unlocks the placement; once financial activity exists, business changes require the future endorsement workflow.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'paymentId',
    format: 'uuid',
    description: 'Placement payment ID.',
  })
  @ApiCreatedResponse({ type: PlacementPaymentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'The payment is already a reversal or cannot be reversed.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'The payment has already been reversed.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or payment is archived, missing or belongs to another tenant.',
  })
  reversePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.reverse(request.user, id, paymentId);
  }

  @Post(':id/payments/:paymentId/cancel')
  @ApiTags('Reinsurance - Payments')
  @RequireAnyPermission(
    PremiumPermission.REVERSE_PAYMENT,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Cancel a recorded placement payment',
    description:
      'Marks a RECORDED payment CANCELLED. This is the correction path for entries that have not been bank confirmed and therefore cannot be reversed. No reversal record is created; re-record the corrected payment through the create endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'paymentId',
    format: 'uuid',
    description: 'Placement payment ID.',
  })
  @ApiOkResponse({ type: PlacementPaymentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The payment is a reversal, or is not RECORDED (bank-confirmed payments must be reversed instead).',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or payment is archived, missing or belongs to another tenant.',
  })
  cancelPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: CancelPlacementPaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.cancel(request.user, id, paymentId, dto);
  }

  @Get(':id/slips/offer-preview')
  @ApiTags('Reinsurance - Slip Previews')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Preview placement offer slip values',
    description:
      'Returns read-only slip preview data for the placement. ' +
      'The calculation fields mirror the current frontend preview formulas exactly. ' +
      'No PDF, document record or email is created. ' +
      'Participant-specific preview rows use each participant brokerageFee, matching the current UI.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: OfferSlipPreviewResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  getOfferSlipPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.getOfferSlipPreview(
      request.user.tenantId,
      id,
    );
  }

  @Get(':id/participants/:participantId/slips/closing-preview')
  @ApiTags('Reinsurance - Slip Previews')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Preview participant closing slip values',
    description:
      'Returns read-only closing preview data for an accepted/closed participant. ' +
      'The calculation fields mirror the current frontend preview formulas exactly. ' +
      'No PDF, document record or email is created. ' +
      'Requires signedLinePercent greater than 0 and participant status ACCEPTED or CLOSED.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: ClosingSlipPreviewResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Participant is not ACCEPTED/CLOSED or has no signed line percentage.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  getClosingSlipPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.getClosingSlipPreview(
      request.user.tenantId,
      id,
      participantId,
    );
  }

  @Get(':id/closings')
  @ApiTags('Reinsurance - Placement Closings')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement closings',
    description:
      'Returns closing records for the placement in the authenticated tenant. ' +
      'Closings are persisted financial snapshots; no PDF, document registry entry, payment, debit note, credit note or email is created by this endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementClosingListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  async findClosings(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.closingsService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/closings/:closingId')
  @ApiTags('Reinsurance - Placement Closings')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement closing',
    description:
      'Returns one closing snapshot by ID. The closing must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Placement closing ID.',
  })
  @ApiOkResponse({ type: PlacementClosingResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or closing is archived, missing or belongs to another tenant.',
  })
  findClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.closingsService.findOne(request.user.tenantId, id, closingId);
  }

  @Post(':id/participants/:participantId/closings')
  @ApiTags('Reinsurance - Placement Closings')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create a participant closing snapshot',
    description:
      'Creates a DRAFT closing for an ACCEPTED participant with signedLinePercent greater than 0. ' +
      'placement.premium is required because closing financial values are snapshotted at creation. ' +
      'Only one active closing is allowed per participant per placement; VOID closings are inactive. ' +
      'No payment, endorsement, claim, debit note, credit note, PDF, document record or email is created.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiCreatedResponse({ type: PlacementClosingResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Placement premium is missing, participant is not ACCEPTED, or signedLinePercent is not greater than 0.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active non-VOID closing already exists for this participant.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  createClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.closingsService.create(request.user, id, participantId);
  }

  @Patch(':id/closings/:closingId/status')
  @ApiTags('Reinsurance - Placement Closings')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Change placement closing status',
    description:
      'Moves a closing through the MVP lifecycle: DRAFT → ISSUED → CONFIRMED, with VOID available from DRAFT or ISSUED. ' +
      'CONFIRMED and VOID are terminal states.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Placement closing ID.',
  })
  @ApiOkResponse({ type: PlacementClosingResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid closing status transition.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or closing is archived, missing or belongs to another tenant.',
  })
  changeClosingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Body() dto: UpdatePlacementClosingStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.closingsService.changeStatus(request.user, id, closingId, dto);
  }

  @Patch(':id')
  @ApiTags('Reinsurance - Placements')
  @RequireAnyPermission(
    FacultativeOfferPermission.EDIT_OFFER,
    FacultativeOfferPermission.PARTIAL_EDIT,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Update an active placement',
    description:
      'Updates placement header fields. ' +
      'CLOSED and CANCELLED placements cannot be edited — a 400 is returned. ' +
      'Financially locked placements cannot be edited directly — a 409 is returned and a future endorsement workflow is required. ' +
      'If participants are supplied, the supplied array replaces the complete stored participant collection; ' +
      'omit participants when editing only header fields and prefer the participant-specific endpoints instead. ' +
      'Status changes must use the dedicated status endpoint. ' +
      'businessDetails and offerDetails are JSON objects validated against RiskTypeField definitions ' +
      'when riskTypeId is set.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid or empty update payload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active placement with this reference already exists, or the placement is financially locked.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlacementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    this.assertPlacementUpdatePermission(request.user, dto);
    return this.placementsService.update(request.user, id, dto);
  }

  @Patch(':id/status')
  @ApiTags('Reinsurance - Placements')
  @RequireAnyPermission(
    FacultativeOfferPermission.REOPEN_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Change placement lifecycle status',
    description:
      'Advances or reverses the placement through its lifecycle. ' +
      'Only transitions listed in the allowed matrix are accepted; an invalid move returns 400.\n\n' +
      'Allowed transitions: DRAFT→MARKETING|CANCELLED, ' +
      'MARKETING→PARTIALLY_PLACED|PLACED|DECLINED|CANCELLED, ' +
      'PARTIALLY_PLACED→MARKETING|PLACED|DECLINED|CANCELLED, ' +
      'PLACED→PARTIALLY_PLACED|CLOSING|CANCELLED, ' +
      'CLOSING→PLACED|CLOSED|CANCELLED, ' +
      'CLOSED→CLOSING when no financial lock exists, ' +
      'DECLINED→MARKETING. ' +
      'CANCELLED is terminal.\n\n' +
      'CLOSED remains directly non-editable. Reopen unpaid CLOSED placements to CLOSING first, then apply edits through normal placement/participant endpoints. ' +
      'Financially locked placements return 409 and require endorsement.\n\n' +
      'MARKETING, PARTIALLY_PLACED and PLACED are also set automatically by participant ' +
      'capacity recalculation — use this endpoint only when a manual override is needed ' +
      '(e.g. advancing to DECLINED before participant statuses are updated, or ' +
      'manually entering CLOSING once the placement is ready to bind). ' +
      'Every status change is recorded in statusHistory.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid status transition or terminal placement.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and requires endorsement for business-state changes.',
  })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlacementStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.changeStatus(request.user, id, dto);
  }

  @Post(':id/force-close')
  @ApiTags('Reinsurance - Placements')
  @RequireAnyPermission(
    FacultativeOfferPermission.FORCE_CLOSE,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Force close placement using actual placed percentage',
    description:
      'Operational override that bypasses normal close workflow validation, sets status to CLOSED, ' +
      'sets facultativeOffer to the percentage actually confirmed in placement closings, and leaves outstanding workflow history untouched. ' +
      'Draft, issued, void closings and declined participants are excluded from the actual placed percentage.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'The placement is missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived or in a terminal state that cannot be force closed.',
  })
  forceClose(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.forceClose(request.user, id);
  }

  @Post(':id/participants')
  @ApiTags('Reinsurance - Placement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.EDIT_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Add a participant to a placement',
    description:
      'Adds a tenant-owned reinsurer or broker participant without replacing the existing participant collection. ' +
      'Participant status defaults to INVITED when omitted. ' +
      'CLOSED and CANCELLED placements block this action. ' +
      'Financially locked placements return 409 and require endorsement. ' +
      'After adding, placement status is automatically recalculated for MARKETING, PARTIALLY_PLACED and PLACED placements.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid participant, duplicate counterparty/role or invalid capacity.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant changes require endorsement.',
  })
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.addParticipant(request.user, id, dto);
  }

  @Patch(':id/participants/:participantId')
  @ApiTags('Reinsurance - Placement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.EDIT_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Update one placement participant',
    description:
      'Updates a single participant without replacing the whole collection. ' +
      'Financially locked placements return 409 and require endorsement. ' +
      'Use the status endpoint for workflow state changes when possible.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid participant patch, duplicate counterparty/role or invalid capacity.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant changes require endorsement.',
  })
  updateParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.updateParticipant(
      request.user,
      id,
      participantId,
      dto,
    );
  }

  @Post(':id/participants/:participantId/accept-and-confirm')
  @ApiTags('Reinsurance - Placement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.EDIT_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Accept a participant and confirm its closing atomically',
    description:
      'Runs the placement market acceptance workflow in one transactional backend operation: ' +
      'validates the participant can move to ACCEPTED, marks it ACCEPTED, creates an active closing when none exists, ' +
      'issues the closing and confirms it. Existing active DRAFT or ISSUED closings are advanced; existing CONFIRMED closings are reused. ' +
      'The endpoint is idempotent for retries/double-clicks and leaves the individual participant and closing endpoints unchanged.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiCreatedResponse({ type: AcceptPlacementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid participant transition, missing signed line, missing placement premium, or invalid capacity.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant changes require endorsement, or the workflow cannot be completed safely.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  acceptParticipantAndConfirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.acceptParticipantAndConfirm(
      request.user,
      id,
      participantId,
    );
  }

  @Patch(':id/participants/:participantId/status')
  @ApiTags('Reinsurance - Placement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.EDIT_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Change one placement participant workflow status',
    description:
      'Moves a participant through its workflow: INVITED → OFFER_SENT → QUOTED → ACCEPTED → CLOSED, ' +
      'with DECLINED available from most states and re-entry via OFFER_SENT. ' +
      'Moving to ACCEPTED requires signedLinePercent to already be set and greater than 0 on the participant — ' +
      'update it via PATCH /participants/:id first if needed. ' +
      'After the status change, placement status is automatically recalculated when the placement is ' +
      'MARKETING, PARTIALLY_PLACED or PLACED: ' +
      'no accepted capacity → MARKETING, ' +
      'partial capacity → PARTIALLY_PLACED, ' +
      'full capacity → PLACED. ' +
      'The response always reflects the final recalculated placement state.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid participant status transition.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant workflow changes require endorsement.',
  })
  changeParticipantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementParticipantStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.changeParticipantStatus(
      request.user,
      id,
      participantId,
      dto,
    );
  }

  @Delete(':id/participants/:participantId')
  @ApiTags('Reinsurance - Placement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.EDIT_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Remove one placement participant',
    description:
      'Deletes a participant from an editable placement without archiving the placement itself. ' +
      'Deletion is allowed only when the participant has no history-bearing dependencies such as closings, notes, payments, claim allocations, documents, attachments or endorsement revisions. ' +
      'Financially locked placements or dependency conflicts return 409 and require the related workflow instead.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked, or the participant is referenced by financial/workflow records that must be voided, reversed or preserved instead of hard-deleted.',
  })
  deleteParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.deleteParticipant(
      request.user,
      id,
      participantId,
    );
  }

  @Delete(':id')
  @ApiTags('Reinsurance - Placements')
  @RequireAnyPermission(
    FacultativeOfferPermission.ARCHIVE_OFFER,
    PlacementPermission.DELETE,
  )
  @ApiOperation({
    summary: 'Archive a placement',
    description:
      'Soft-archives the active record. Archived records are excluded from standard list and detail requests. ' +
      'Financially locked placements return 409 and cannot be archived directly. ' +
      'Optional archiveReason is stored for the recycle-bin workflow.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiBody({ type: ArchivePlacementDto, required: false })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'The placement is financially locked and cannot be archived.',
  })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchivePlacementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.archive(request.user, id, dto);
  }

  @Post(':id/restore')
  @ApiTags('Reinsurance - Placements')
  @RequirePermissions(PlacementPermission.DELETE)
  @ApiOperation({
    summary: 'Restore an archived placement',
    description:
      'Restores a tenant-owned archived placement to the active list. Child records and audit history are preserved.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'The placement is missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'The placement is already active.',
  })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.restore(request.user, id);
  }

  private assertPaymentCreatePermission(
    user: RequestUser,
    dto: CreatePlacementPaymentDto,
  ): void {
    if (
      dto.type === PlacementPaymentType.PREMIUM_RECEIVED &&
      dto.direction === PlacementPaymentDirection.INBOUND
    ) {
      assertUserHasAnyPermission(user, [
        PremiumPermission.RECEIVE_FROM_CEDANT,
        PlacementPermission.CREATE,
      ]);
      return;
    }

    if (
      dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT &&
      dto.direction === PlacementPaymentDirection.OUTBOUND
    ) {
      assertUserHasAnyPermission(user, [
        PremiumPermission.DISBURSE_TO_REINSURER,
        PlacementPermission.CREATE,
      ]);
      return;
    }

    assertUserHasAnyPermission(user, [PlacementPermission.CREATE]);
  }

  private assertPlacementUpdatePermission(
    user: RequestUser,
    dto: UpdatePlacementDto,
  ): void {
    const suppliedFields = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    const isPolicyNumberOnly =
      suppliedFields.length > 0 &&
      suppliedFields.every((field) => field === 'policyNumber');

    assertUserHasAnyPermission(
      user,
      isPolicyNumberOnly
        ? [
            FacultativeOfferPermission.PARTIAL_EDIT,
            FacultativeOfferPermission.EDIT_OFFER,
            PlacementPermission.EDIT,
          ]
        : [FacultativeOfferPermission.EDIT_OFFER, PlacementPermission.EDIT],
    );
  }
}
