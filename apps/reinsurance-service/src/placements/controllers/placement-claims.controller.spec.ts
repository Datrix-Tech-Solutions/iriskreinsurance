import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimStatus,
} from '../../../prisma/generated/client';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../../auth/decorators/permissions.decorator';
import { PlacementClaimCashCallsService } from '../claims/cash-calls/cash-calls.service';
import { PlacementClaimFinancialCloseReadinessService } from '../claims/close/financial-close-readiness.service';
import { PlacementClaimRecoveryApprovalsService } from '../claims/recoveries/recovery-approvals.service';
import { PlacementClaimRecoveryReceiptsService } from '../claims/recoveries/recovery-receipts.service';
import { PlacementClaimCedantSettlementsService } from '../claims/settlements/cedant-settlements.service';
import { PlacementClaimsService } from '../claims/claims.service';
import {
  ClaimWorkflowPermission,
  PlacementPermission,
} from '../placement.permissions';
import { PlacementClaimsController } from './placement-claims.controller';

describe('PlacementClaimsController', () => {
  const claimsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    findAllocations: jest.fn(),
    generateAllocations: jest.fn(),
  };
  const claimCashCallsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
    void: jest.fn(),
  };
  const claimCedantSettlementsService = {
    approvePayable: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    confirmBankSettlement: jest.fn(),
    reverse: jest.fn(),
  };
  const claimFinancialCloseReadinessService = {
    getReadiness: jest.fn(),
  };
  const claimRecoveryApprovalsService = {
    findAll: jest.fn(),
    approve: jest.fn(),
  };
  const claimRecoveryReceiptsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    confirmBankReceipt: jest.fn(),
    reverse: jest.fn(),
    getRecoveryPosition: jest.fn(),
  };
  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new PlacementClaimsController(
      claimsService as unknown as PlacementClaimsService,
      claimCashCallsService as unknown as PlacementClaimCashCallsService,
      claimCedantSettlementsService as unknown as PlacementClaimCedantSettlementsService,
      claimFinancialCloseReadinessService as unknown as PlacementClaimFinancialCloseReadinessService,
      claimRecoveryApprovalsService as unknown as PlacementClaimRecoveryApprovalsService,
      claimRecoveryReceiptsService as unknown as PlacementClaimRecoveryReceiptsService,
    );

  it.each([
    ['findClaims', PlacementPermission.VIEW],
    ['findClaim', PlacementPermission.VIEW],
    ['findClaimAllocations', PlacementPermission.VIEW],
    ['findClaimCashCalls', PlacementPermission.VIEW],
    ['findClaimCashCall', PlacementPermission.VIEW],
    ['findClaimCedantSettlements', PlacementPermission.VIEW],
    ['getClaimFinancialCloseReadiness', PlacementPermission.VIEW],
    ['getClaimRecoveryPosition', PlacementPermission.VIEW],
    ['findClaimRecoveryApprovals', PlacementPermission.VIEW],
    ['findClaimRecoveryReceipts', PlacementPermission.VIEW],
    ['generateClaimAllocations', PlacementPermission.EDIT],
    ['createClaimCashCall', PlacementPermission.EDIT],
    ['changeClaimCashCallStatus', PlacementPermission.EDIT],
    ['voidClaimCashCall', PlacementPermission.EDIT],
    ['approveClaimPayable', PlacementPermission.EDIT],
    ['approveClaimRecovery', PlacementPermission.EDIT],
    ['createClaimCedantSettlement', PlacementPermission.EDIT],
    ['confirmClaimCedantSettlementBank', PlacementPermission.EDIT],
    ['reverseClaimCedantSettlement', PlacementPermission.EDIT],
    ['confirmClaimRecoveryReceiptBank', PlacementPermission.EDIT],
    ['reverseClaimRecoveryReceipt', PlacementPermission.EDIT],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementClaimsController.prototype[
          method as keyof PlacementClaimsController
        ],
      ),
    ).toEqual([permission]);
  });

  it.each([
    [
      'createClaim',
      [
        ClaimWorkflowPermission.ADD_CLAIM,
        ClaimWorkflowPermission.CREATE_NOTIFICATION,
        PlacementPermission.CREATE,
      ],
    ],
    [
      'updateClaim',
      [
        ClaimWorkflowPermission.ADD_CLAIM,
        ClaimWorkflowPermission.CREATE_NOTIFICATION,
        PlacementPermission.EDIT,
      ],
    ],
    [
      'changeClaimStatus',
      [
        ClaimWorkflowPermission.CREATE_NOTIFICATION,
        ClaimWorkflowPermission.VOID_CLAIM,
        PlacementPermission.EDIT,
      ],
    ],
    [
      'createClaimRecoveryReceipt',
      [ClaimWorkflowPermission.RECORD_RECOVERY, PlacementPermission.EDIT],
    ],
  ])(
    'allows granular claim workflow or legacy permission on %s',
    (method, permissions) => {
      expect(
        Reflect.getMetadata(
          ANY_PERMISSIONS_KEY,
          PlacementClaimsController.prototype[
            method as keyof PlacementClaimsController
          ],
        ),
      ).toEqual(permissions);
    },
  );

  it('delegates claim reads and mutations with authenticated context', async () => {
    const controller = createController();
    claimsService.findAll.mockResolvedValue([]);
    claimsService.findAllocations.mockResolvedValue([]);
    claimFinancialCloseReadinessService.getReadiness.mockResolvedValue({
      claimId: 'claim-1',
      blockers: [],
    });
    const createDto = {
      claimNumber: 'CLM-TEST-001',
      occurrenceDate: '2026-06-03T00:00:00.000Z',
      reportedDate: '2026-06-05T10:00:00.000Z',
      claimCause: 'Warehouse fire',
      currency: 'USD',
      estimatedLossAmount: 40000,
    };
    const updateDto = { finalLossAmount: 37500 };

    const claimList = await controller.findClaims('placement-1', {
      user,
    } as never);
    await controller.findClaim('placement-1', 'claim-1', { user } as never);
    await controller.createClaim('placement-1', createDto, { user } as never);
    await controller.updateClaim('placement-1', 'claim-1', updateDto, {
      user,
    } as never);
    await controller.changeClaimStatus(
      'placement-1',
      'claim-1',
      { status: PlacementClaimStatus.NOTIFIED },
      { user } as never,
    );
    await controller.getClaimFinancialCloseReadiness('placement-1', 'claim-1', {
      user,
    } as never);
    const allocationList = await controller.findClaimAllocations(
      'placement-1',
      'claim-1',
      { user } as never,
    );
    await controller.generateClaimAllocations('placement-1', 'claim-1', {
      user,
    } as never);

    expect(claimsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(claimList).toEqual({ items: [] });
    expect(claimsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(claimsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      createDto,
    );
    expect(claimsService.update).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      updateDto,
    );
    expect(claimsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      expect.objectContaining({ status: PlacementClaimStatus.NOTIFIED }),
    );
    expect(
      claimFinancialCloseReadinessService.getReadiness,
    ).toHaveBeenCalledWith('tenant-1', 'placement-1', 'claim-1');
    expect(claimsService.findAllocations).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(allocationList).toEqual({ items: [] });
    expect(claimsService.generateAllocations).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
    );
  });

  it('delegates claim cash call reads and mutations with authenticated context', async () => {
    const controller = createController();
    claimCashCallsService.findAll.mockResolvedValue([]);

    const list = await controller.findClaimCashCalls('placement-1', 'claim-1', {
      user,
    } as never);
    await controller.findClaimCashCall(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { user } as never,
    );
    await controller.createClaimCashCall(
      'placement-1',
      'claim-1',
      'allocation-1',
      { user } as never,
    );
    await controller.changeClaimCashCallStatus(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { status: PlacementClaimCashCallStatus.ISSUED },
      { user } as never,
    );
    await controller.voidClaimCashCall(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { voidReason: 'Replacement required' },
      { user } as never,
    );

    expect(claimCashCallsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(list).toEqual({ items: [] });
    expect(claimCashCallsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
      'cash-call-1',
    );
    expect(claimCashCallsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'allocation-1',
    );
    expect(claimCashCallsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
      expect.objectContaining({ status: PlacementClaimCashCallStatus.ISSUED }),
    );
    expect(claimCashCallsService.void).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
      expect.objectContaining({ voidReason: 'Replacement required' }),
    );
  });

  it('delegates claim recovery approval reads and mutations with authenticated context', async () => {
    const controller = createController();
    claimRecoveryApprovalsService.findAll.mockResolvedValue([]);

    const list = await controller.findClaimRecoveryApprovals(
      'placement-1',
      'claim-1',
      { user } as never,
    );
    await controller.approveClaimRecovery(
      'placement-1',
      'claim-1',
      'allocation-1',
      { approvedAmount: 40000, currency: 'GHS' },
      { user } as never,
    );

    expect(claimRecoveryApprovalsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(list).toEqual({ items: [] });
    expect(claimRecoveryApprovalsService.approve).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'allocation-1',
      expect.objectContaining({ approvedAmount: 40000, currency: 'GHS' }),
    );
  });

  it('delegates claim cedant settlement operations with authenticated context', async () => {
    const controller = createController();
    claimCedantSettlementsService.findAll.mockResolvedValue([]);
    const approvalDto = { approvedPayableAmount: 90000, currency: 'GHS' };
    const settlementDto = {
      amount: 30000,
      currency: 'GHS',
      settlementDate: '2026-08-10T09:00:00.000Z',
    };
    const confirmDto = {
      bankConfirmedAt: '2026-08-10T11:00:00.000Z',
      bankReference: 'BANK-CED-001',
    };
    const reverseDto = { notes: 'Duplicate settlement' };

    await controller.approveClaimPayable(
      'placement-1',
      'claim-1',
      approvalDto,
      { user } as never,
    );
    const list = await controller.findClaimCedantSettlements(
      'placement-1',
      'claim-1',
      { user } as never,
    );
    await controller.createClaimCedantSettlement(
      'placement-1',
      'claim-1',
      settlementDto,
      { user } as never,
    );
    await controller.confirmClaimCedantSettlementBank(
      'placement-1',
      'claim-1',
      'settlement-1',
      confirmDto,
      { user } as never,
    );
    await controller.reverseClaimCedantSettlement(
      'placement-1',
      'claim-1',
      'settlement-1',
      reverseDto,
      { user } as never,
    );

    expect(claimCedantSettlementsService.approvePayable).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      approvalDto,
    );
    expect(claimCedantSettlementsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(list).toEqual({ items: [] });
    expect(claimCedantSettlementsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      settlementDto,
    );
    expect(
      claimCedantSettlementsService.confirmBankSettlement,
    ).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'settlement-1',
      confirmDto,
    );
    expect(claimCedantSettlementsService.reverse).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'settlement-1',
      reverseDto,
    );
  });

  it('delegates claim recovery receipt operations with authenticated context', async () => {
    const controller = createController();
    claimRecoveryReceiptsService.findAll.mockResolvedValue([]);
    const receiptDto = {
      amount: 40000,
      currency: 'GHS',
      paymentDate: '2026-07-31T09:00:00.000Z',
    };
    const confirmDto = {
      bankConfirmedAt: '2026-07-31T10:00:00.000Z',
      bankReference: 'BANK-CONF-001',
    };
    const reverseDto = { notes: 'Duplicate receipt' };

    await controller.getClaimRecoveryPosition('placement-1', 'claim-1', {
      user,
    } as never);
    const list = await controller.findClaimRecoveryReceipts(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { user } as never,
    );
    await controller.createClaimRecoveryReceipt(
      'placement-1',
      'claim-1',
      'cash-call-1',
      receiptDto,
      { user } as never,
    );
    await controller.confirmClaimRecoveryReceiptBank(
      'placement-1',
      'claim-1',
      'receipt-1',
      confirmDto,
      { user } as never,
    );
    await controller.reverseClaimRecoveryReceipt(
      'placement-1',
      'claim-1',
      'receipt-1',
      reverseDto,
      { user } as never,
    );

    expect(
      claimRecoveryReceiptsService.getRecoveryPosition,
    ).toHaveBeenCalledWith('tenant-1', 'placement-1', 'claim-1');
    expect(claimRecoveryReceiptsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
      'cash-call-1',
    );
    expect(list).toEqual({ items: [] });
    expect(claimRecoveryReceiptsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
      receiptDto,
    );
    expect(
      claimRecoveryReceiptsService.confirmBankReceipt,
    ).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'receipt-1',
      confirmDto,
    );
    expect(claimRecoveryReceiptsService.reverse).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'receipt-1',
      reverseDto,
    );
  });
});
