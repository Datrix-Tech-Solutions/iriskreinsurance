import {
  Controller,
  Get,
  GoneException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

const REINSURANCE_ACCOUNTING_RETIRED_MESSAGE =
  'Reinsurance Accounting integration is retired by product policy; Reinsurance financial workflows are controlled inside Reinsurance.';

@Controller('accounting-integration')
@ApiTags('Reinsurance - Accounting Integration')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class ReinsuranceAccountingIntegrationController {
  @Get('status')
  @RequirePermissions('operations.reinsurance.dashboard:VIEW')
  @ApiOperation({
    summary: 'Reinsurance Accounting integration status is retired',
    description:
      'Reinsurance is financially self-contained. This compatibility endpoint fails safely and never contacts Accounting.',
  })
  status() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('counterparties/:counterpartyId/subledger/sync')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Reinsurance counterparty Accounting sync is retired',
    description:
      'Reinsurance counterparties are managed inside Reinsurance. This compatibility endpoint fails safely and never contacts Accounting.',
  })
  syncCounterparty() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('outbox/process-pending')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Reinsurance Accounting outbox dispatch is retired',
    description:
      'Reinsurance no longer sends financial events to Accounting. This compatibility endpoint fails safely and never dispatches outbox rows.',
  })
  processPending() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Get('outbox/dispatcher/status')
  @RequirePermissions('operations.reinsurance.accounting-operations:VIEW')
  @ApiOperation({
    summary: 'Reinsurance Accounting outbox dispatcher status is retired',
    description:
      'Reinsurance no longer dispatches financial events to Accounting. This compatibility endpoint fails safely and does not expose historical event payloads.',
  })
  dispatcherStatus() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Get('financial-confirmations/claim-recovery-receipts')
  @RequirePermissions('operations.reinsurance.dashboard:VIEW')
  @ApiOperation({
    summary: 'Claim recovery receipt Accounting confirmation queue is retired',
    description:
      'Reinsurance Claims are financially confirmed inside Reinsurance and no longer enter the Accounting confirmation queue.',
  })
  findPendingClaimRecoveryReceiptConfirmations() {
    throw new GoneException(
      'Reinsurance claim recovery receipts are financially confirmed inside Reinsurance and no longer enter Accounting confirmation queues.',
    );
  }

  @Get('financial-confirmations/claim-cedant-settlements')
  @RequirePermissions('operations.reinsurance.dashboard:VIEW')
  @ApiOperation({
    summary: 'Claim cedant settlement Accounting confirmation queue is retired',
    description:
      'Reinsurance Claims are financially confirmed inside Reinsurance and no longer enter the Accounting confirmation queue.',
  })
  findPendingClaimCedantSettlementConfirmations() {
    throw new GoneException(
      'Reinsurance claim cedant settlements are financially confirmed inside Reinsurance and no longer enter Accounting confirmation queues.',
    );
  }

  @Post('reconciliation/debit-note-issued')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Placement debit note Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes placement debit note Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileDebitNoteIssuedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/credit-note-issued')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Placement credit note Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes placement credit note Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileCreditNoteIssuedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/endorsement-debit-note-issued')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Endorsement debit note Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes endorsement debit note Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileEndorsementDebitNoteIssuedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/endorsement-credit-note-issued')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Endorsement credit note Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes endorsement credit note Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileEndorsementCreditNoteIssuedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/premium-payment-received')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Premium payment Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes premium payment Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcilePremiumPaymentReceivedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/payment-reversed')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Premium payment reversal Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes premium payment reversal Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcilePaymentReversedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/reinsurer-disbursement-recorded')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Reinsurer disbursement Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes reinsurer disbursement Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileReinsurerDisbursementRecordedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/reinsurer-disbursement-reversed')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary:
      'Reinsurer disbursement reversal Accounting reconciliation is retired',
    description:
      'Reinsurance no longer publishes reinsurer disbursement reversal Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileReinsurerDisbursementReversedEvents() {
    throw new GoneException(REINSURANCE_ACCOUNTING_RETIRED_MESSAGE);
  }

  @Post('reconciliation/claim-payable-approved')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim payable Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimPayableApprovedEvents() {
    throw new GoneException(
      'Claim payable Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-recovery-approved')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim recovery Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimRecoveryApprovedEvents() {
    throw new GoneException(
      'Claim recovery Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-cedant-settlement-paid')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim cedant settlement Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimCedantSettlementPaidEvents() {
    throw new GoneException(
      'Claim cedant settlement Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-cedant-settlement-reversed')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary:
      'Claim cedant settlement reversal Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimCedantSettlementReversedEvents() {
    throw new GoneException(
      'Claim cedant settlement reversal Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-recovery-received')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim recovery receipt Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimRecoveryReceivedEvents() {
    throw new GoneException(
      'Claim recovery receipt Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-recovery-receipt-reversed')
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary:
      'Claim recovery receipt reversal Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimRecoveryReceiptReversedEvents() {
    throw new GoneException(
      'Claim recovery receipt reversal Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }
}
