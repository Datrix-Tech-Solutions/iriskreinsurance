import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../../auth/decorators/feature.decorator';
import { RequireModule } from '../../auth/decorators/module.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../../auth/guards/feature.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CreatePlacementEndorsementDto } from '../dto/create-placement-endorsement.dto';
import { CreatePlacementEndorsementParticipantDto } from '../dto/create-placement-endorsement-participant.dto';
import { ForceCloseEndorsementResponseDto } from '../dto/force-close-endorsement-response.dto';
import {
  PlacementEndorsementClosingListResponseDto,
  PlacementEndorsementClosingResponseDto,
} from '../dto/placement-endorsement-closing-response.dto';
import {
  PlacementEndorsementParticipantListResponseDto,
  PlacementEndorsementParticipantResponseDto,
} from '../dto/placement-endorsement-participant-response.dto';
import {
  PlacementEndorsementListResponseDto,
  PlacementEndorsementResponseDto,
} from '../dto/placement-endorsement-response.dto';
import { PlacementEndorsementSummaryResponseDto } from '../dto/placement-endorsement-summary-response.dto';
import { ApiErrorResponseDto } from '../dto/placement-response.dto';
import { UpdatePlacementEndorsementClosingStatusDto } from '../dto/update-placement-endorsement-closing-status.dto';
import { UpdatePlacementEndorsementParticipantStatusDto } from '../dto/update-placement-endorsement-participant-status.dto';
import { UpdatePlacementEndorsementParticipantDto } from '../dto/update-placement-endorsement-participant.dto';
import { UpdatePlacementEndorsementStatusDto } from '../dto/update-placement-endorsement-status.dto';
import { UpdatePlacementEndorsementDto } from '../dto/update-placement-endorsement.dto';
import { ValidateEndorsementParticipantResponseDto } from '../dto/validate-endorsement-participant-response.dto';
import { PlacementEndorsementClosingsService } from '../endorsements/closings.service';
import { PlacementEndorsementParticipantsService } from '../endorsements/participants.service';
import { PlacementEndorsementsService } from '../endorsements/endorsements.service';
import {
  FacultativeOfferPermission,
  PlacementPermission,
} from '../placement.permissions';

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
export class PlacementEndorsementsController {
  constructor(
    private readonly endorsementsService: PlacementEndorsementsService,
    private readonly endorsementParticipantsService: PlacementEndorsementParticipantsService,
    private readonly endorsementClosingsService: PlacementEndorsementClosingsService,
  ) {}

  @Get(':id/endorsements')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement endorsements',
    description:
      'Returns versioned placement adjustment records. Endorsements are child records and do not mutate the original placement, participants, closings, payments or notes.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementEndorsementListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  findEndorsements(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService
      .findAll(request.user.tenantId, id)
      .then((items) => ({ items }));
  }

  @Post(':id/endorsements')
  @ApiTags('Reinsurance - Endorsements')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.CREATE,
  )
  @ApiOperation({
    summary: 'Create placement endorsement',
    description:
      'Creates a DRAFT versioned adjustment linked to the original placement. The backend captures originalSnapshot at creation and stores proposed changes separately; original placement records are not mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid endorsement payload or the placement has no closing yet.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  createEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementEndorsementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.create(request.user, id, dto);
  }

  @Get(':id/endorsements/:endorsementId')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Get placement endorsement by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is missing or belongs to another tenant/placement.',
  })
  findEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.findOne(
      request.user.tenantId,
      id,
      endorsementId,
    );
  }

  @Get(':id/endorsements/:endorsementId/summary')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get placement endorsement aggregate summary',
    description:
      'Returns read-only endorsement workflow totals using endorsement participants, endorsement closings and endorsement notes only. Original placement participants, closings and notes are excluded from capacity and completion calculations.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementSummaryResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is missing or belongs to another tenant/placement.',
  })
  getEndorsementSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.getSummary(
      request.user.tenantId,
      id,
      endorsementId,
    );
  }

  @Patch(':id/endorsements/:endorsementId')
  @ApiTags('Reinsurance - Endorsements')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Update draft placement endorsement',
    description:
      'Updates editable endorsement metadata and proposedSnapshot. Only DRAFT endorsements can be edited directly. Original placement and financial history remain unchanged.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Endorsement is no longer DRAFT or payload is invalid.',
  })
  updateEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Body() dto: UpdatePlacementEndorsementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.update(
      request.user,
      id,
      endorsementId,
      dto,
    );
  }

  @Patch(':id/endorsements/:endorsementId/status')
  @ApiTags('Reinsurance - Endorsements')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Change placement endorsement status',
    description:
      'Moves an endorsement through its lifecycle. CLOSED, DECLINED and VOID are terminal. Status changes do not mutate the original placement.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported endorsement status transition.',
  })
  changeEndorsementStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Body() dto: UpdatePlacementEndorsementStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.changeStatus(
      request.user,
      id,
      endorsementId,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/closings')
  @ApiTags('Reinsurance - Endorsement Closings')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List endorsement closings',
    description:
      'Returns endorsement-scoped closing snapshots for accepted endorsement participants. These records do not mutate original placement closings, participants, payments or notes.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementClosingListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is missing or belongs to another tenant/placement.',
  })
  async findEndorsementClosings(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.endorsementClosingsService.findAll(
      request.user.tenantId,
      id,
      endorsementId,
    );
    return { items };
  }

  @Get(':id/endorsements/:endorsementId/closings/:closingId')
  @ApiTags('Reinsurance - Endorsement Closings')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get endorsement closing by ID',
    description:
      'Returns a single endorsement closing scoped to the authenticated tenant, placement and endorsement.',
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
  @ApiOkResponse({ type: PlacementEndorsementClosingResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The endorsement closing is missing or belongs to another tenant/placement/endorsement.',
  })
  findEndorsementClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementClosingsService.findOne(
      request.user.tenantId,
      id,
      endorsementId,
      closingId,
    );
  }

  @Post(':id/endorsements/:endorsementId/participants/:participantId/closings')
  @ApiTags('Reinsurance - Endorsement Closings')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Create endorsement closing',
    description:
      'Creates a DRAFT endorsement closing from an ACCEPTED endorsement participant with signedLinePercent > 0. The closing snapshots endorsement version values and never mutates original placement closing records.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiCreatedResponse({ type: PlacementEndorsementClosingResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Endorsement is VOID, participant is not ACCEPTED, signedLinePercent is missing/zero or endorsement snapshot premium is missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active endorsement closing already exists for this endorsement participant.',
  })
  createEndorsementClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementClosingsService.create(
      request.user,
      id,
      endorsementId,
      participantId,
    );
  }

  @Post(
    ':id/endorsements/:endorsementId/participants/:participantId/validate-and-confirm',
  )
  @ApiTags('Reinsurance - Endorsement Closings')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Validate and confirm an endorsement participant atomically',
    description:
      'Creates or reuses the active endorsement closing for an ACCEPTED endorsement participant, issues it when needed, confirms it, and marks the endorsement participant CLOSED in one transaction. The endpoint is idempotent for already confirmed endorsement closings and does not mutate original placement participants or original placement closings.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiCreatedResponse({ type: ValidateEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Endorsement is not in a valid workflow state, participant is not ACCEPTED, signed line is missing/zero, capacity exceeds targetPercent, or required snapshot values are missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Endorsement or participant is terminal, or the participant is closed without a confirmed active endorsement closing.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'Placement, endorsement, or endorsement participant is missing or belongs to another tenant.',
  })
  validateAndConfirmEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementClosingsService.validateAndConfirm(
      request.user,
      id,
      endorsementId,
      participantId,
    );
  }

  @Post(':id/endorsements/:endorsementId/force-close')
  @ApiTags('Reinsurance - Endorsement Closings')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Force close endorsement using agreed participant lines',
    description:
      'Operational override that closes an endorsement at its currently agreed endorsement participant lines. ' +
      'For each ACCEPTED endorsement participant with a signed line, the backend creates or reuses the active endorsement closing snapshot, issues and confirms it, marks the endorsement participant CLOSED, then closes the endorsement. ' +
      'Declined, pending and voided participant/closing history remains preserved. Original placement participants and original placement closings are never mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiCreatedResponse({ type: ForceCloseEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Endorsement is still DRAFT or a participant signed line/snapshot value is invalid.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Endorsement is terminal/void/declined or no agreed participant line exists to close.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'Placement or endorsement is missing, archived or belongs to another tenant.',
  })
  forceCloseEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementClosingsService.forceClose(
      request.user,
      id,
      endorsementId,
    );
  }

  @Patch(':id/endorsements/:endorsementId/closings/:closingId/status')
  @ApiTags('Reinsurance - Endorsement Closings')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Change endorsement closing status',
    description:
      'Moves an endorsement closing through DRAFT, ISSUED, CONFIRMED and VOID. CONFIRMED and VOID are terminal.',
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
  @ApiOkResponse({ type: PlacementEndorsementClosingResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported endorsement closing status transition.',
  })
  changeEndorsementClosingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Body() dto: UpdatePlacementEndorsementClosingStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementClosingsService.changeStatus(
      request.user,
      id,
      endorsementId,
      closingId,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/participants')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List endorsement participants',
    description:
      'Returns endorsement-scoped reinsurer response records and capacity aggregates. These records do not mutate original placement participants.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is missing or belongs to another tenant/placement.',
  })
  findEndorsementParticipants(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.findAll(
      request.user.tenantId,
      id,
      endorsementId,
    );
  }

  @Post(':id/endorsements/:endorsementId/participants')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Add endorsement participant',
    description:
      'Adds an existing or new reinsurer to the endorsement market workflow. originalParticipantId is optional and identifies existing reinsurers from the original placement. Original placement participants are never mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiCreatedResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Counterparty is not an active reinsurer, original participant does not match, status values are invalid or accepted capacity exceeds targetPercent.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active endorsement participant already exists for this reinsurer.',
  })
  createEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Body() dto: CreatePlacementEndorsementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.create(
      request.user,
      id,
      endorsementId,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/participants/:participantId')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Get endorsement participant by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The endorsement participant is missing or belongs to another tenant/placement/endorsement.',
  })
  findEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.findOne(
      request.user.tenantId,
      id,
      endorsementId,
      participantId,
    );
  }

  @Patch(':id/endorsements/:endorsementId/participants/:participantId')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Update endorsement participant',
    description:
      'Updates an endorsement-scoped participant while the endorsement and participant are non-terminal. Original placement participant records remain immutable.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Participant or endorsement is terminal, values are invalid or accepted capacity exceeds targetPercent.',
  })
  updateEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementEndorsementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.update(
      request.user,
      id,
      endorsementId,
      participantId,
      dto,
    );
  }

  @Patch(':id/endorsements/:endorsementId/participants/:participantId/status')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Change endorsement participant status',
    description:
      'Moves an endorsement participant through INVITED, OFFER_SENT, QUOTED, ACCEPTED, DECLINED and CLOSED. DECLINED and CLOSED are terminal.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Unsupported status transition, missing accepted signed line or accepted capacity exceeds targetPercent.',
  })
  changeEndorsementParticipantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementEndorsementParticipantStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.changeStatus(
      request.user,
      id,
      endorsementId,
      participantId,
      dto,
    );
  }

  @Post(':id/endorsements/:endorsementId/participants/:participantId/reinvite')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Re-invite a declined endorsement participant',
    description:
      'Creates a new INVITED endorsement participant attempt for the same reinsurer only when the selected prior attempt is DECLINED. ' +
      'The declined row is preserved for history and is never overwritten. Accepted, closed and still-active participants cannot be re-invited through this endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Declined endorsement participant ID.',
  })
  @ApiCreatedResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The selected participant is not DECLINED or another active invitation already exists for that reinsurer.',
  })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'The endorsement is terminal and cannot accept invitations.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'Placement, endorsement, or endorsement participant is missing or belongs to another tenant.',
  })
  reinviteEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.reinvite(
      request.user,
      id,
      endorsementId,
      participantId,
    );
  }

  @Delete(':id/endorsements/:endorsementId/participants/:participantId')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequireAnyPermission(
    FacultativeOfferPermission.ENDORSE_OFFER,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Delete non-terminal endorsement participant',
    description:
      'Removes an endorsement-scoped participant only while the endorsement and participant are non-terminal. Original placement participants are not changed.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({
    schema: {
      example: { deleted: true },
    },
  })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Participant or endorsement is terminal.',
  })
  async deleteEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    await this.endorsementParticipantsService.delete(
      request.user,
      id,
      endorsementId,
      participantId,
    );
    return { deleted: true };
  }
}
