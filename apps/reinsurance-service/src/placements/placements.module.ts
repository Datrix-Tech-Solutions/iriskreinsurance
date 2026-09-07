import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceChargeSettingsModule } from '../settings/reinsurance-charge-settings.module';
import { ClaimAllocationCalculator } from './claims/allocation/allocation.calculator';
import { ClosingSnapshotReader } from './closings/closing-snapshot.reader';
import { PlacementFinancialActivityReader } from './finance/financial-activity.reader';
import { PlacementFinancialLockPolicy } from './finance/financial-lock.policy';
import { PlacementFinancialPositionService } from './finance/financial-position.service';
import { PlacementClaimCashCallsService } from './claims/cash-calls/cash-calls.service';
import { PlacementClaimCedantSettlementsService } from './claims/settlements/cedant-settlements.service';
import { PlacementClaimFinancialCloseReadinessService } from './claims/close/financial-close-readiness.service';
import { PlacementClaimRecoveryApprovalsService } from './claims/recoveries/recovery-approvals.service';
import { PlacementClaimRecoveryReceiptsService } from './claims/recoveries/recovery-receipts.service';
import { PlacementClaimsService } from './claims/claims.service';
import { PlacementAttachmentsController } from './documents/attachments/attachments.controller';
import { PlacementAttachmentsService } from './documents/attachments/attachments.service';
import { PlacementClosingsService } from './closings/closings.service';
import { PlacementDocumentsService } from './documents/documents.service';
import { PlacementEndorsementClosingsService } from './endorsements/closings.service';
import { PlacementEndorsementsService } from './endorsements/endorsements.service';
import { PlacementEndorsementParticipantsService } from './endorsements/participants.service';
import { PlacementEffectivePositionService } from './placement-effective-position.service';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { PlacementNotesService } from './transactions/notes.service';
import { PlacementPaymentsService } from './transactions/payments.service';
import { PlacementDocumentTemplateRegistry } from './documents/pdf/placement-document-template.registry';
import { PlacementPdfRendererService } from './documents/pdf/placement-pdf-renderer.service';
import { PlacementsController } from './placements.controller';
import { PlacementClaimsController } from './controllers/placement-claims.controller';
import { PlacementDocumentsController } from './controllers/placement-documents.controller';
import { PlacementEndorsementsController } from './controllers/placement-endorsements.controller';
import { PlacementsService } from './placements.service';
import { ReinsuranceDashboardController } from './dashboard/dashboard.controller';
import { ReinsuranceDashboardService } from './dashboard/dashboard.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';
import { S3DocumentStorageService } from './documents/storage/s3-document-storage.service';
import { TenantDocumentProfileClient } from './documents/tenant-document-profile.client';
import { ReinsuranceClaimRowStateService } from './worklists/claim-row-state.service';
import { ReinsuranceClaimsWorklistService } from './worklists/claims-worklist.service';
import { ReinsuranceFacultativeRowStateService } from './worklists/facultative-row-state.service';
import { ReinsurancePaymentsWorklistService } from './worklists/payments-worklist.service';
import { ReinsuranceWorklistsController } from './worklists/reinsurance-worklists.controller';

@Module({
  imports: [PrismaModule, RabbitMQModule, ReinsuranceChargeSettingsModule],
  controllers: [
    PlacementsController,
    PlacementDocumentsController,
    PlacementClaimsController,
    PlacementEndorsementsController,
    PlacementAttachmentsController,
    ReinsuranceDashboardController,
    ReinsuranceWorklistsController,
  ],
  providers: [
    PlacementsService,
    ReinsuranceDashboardService,
    ReinsuranceClaimRowStateService,
    ReinsuranceClaimsWorklistService,
    ReinsuranceFacultativeRowStateService,
    ReinsurancePaymentsWorklistService,
    PlacementAttachmentsService,
    PlacementClaimsService,
    PlacementClaimCashCallsService,
    PlacementClaimCedantSettlementsService,
    PlacementClaimFinancialCloseReadinessService,
    PlacementClaimRecoveryApprovalsService,
    PlacementClaimRecoveryReceiptsService,
    PlacementClosingsService,
    PlacementDocumentsService,
    PlacementEndorsementsService,
    PlacementEndorsementParticipantsService,
    PlacementEndorsementClosingsService,
    PlacementEffectivePositionService,
    PlacementEffectiveViewService,
    PlacementNotesService,
    PlacementPaymentsService,
    PlacementDocumentTemplateRegistry,
    PlacementPdfRendererService,
    S3DocumentStorageService,
    PlacementFinancialActivityReader,
    PlacementFinancialLockPolicy,
    PlacementFinancialPositionService,
    ReinsuranceMoneyHelper,
    ClosingSnapshotReader,
    ClaimAllocationCalculator,
    TenantDocumentProfileClient,
  ],
  exports: [
    PlacementsService,
    PlacementAttachmentsService,
    PlacementDocumentsService,
    S3DocumentStorageService,
  ],
})
export class PlacementsModule {}
