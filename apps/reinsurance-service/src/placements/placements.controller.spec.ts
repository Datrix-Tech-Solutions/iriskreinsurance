import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementNoteStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementPaymentDirection,
  PlacementPaymentType,
} from '../../prisma/generated/client';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';
import {
  FacultativeOfferPermission,
  PlacementPermission,
  PremiumPermission,
} from './placement.permissions';
import { PlacementClosingsService } from './closings/closings.service';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { PlacementFinancialPositionService } from './finance/financial-position.service';
import { PlacementNotesService } from './transactions/notes.service';
import { PlacementPaymentsService } from './transactions/payments.service';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';

describe('PlacementsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    getLockStatus: jest.fn(),
    getOfferSlipPreview: jest.fn(),
    getClosingSlipPreview: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    forceClose: jest.fn(),
    addParticipant: jest.fn(),
    updateParticipant: jest.fn(),
    changeParticipantStatus: jest.fn(),
    acceptParticipantAndConfirm: jest.fn(),
    deleteParticipant: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  };
  const closingsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
  };
  const effectiveViewService = {
    getEffectiveView: jest.fn(),
  };
  const financialPositionService = {
    getFinancialPosition: jest.fn(),
  };
  const notesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findAllEndorsementNotes: jest.fn(),
    findEndorsementNote: jest.fn(),
    createDebitNote: jest.fn(),
    createCreditNote: jest.fn(),
    previewCurrentEffectiveDebitNote: jest.fn(),
    createCurrentEffectiveDebitNote: jest.fn(),
    findAllCurrentEffectiveDebitNotes: jest.fn(),
    findCurrentEffectiveDebitNote: jest.fn(),
    createEndorsementDebitNote: jest.fn(),
    createEndorsementCreditNote: jest.fn(),
    issue: jest.fn(),
    issueEndorsementNote: jest.fn(),
    void: jest.fn(),
    voidEndorsementNote: jest.fn(),
  };
  const paymentsService = {
    findPendingBankConfirmations: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    confirmBankPayment: jest.fn(),
    reverse: jest.fn(),
  };
  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    role: 'TENANT_ADMIN',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  } as RequestUser;
  const employeeWithPermissions = (permissions: string[]) =>
    ({
      ...user,
      role: 'EMPLOYEE',
      permissions,
    }) as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new PlacementsController(
      service as unknown as PlacementsService,
      closingsService as unknown as PlacementClosingsService,
      effectiveViewService as unknown as PlacementEffectiveViewService,
      notesService as unknown as PlacementNotesService,
      paymentsService as unknown as PlacementPaymentsService,
      financialPositionService as unknown as PlacementFinancialPositionService,
    );

  it('delegates list queries using only the authenticated tenant context', async () => {
    const controller = createController();
    const query = { page: 1, limit: 20 };

    await controller.findAll(query, { user } as never);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it.each([
    ['findAll', PlacementPermission.VIEW],
    ['findOne', PlacementPermission.VIEW],
    ['getEffectiveView', PlacementPermission.VIEW],
    ['getFinancialPosition', PlacementPermission.VIEW],
    ['getLockStatus', PlacementPermission.VIEW],
    ['getOfferSlipPreview', PlacementPermission.VIEW],
    ['getClosingSlipPreview', PlacementPermission.VIEW],
    ['findClosings', PlacementPermission.VIEW],
    ['findClosing', PlacementPermission.VIEW],
    ['findEndorsementNotes', PlacementPermission.VIEW],
    ['findEndorsementNote', PlacementPermission.VIEW],
    ['findNotes', PlacementPermission.VIEW],
    ['findNote', PlacementPermission.VIEW],
    ['findPayments', PlacementPermission.VIEW],
    ['findPayment', PlacementPermission.VIEW],
    ['createClosing', PlacementPermission.EDIT],
    ['changeClosingStatus', PlacementPermission.EDIT],
    ['createDebitNote', PlacementPermission.EDIT],
    ['createCreditNote', PlacementPermission.EDIT],
    ['issueNote', PlacementPermission.EDIT],
    ['voidNote', PlacementPermission.EDIT],
    ['restore', PlacementPermission.DELETE],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementsController.prototype[method as keyof PlacementsController],
      ),
    ).toEqual([permission]);
  });

  it.each([
    [
      'create',
      [FacultativeOfferPermission.CREATE_OFFER, PlacementPermission.CREATE],
    ],
    [
      'createPayment',
      [
        PremiumPermission.RECEIVE_FROM_CEDANT,
        PremiumPermission.DISBURSE_TO_REINSURER,
        PlacementPermission.CREATE,
      ],
    ],
    [
      'update',
      [
        FacultativeOfferPermission.EDIT_OFFER,
        FacultativeOfferPermission.PARTIAL_EDIT,
        PlacementPermission.EDIT,
      ],
    ],
    [
      'changeStatus',
      [FacultativeOfferPermission.REOPEN_OFFER, PlacementPermission.EDIT],
    ],
    [
      'forceClose',
      [FacultativeOfferPermission.FORCE_CLOSE, PlacementPermission.EDIT],
    ],
    [
      'addParticipant',
      [FacultativeOfferPermission.EDIT_OFFER, PlacementPermission.EDIT],
    ],
    [
      'updateParticipant',
      [FacultativeOfferPermission.EDIT_OFFER, PlacementPermission.EDIT],
    ],
    [
      'changeParticipantStatus',
      [FacultativeOfferPermission.EDIT_OFFER, PlacementPermission.EDIT],
    ],
    [
      'acceptParticipantAndConfirm',
      [FacultativeOfferPermission.EDIT_OFFER, PlacementPermission.EDIT],
    ],
    [
      'deleteParticipant',
      [FacultativeOfferPermission.EDIT_OFFER, PlacementPermission.EDIT],
    ],
    [
      'reversePayment',
      [PremiumPermission.REVERSE_PAYMENT, PlacementPermission.EDIT],
    ],
    [
      'archive',
      [FacultativeOfferPermission.ARCHIVE_OFFER, PlacementPermission.DELETE],
    ],
    [
      'createEndorsementDebitNote',
      [FacultativeOfferPermission.ENDORSE_OFFER, PlacementPermission.EDIT],
    ],
    [
      'createEndorsementCreditNote',
      [FacultativeOfferPermission.ENDORSE_OFFER, PlacementPermission.EDIT],
    ],
    [
      'issueEndorsementNote',
      [FacultativeOfferPermission.ENDORSE_OFFER, PlacementPermission.EDIT],
    ],
    [
      'voidEndorsementNote',
      [FacultativeOfferPermission.ENDORSE_OFFER, PlacementPermission.EDIT],
    ],
  ])(
    'allows any permitted workflow permission on %s',
    (method, permissions) => {
      expect(
        Reflect.getMetadata(
          ANY_PERMISSIONS_KEY,
          PlacementsController.prototype[method as keyof PlacementsController],
        ),
      ).toEqual(permissions);
    },
  );

  it('delegates participant mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.addParticipant(
      'placement-1',
      {
        counterpartyId: 'reinsurer-1',
        role: PlacementParticipantRole.REINSURER,
      },
      { user } as never,
    );
    await controller.updateParticipant(
      'placement-1',
      'participant-1',
      { sharePercent: 25 },
      { user } as never,
    );
    await controller.changeParticipantStatus(
      'placement-1',
      'participant-1',
      { status: PlacementParticipantStatus.OFFER_SENT },
      { user } as never,
    );
    await controller.acceptParticipantAndConfirm(
      'placement-1',
      'participant-1',
      { user } as never,
    );
    await controller.deleteParticipant('placement-1', 'participant-1', {
      user,
    } as never);

    expect(service.addParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      expect.objectContaining({ counterpartyId: 'reinsurer-1' }),
    );
    expect(service.updateParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
      expect.objectContaining({ sharePercent: 25 }),
    );
    expect(service.changeParticipantStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
      expect.objectContaining({ status: 'OFFER_SENT' }),
    );
    expect(service.acceptParticipantAndConfirm).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(service.deleteParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
  });

  it('delegates slip preview reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getOfferSlipPreview('placement-1', { user } as never);
    await controller.getClosingSlipPreview('placement-1', 'participant-1', {
      user,
    } as never);

    expect(service.getOfferSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(service.getClosingSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'participant-1',
    );
  });

  it('delegates lock status reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getLockStatus('placement-1', { user } as never);

    expect(service.getLockStatus).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
  });

  it('delegates force close with authenticated user context', async () => {
    const controller = createController();

    await controller.forceClose('placement-1', { user } as never);

    expect(service.forceClose).toHaveBeenCalledWith(user, 'placement-1');
  });

  it('delegates effective view reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getEffectiveView('placement-1', undefined, {
      user,
    } as never);

    expect(effectiveViewService.getEffectiveView).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      undefined,
    );
  });

  it('delegates financial position reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getFinancialPosition(
      'placement-1',
      '2026-08-01T00:00:00.000Z',
      { user } as never,
    );

    expect(financialPositionService.getFinancialPosition).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('delegates closing reads with authenticated tenant context', async () => {
    const controller = createController();
    closingsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findClosings('placement-1', {
      user,
    } as never);
    await controller.findClosing('placement-1', 'closing-1', {
      user,
    } as never);

    expect(closingsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(closingsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'closing-1',
    );
  });

  it('delegates closing mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createClosing('placement-1', 'participant-1', {
      user,
    } as never);
    await controller.changeClosingStatus(
      'placement-1',
      'closing-1',
      { status: PlacementClosingStatus.ISSUED },
      { user } as never,
    );

    expect(closingsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(closingsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
      expect.objectContaining({ status: PlacementClosingStatus.ISSUED }),
    );
  });

  it('delegates archive and restore placement lifecycle actions', async () => {
    const controller = createController();

    await controller.archive(
      'placement-1',
      { archiveReason: 'Duplicate placement' },
      { user } as never,
    );
    await controller.restore('placement-1', { user } as never);

    expect(service.archive).toHaveBeenCalledWith(user, 'placement-1', {
      archiveReason: 'Duplicate placement',
    });
    expect(service.restore).toHaveBeenCalledWith(user, 'placement-1');
  });

  it('delegates note reads with authenticated tenant context', async () => {
    const controller = createController();
    notesService.findAll.mockResolvedValue([]);

    const listResult = await controller.findNotes('placement-1', {
      user,
    } as never);
    await controller.findNote('placement-1', 'note-1', { user } as never);

    expect(notesService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(notesService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'note-1',
    );
  });

  it('delegates endorsement note reads with authenticated tenant context', async () => {
    const controller = createController();
    notesService.findAllEndorsementNotes.mockResolvedValue([]);

    const listResult = await controller.findEndorsementNotes(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.findEndorsementNote(
      'placement-1',
      'endorsement-1',
      'note-1',
      { user } as never,
    );

    expect(notesService.findAllEndorsementNotes).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(notesService.findEndorsementNote).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'note-1',
    );
  });

  it('delegates note create, issue and void with authenticated user context', async () => {
    const controller = createController();

    await controller.createDebitNote('placement-1', { user } as never);
    await controller.createCreditNote('placement-1', 'closing-1', {
      user,
    } as never);
    await controller.issueNote(
      'placement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
      { user } as never,
    );
    await controller.voidNote(
      'placement-1',
      'note-1',
      { voidReason: 'Issued in error' },
      { user } as never,
    );

    expect(notesService.createDebitNote).toHaveBeenCalledWith(
      user,
      'placement-1',
    );
    expect(notesService.createCreditNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
    );
    expect(notesService.issue).toHaveBeenCalledWith(
      user,
      'placement-1',
      'note-1',
      expect.objectContaining({ status: PlacementNoteStatus.ISSUED }),
    );
    expect(notesService.void).toHaveBeenCalledWith(
      user,
      'placement-1',
      'note-1',
      expect.objectContaining({ voidReason: 'Issued in error' }),
    );
  });

  it('delegates current effective debit note operations with authenticated tenant context', async () => {
    const controller = createController();
    notesService.findAllCurrentEffectiveDebitNotes.mockResolvedValue([]);

    await controller.previewEffectiveDebitNote(
      'placement-1',
      { asOfDate: '2026-06-10T00:00:00.000Z' },
      { user } as never,
    );
    await controller.createEffectiveDebitNote(
      'placement-1',
      { asOfDate: '2026-06-10T00:00:00.000Z' },
      { user } as never,
    );
    await controller.findEffectiveDebitNotes('placement-1', { user } as never);
    await controller.findEffectiveDebitNote('placement-1', 'note-1', {
      user,
    } as never);

    expect(notesService.previewCurrentEffectiveDebitNote).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      '2026-06-10T00:00:00.000Z',
    );
    expect(notesService.createCurrentEffectiveDebitNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      '2026-06-10T00:00:00.000Z',
    );
    expect(notesService.findAllCurrentEffectiveDebitNotes).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(notesService.findCurrentEffectiveDebitNote).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'note-1',
    );
  });

  it('delegates endorsement note create, issue and void with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsementDebitNote(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.createEndorsementCreditNote(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );
    await controller.issueEndorsementNote(
      'placement-1',
      'endorsement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
      { user } as never,
    );
    await controller.voidEndorsementNote(
      'placement-1',
      'endorsement-1',
      'note-1',
      { voidReason: 'Issued in error' },
      { user } as never,
    );

    expect(notesService.createEndorsementDebitNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
    );
    expect(notesService.createEndorsementCreditNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    expect(notesService.issueEndorsementNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      expect.objectContaining({ status: PlacementNoteStatus.ISSUED }),
    );
    expect(notesService.voidEndorsementNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      expect.objectContaining({ voidReason: 'Issued in error' }),
    );
  });

  it('delegates payment reads with authenticated tenant context', async () => {
    const controller = createController();
    paymentsService.findPendingBankConfirmations.mockResolvedValue([]);
    paymentsService.findAll.mockResolvedValue([]);

    const pendingResult = await controller.findPendingBankConfirmationPayments({
      user,
    } as never);
    const listResult = await controller.findPayments('placement-1', {
      user,
    } as never);
    await controller.findPayment('placement-1', 'payment-1', {
      user,
    } as never);

    expect(paymentsService.findPendingBankConfirmations).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(pendingResult).toEqual({ items: [] });
    expect(paymentsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(paymentsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'payment-1',
    );
  });

  it('delegates payment create, bank confirmation and reverse with authenticated user context', async () => {
    const controller = createController();
    const dto = {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    };
    const bankConfirmationDto = {
      bankConfirmedAt: '2026-06-05T10:00:00.000Z',
      bankReference: 'BANK-CONF-001',
      accountingCashAccountId: 'cash-account-1',
      bankChargeAmount: 25,
    };

    await controller.createPayment('placement-1', dto, { user } as never);
    await controller.confirmPaymentBankCompletion(
      'placement-1',
      'payment-1',
      bankConfirmationDto,
      { user } as never,
    );
    await controller.reversePayment('placement-1', 'payment-1', {
      user,
    } as never);

    expect(paymentsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      dto,
    );
    expect(paymentsService.confirmBankPayment).toHaveBeenCalledWith(
      user,
      'placement-1',
      'payment-1',
      bankConfirmationDto,
    );
    expect(paymentsService.reverse).toHaveBeenCalledWith(
      user,
      'placement-1',
      'payment-1',
    );
  });

  it('allows policy-number-only updates with partial edit permission only', async () => {
    const controller = createController();
    const partialEditor = employeeWithPermissions([
      FacultativeOfferPermission.PARTIAL_EDIT,
    ]);

    await controller.update('placement-1', { policyNumber: 'POL-2026-002' }, {
      user: partialEditor,
    } as never);

    expect(service.update).toHaveBeenCalledWith(partialEditor, 'placement-1', {
      policyNumber: 'POL-2026-002',
    });
  });

  it('rejects material placement updates with partial edit permission only', () => {
    const controller = createController();
    const partialEditor = employeeWithPermissions([
      FacultativeOfferPermission.PARTIAL_EDIT,
    ]);

    expect(() =>
      controller.update('placement-1', { title: 'Material title change' }, {
        user: partialEditor,
      } as never),
    ).toThrow(ForbiddenException);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('allows material placement updates with edit-offer permission', async () => {
    const controller = createController();
    const editor = employeeWithPermissions([
      FacultativeOfferPermission.EDIT_OFFER,
    ]);

    await controller.update('placement-1', { title: 'Material title change' }, {
      user: editor,
    } as never);

    expect(service.update).toHaveBeenCalledWith(editor, 'placement-1', {
      title: 'Material title change',
    });
  });

  it('requires inbound premium permission for cedant receipts', async () => {
    const controller = createController();
    const receiptOnly = employeeWithPermissions([
      PremiumPermission.RECEIVE_FROM_CEDANT,
    ]);
    const disbursementOnly = employeeWithPermissions([
      PremiumPermission.DISBURSE_TO_REINSURER,
    ]);
    const dto = {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    };

    await controller.createPayment('placement-1', dto, {
      user: receiptOnly,
    } as never);

    expect(paymentsService.create).toHaveBeenCalledWith(
      receiptOnly,
      'placement-1',
      dto,
    );
    expect(() =>
      controller.createPayment('placement-1', dto, {
        user: disbursementOnly,
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('requires outbound premium permission for reinsurer disbursements', async () => {
    const controller = createController();
    const receiptOnly = employeeWithPermissions([
      PremiumPermission.RECEIVE_FROM_CEDANT,
    ]);
    const disbursementOnly = employeeWithPermissions([
      PremiumPermission.DISBURSE_TO_REINSURER,
    ]);
    const dto = {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    };

    await controller.createPayment('placement-1', dto, {
      user: disbursementOnly,
    } as never);

    expect(paymentsService.create).toHaveBeenCalledWith(
      disbursementOnly,
      'placement-1',
      dto,
    );
    expect(() =>
      controller.createPayment('placement-1', dto, {
        user: receiptOnly,
      } as never),
    ).toThrow(ForbiddenException);
  });
});
