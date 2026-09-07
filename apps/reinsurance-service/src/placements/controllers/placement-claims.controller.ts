import {
  Body,
  Controller,
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
import { PlacementClaimCashCallsService } from '../claims/cash-calls/cash-calls.service';
import { PlacementClaimFinancialCloseReadinessService } from '../claims/close/financial-close-readiness.service';
import { PlacementClaimRecoveryApprovalsService } from '../claims/recoveries/recovery-approvals.service';
import { PlacementClaimRecoveryReceiptsService } from '../claims/recoveries/recovery-receipts.service';
import { PlacementClaimCedantSettlementsService } from '../claims/settlements/cedant-settlements.service';
import { PlacementClaimsService } from '../claims/claims.service';
import { ApprovePlacementClaimPayableDto } from '../dto/approve-placement-claim-payable.dto';
import { ApprovePlacementClaimRecoveryDto } from '../dto/approve-placement-claim-recovery.dto';
import { ConfirmPlacementClaimCedantSettlementBankDto } from '../dto/confirm-placement-claim-cedant-settlement-bank.dto';
import { ConfirmPlacementClaimRecoveryReceiptBankDto } from '../dto/confirm-placement-claim-recovery-receipt-bank.dto';
import { CreatePlacementClaimCedantSettlementDto } from '../dto/create-placement-claim-cedant-settlement.dto';
import { CreatePlacementClaimRecoveryReceiptDto } from '../dto/create-placement-claim-recovery-receipt.dto';
import { CreatePlacementClaimDto } from '../dto/create-placement-claim.dto';
import {
  PlacementClaimCashCallListResponseDto,
  PlacementClaimCashCallResponseDto,
} from '../dto/placement-claim-cash-call-response.dto';
import {
  PlacementClaimCedantSettlementListResponseDto,
  PlacementClaimCedantSettlementResponseDto,
} from '../dto/placement-claim-cedant-settlement-response.dto';
import { PlacementClaimFinancialCloseReadinessResponseDto } from '../dto/placement-claim-financial-close-readiness-response.dto';
import {
  PlacementClaimRecoveryApprovalListResponseDto,
  PlacementClaimRecoveryApprovalResponseDto,
  PlacementClaimRecoveryPositionResponseDto,
  PlacementClaimRecoveryReceiptListResponseDto,
  PlacementClaimRecoveryReceiptResponseDto,
} from '../dto/placement-claim-recovery-response.dto';
import {
  PlacementClaimAllocationListResponseDto,
  PlacementClaimListResponseDto,
  PlacementClaimResponseDto,
} from '../dto/placement-claim-response.dto';
import { ApiErrorResponseDto } from '../dto/placement-response.dto';
import { ReversePlacementClaimCedantSettlementDto } from '../dto/reverse-placement-claim-cedant-settlement.dto';
import { ReversePlacementClaimRecoveryReceiptDto } from '../dto/reverse-placement-claim-recovery-receipt.dto';
import { UpdatePlacementClaimCashCallStatusDto } from '../dto/update-placement-claim-cash-call-status.dto';
import { UpdatePlacementClaimStatusDto } from '../dto/update-placement-claim-status.dto';
import { UpdatePlacementClaimDto } from '../dto/update-placement-claim.dto';
import { VoidPlacementClaimCashCallDto } from '../dto/void-placement-claim-cash-call.dto';
import {
  ClaimWorkflowPermission,
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
export class PlacementClaimsController {
  constructor(
    private readonly claimsService: PlacementClaimsService,
    private readonly claimCashCallsService: PlacementClaimCashCallsService,
    private readonly claimCedantSettlementsService: PlacementClaimCedantSettlementsService,
    private readonly claimFinancialCloseReadinessService: PlacementClaimFinancialCloseReadinessService,
    private readonly claimRecoveryApprovalsService: PlacementClaimRecoveryApprovalsService,
    private readonly claimRecoveryReceiptsService: PlacementClaimRecoveryReceiptsService,
  ) {}

  @Get(':id/claims')
  @ApiTags('Reinsurance - Claims')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement claims',
    description:
      'Returns loss-event claim records for the placement. Claims are tenant-scoped operational records; allocations, cash calls, recoveries, cedant settlements and payable approvals are handled by their dedicated endpoints.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementClaimListResponseDto })
  async findClaims(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimsService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/claims/:claimId')
  @ApiTags('Reinsurance - Claims')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get placement claim',
    description:
      'Returns one loss-event claim. The claim must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or claim is missing, archived or belongs to another tenant.',
  })
  findClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsService.findOne(request.user.tenantId, id, claimId);
  }

  @Post(':id/claims')
  @ApiTags('Reinsurance - Claims')
  @RequireAnyPermission(
    ClaimWorkflowPermission.ADD_CLAIM,
    ClaimWorkflowPermission.CREATE_NOTIFICATION,
    PlacementPermission.CREATE,
  )
  @ApiOperation({
    summary: 'Create placement claim loss event',
    description:
      'Creates a DRAFT loss-event claim with CLM-* placement-scoped numbering. This does not generate allocations, cash calls, payments, notes, documents or emails.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementClaimResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Claim currency is invalid, amount is invalid or required loss-event fields are missing.',
  })
  createClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementClaimDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsService.create(request.user, id, dto);
  }

  @Patch(':id/claims/:claimId')
  @ApiTags('Reinsurance - Claims')
  @RequireAnyPermission(
    ClaimWorkflowPermission.ADD_CLAIM,
    ClaimWorkflowPermission.CREATE_NOTIFICATION,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Update editable placement claim',
    description:
      'Updates DRAFT, NOTIFIED or RESERVED claims. Setting finalLossAmount stamps finalized metadata. Terminal and settlement-stage claims cannot be edited directly.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'The claim is terminal or no longer directly editable.',
  })
  updateClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: UpdatePlacementClaimDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsService.update(request.user, id, claimId, dto);
  }

  @Patch(':id/claims/:claimId/status')
  @ApiTags('Reinsurance - Claims')
  @RequireAnyPermission(
    ClaimWorkflowPermission.CREATE_NOTIFICATION,
    ClaimWorkflowPermission.VOID_CLAIM,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Change placement claim status',
    description:
      'Moves a claim through DRAFT, NOTIFIED, RESERVED, PARTIALLY_SETTLED, SETTLED, CLOSED, DECLINED and VOID. CLOSED and VOID are terminal.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported claim status transition.',
  })
  changeClaimStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: UpdatePlacementClaimStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimsService.changeStatus(request.user, id, claimId, dto);
  }

  @Get(':id/claims/:claimId/financial-close-readiness')
  @ApiTags('Reinsurance - Claims')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get claim financial close readiness',
    description:
      'Returns Reinsurance-derived financial readiness for moving a claim to SETTLED or CLOSED. RECORDED settlements/receipts are operational and require Reinsurance financial confirmation before they reduce financial outstanding. BANK_CONFIRMED rows are financially confirmed inside Reinsurance. SETTLED means approved payable/recovery obligations are resolved; CLOSED is the final operational closure from SETTLED. Claim closure is non-posting and does not emit an Accounting event.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimFinancialCloseReadinessResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or claim is missing, archived or belongs to another tenant.',
  })
  getClaimFinancialCloseReadiness(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimFinancialCloseReadinessService.getReadiness(
      request.user.tenantId,
      id,
      claimId,
    );
  }

  @Patch(':id/claims/:claimId/approve-payable')
  @ApiTags('Reinsurance - Claim Cedant Settlements')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Record claim-level payable approval for a claim',
    description:
      "This endpoint records the broker's claim-level payable approval after the required reinsurer approvals have been obtained. It does not record individual participating reinsurer approvals. The operation requires finalLossAmount, at least one active reinsurer allocation and rejects approvals above final loss. It creates an immutable Reinsurance approval version and does not emit an Accounting event.",
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The claim has no final loss, amount is invalid, or the claim is terminal.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Approved payable amount is below the amount already settled to the cedant, or a different payable approval has already been recognized.',
  })
  approveClaimPayable(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: ApprovePlacementClaimPayableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCedantSettlementsService.approvePayable(
      request.user,
      id,
      claimId,
      dto,
    );
  }

  @Get(':id/claims/:claimId/cedant-settlements')
  @ApiTags('Reinsurance - Claim Cedant Settlements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List cedant claim settlements',
    description:
      'Returns immutable Broker -> Cedant settlement history for one claim. Recovery receipts from reinsurers are tracked separately.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimCedantSettlementListResponseDto })
  async findClaimCedantSettlements(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimCedantSettlementsService.findAll(
      request.user.tenantId,
      id,
      claimId,
    );
    return { items };
  }

  @Post(':id/claims/:claimId/cedant-settlements')
  @ApiTags('Reinsurance - Claim Cedant Settlements')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Record cedant claim settlement',
    description:
      'Records Broker -> Cedant settlement against the approved payable amount. Partial settlements are supported; over-settlement and wrong currency are rejected.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiCreatedResponse({ type: PlacementClaimCedantSettlementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Approved payable is missing, settlement currency mismatches or required settlement data is invalid.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Settlement amount exceeds outstanding approved payable.',
  })
  createClaimCedantSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: CreatePlacementClaimCedantSettlementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCedantSettlementsService.create(
      request.user,
      id,
      claimId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/cedant-settlements/:settlementId/bank-confirm')
  @ApiTags('Reinsurance - Claim Cedant Settlements')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Financially confirm a cedant claim settlement',
    description:
      'Reinsurance-owned confirmation that a previously RECORDED Broker -> Cedant claim settlement has completed through bank, cash, mobile-money, cheque, offset or journal process. The endpoint does not modify the operational amount, Cedant, placement, claim, payable approval or business currency and does not emit an Accounting event.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'settlementId',
    format: 'uuid',
    description: 'Cedant settlement ID.',
  })
  @ApiCreatedResponse({ type: PlacementClaimCedantSettlementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Settlement is not confirmable, confirmation facts are invalid or required FX/reference data is missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Cedant settlement is already confirmed, changed status concurrently or would over-settle the approved payable.',
  })
  confirmClaimCedantSettlementBank(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @Body() dto: ConfirmPlacementClaimCedantSettlementBankDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCedantSettlementsService.confirmBankSettlement(
      request.user,
      id,
      claimId,
      settlementId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/cedant-settlements/:settlementId/reverse')
  @ApiTags('Reinsurance - Claim Cedant Settlements')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Reverse a cedant claim settlement',
    description:
      'Marks the original Broker -> Cedant settlement REVERSED and creates an immutable linked reversal row. Cedant outstanding is restored.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'settlementId',
    format: 'uuid',
    description: 'Cedant settlement ID.',
  })
  @ApiCreatedResponse({ type: PlacementClaimCedantSettlementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'A reversal settlement cannot be reversed.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Cedant settlement has already been reversed.',
  })
  reverseClaimCedantSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @Body() dto: ReversePlacementClaimCedantSettlementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCedantSettlementsService.reverse(
      request.user,
      id,
      claimId,
      settlementId,
      dto,
    );
  }

  @Get(':id/claims/:claimId/allocations')
  @ApiTags('Reinsurance - Claim Allocations')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List claim liability allocations',
    description:
      'Returns reinsurer liability allocations generated from immutable confirmed placement and endorsement closing snapshots.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimAllocationListResponseDto })
  async findClaimAllocations(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimsService.findAllocations(
      request.user.tenantId,
      id,
      claimId,
    );
    return { items };
  }

  @Post(':id/claims/:claimId/allocations/generate')
  @ApiTags('Reinsurance - Claim Allocations')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Generate claim liability allocations',
    description:
      'Creates DRAFT allocation rows from the confirmed participation effective on the claim occurrence date. Original confirmed placement closings and confirmed closings from CLOSED endorsements effective on or before the loss date are used; DRAFT, ISSUED and VOID closings are excluded. This does not create cash calls, notes or payments.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiCreatedResponse({ type: PlacementClaimAllocationListResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'No confirmed closings exist or the claim is terminal.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Claim allocations have already been generated.',
  })
  async generateClaimAllocations(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimsService.generateAllocations(
      request.user,
      id,
      claimId,
    );
    return { items };
  }

  @Get(':id/claims/:claimId/cash-calls')
  @ApiTags('Reinsurance - Claim Cash Calls')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List claim cash calls',
    description:
      'Returns one-allocation-per-cash-call records generated from claim allocation snapshots. Cash calls are operational demand records; settlement and recovery receipts are handled separately.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimCashCallListResponseDto })
  async findClaimCashCalls(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimCashCallsService.findAll(
      request.user.tenantId,
      id,
      claimId,
    );
    return { items };
  }

  @Get(':id/claims/:claimId/cash-calls/:cashCallId')
  @ApiTags('Reinsurance - Claim Cash Calls')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get claim cash call',
    description:
      'Returns a single claim cash call that belongs to the placement, claim and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'cashCallId',
    format: 'uuid',
    description: 'Claim cash call ID.',
  })
  @ApiOkResponse({ type: PlacementClaimCashCallResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement, claim or cash call is missing, archived or belongs to another tenant.',
  })
  findClaimCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCashCallsService.findOne(
      request.user.tenantId,
      id,
      claimId,
      cashCallId,
    );
  }

  @Post(':id/claims/:claimId/allocations/:allocationId/cash-calls')
  @ApiTags('Reinsurance - Claim Cash Calls')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create claim cash call from allocation',
    description:
      'Creates a DRAFT CCL-* cash call from one claim allocation snapshot. The amount uses allocatedFinalLossAmount when present, otherwise allocatedEstimatedLossAmount. Existing allocation rows are not mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'allocationId',
    format: 'uuid',
    description: 'Claim allocation ID.',
  })
  @ApiCreatedResponse({ type: PlacementClaimCashCallResponseDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active cash call already exists for this claim allocation.',
  })
  createClaimCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('allocationId', ParseUUIDPipe) allocationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCashCallsService.create(
      request.user,
      id,
      claimId,
      allocationId,
    );
  }

  @Patch(':id/claims/:claimId/cash-calls/:cashCallId/status')
  @ApiTags('Reinsurance - Claim Cash Calls')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Change claim cash call status',
    description:
      'Supports DRAFT -> ISSUED, DRAFT -> VOID and ISSUED -> VOID. PAID remains reserved for explicit claim settlement or recovery linkage.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'cashCallId',
    format: 'uuid',
    description: 'Claim cash call ID.',
  })
  @ApiOkResponse({ type: PlacementClaimCashCallResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported claim cash call status transition.',
  })
  changeClaimCashCallStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Body() dto: UpdatePlacementClaimCashCallStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCashCallsService.changeStatus(
      request.user,
      id,
      claimId,
      cashCallId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/cash-calls/:cashCallId/void')
  @ApiTags('Reinsurance - Claim Cash Calls')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Void claim cash call',
    description:
      'Voids a DRAFT or ISSUED claim cash call with a reason. VOID cash calls are terminal and allow the allocation to be reissued with the next CCL number.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'cashCallId',
    format: 'uuid',
    description: 'Claim cash call ID.',
  })
  @ApiOkResponse({ type: PlacementClaimCashCallResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'The cash call is already terminal or the void reason is empty.',
  })
  voidClaimCashCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Body() dto: VoidPlacementClaimCashCallDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimCashCallsService.void(
      request.user,
      id,
      claimId,
      cashCallId,
      dto,
    );
  }

  @Get(':id/claims/:claimId/recovery-position')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get claim recovery position',
    description:
      'Returns recovery totals from claim allocation snapshots, issued cash calls, immutable recovery receipt records and Cedant settlement position. RECORDED values are operational; BANK_CONFIRMED values are financial.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimRecoveryPositionResponseDto })
  getClaimRecoveryPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimRecoveryReceiptsService.getRecoveryPosition(
      request.user.tenantId,
      id,
      claimId,
    );
  }

  @Get(':id/claims/:claimId/recovery-approvals')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List claim recovery approvals',
    description:
      'Returns immutable per-allocation Reinsurer recovery approval history. Recovery approvals recognize the reinsurer receivable after formal agreement/approval. They are distinct from cash calls, which are operational demands, and recovery receipts, which are future cash movement records.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiOkResponse({ type: PlacementClaimRecoveryApprovalListResponseDto })
  async findClaimRecoveryApprovals(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimRecoveryApprovalsService.findAll(
      request.user.tenantId,
      id,
      claimId,
    );
    return { items };
  }

  @Post(':id/claims/:claimId/allocations/:allocationId/recovery-approvals')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Approve reinsurer claim recovery receivable',
    description:
      'Records a formal per-allocation recovery approval for one reinsurer after the recovery is agreed/approved. This creates Reinsurance recovery approval history only. It does not record cash receipt, financial confirmation, withholding tax, NIC levy, bank charges or Accounting events.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'allocationId',
    format: 'uuid',
    description: 'Claim allocation ID for the participating reinsurer.',
  })
  @ApiCreatedResponse({ type: PlacementClaimRecoveryApprovalResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Allocation is void, counterparty is not a reinsurer, currency mismatches or amount is invalid.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Cumulative recovery approvals would exceed the allocation liability.',
  })
  approveClaimRecovery(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('allocationId', ParseUUIDPipe) allocationId: string,
    @Body() dto: ApprovePlacementClaimRecoveryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimRecoveryApprovalsService.approve(
      request.user,
      id,
      claimId,
      allocationId,
      dto,
    );
  }

  @Get(':id/claims/:claimId/cash-calls/:cashCallId/recovery-receipts')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List recovery receipts for a claim cash call',
    description:
      'Returns immutable Reinsurer -> Broker recovery receipt history for one claim cash call.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'cashCallId',
    format: 'uuid',
    description: 'Claim cash call ID.',
  })
  @ApiOkResponse({ type: PlacementClaimRecoveryReceiptListResponseDto })
  async findClaimRecoveryReceipts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.claimRecoveryReceiptsService.findAll(
      request.user.tenantId,
      id,
      claimId,
      cashCallId,
    );
    return { items };
  }

  @Post(':id/claims/:claimId/cash-calls/:cashCallId/recovery-receipts')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequireAnyPermission(
    ClaimWorkflowPermission.RECORD_RECOVERY,
    PlacementPermission.EDIT,
  )
  @ApiOperation({
    summary: 'Record recovery receipt for an issued cash call',
    description:
      'Records Reinsurer -> Broker cash received against an ISSUED claim cash call. The backend derives placement, claim, allocation and counterparty from the cash call and rejects over-recovery.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'cashCallId',
    format: 'uuid',
    description: 'Claim cash call ID.',
  })
  @ApiCreatedResponse({ type: PlacementClaimRecoveryReceiptResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Cash call is not issued, currency mismatches or required receipt data is invalid.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Recovery amount exceeds outstanding recovery balance.',
  })
  createClaimRecoveryReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('cashCallId', ParseUUIDPipe) cashCallId: string,
    @Body() dto: CreatePlacementClaimRecoveryReceiptDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimRecoveryReceiptsService.create(
      request.user,
      id,
      claimId,
      cashCallId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/recovery-receipts/:receiptId/bank-confirm')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Financially confirm a claim recovery receipt',
    description:
      'Reinsurance-owned confirmation that a previously RECORDED Reinsurer -> Broker recovery receipt has cleared the bank, offset or settlement process. The endpoint does not modify the operational amount, counterparty, placement, claim, allocation or cash call and does not emit an Accounting event.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'receiptId',
    format: 'uuid',
    description: 'Recovery receipt ID.',
  })
  @ApiCreatedResponse({ type: PlacementClaimRecoveryReceiptResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Receipt is not confirmable, confirmation facts are invalid or required FX/reference data is missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Recovery receipt is already confirmed or changed status concurrently.',
  })
  confirmClaimRecoveryReceiptBank(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() dto: ConfirmPlacementClaimRecoveryReceiptBankDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimRecoveryReceiptsService.confirmBankReceipt(
      request.user,
      id,
      claimId,
      receiptId,
      dto,
    );
  }

  @Post(':id/claims/:claimId/recovery-receipts/:receiptId/reverse')
  @ApiTags('Reinsurance - Claim Recoveries')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Reverse a claim recovery receipt',
    description:
      'Marks the original recovery receipt REVERSED and creates an immutable linked reversal record. Recovery outstanding is restored.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({ name: 'claimId', format: 'uuid', description: 'Claim ID.' })
  @ApiParam({
    name: 'receiptId',
    format: 'uuid',
    description: 'Recovery receipt ID.',
  })
  @ApiCreatedResponse({ type: PlacementClaimRecoveryReceiptResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'A reversal receipt cannot be reversed.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Recovery receipt has already been reversed.',
  })
  reverseClaimRecoveryReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() dto: ReversePlacementClaimRecoveryReceiptDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.claimRecoveryReceiptsService.reverse(
      request.user,
      id,
      claimId,
      receiptId,
      dto,
    );
  }
}
