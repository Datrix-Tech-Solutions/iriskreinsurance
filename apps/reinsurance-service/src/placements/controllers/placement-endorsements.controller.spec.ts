import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
} from '../../../prisma/generated/client';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../../auth/decorators/permissions.decorator';
import { PlacementEndorsementClosingsService } from '../endorsements/closings.service';
import { PlacementEndorsementsService } from '../endorsements/endorsements.service';
import { PlacementEndorsementParticipantsService } from '../endorsements/participants.service';
import {
  FacultativeOfferPermission,
  PlacementPermission,
} from '../placement.permissions';
import { PlacementEndorsementsController } from './placement-endorsements.controller';

describe('PlacementEndorsementsController', () => {
  const endorsementsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getSummary: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
  };
  const endorsementParticipantsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    reinvite: jest.fn(),
    delete: jest.fn(),
  };
  const endorsementClosingsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    validateAndConfirm: jest.fn(),
    forceClose: jest.fn(),
    changeStatus: jest.fn(),
  };
  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new PlacementEndorsementsController(
      endorsementsService as unknown as PlacementEndorsementsService,
      endorsementParticipantsService as unknown as PlacementEndorsementParticipantsService,
      endorsementClosingsService as unknown as PlacementEndorsementClosingsService,
    );

  it.each([
    ['findEndorsements', PlacementPermission.VIEW],
    ['findEndorsement', PlacementPermission.VIEW],
    ['getEndorsementSummary', PlacementPermission.VIEW],
    ['findEndorsementParticipants', PlacementPermission.VIEW],
    ['findEndorsementParticipant', PlacementPermission.VIEW],
    ['findEndorsementClosings', PlacementPermission.VIEW],
    ['findEndorsementClosing', PlacementPermission.VIEW],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementEndorsementsController.prototype[
          method as keyof PlacementEndorsementsController
        ],
      ),
    ).toEqual([permission]);
  });

  it.each([
    ['createEndorsement', PlacementPermission.CREATE],
    ['updateEndorsement', PlacementPermission.EDIT],
    ['changeEndorsementStatus', PlacementPermission.EDIT],
    ['createEndorsementParticipant', PlacementPermission.EDIT],
    ['updateEndorsementParticipant', PlacementPermission.EDIT],
    ['changeEndorsementParticipantStatus', PlacementPermission.EDIT],
    ['reinviteEndorsementParticipant', PlacementPermission.EDIT],
    ['deleteEndorsementParticipant', PlacementPermission.EDIT],
    ['createEndorsementClosing', PlacementPermission.EDIT],
    ['validateAndConfirmEndorsementParticipant', PlacementPermission.EDIT],
    ['forceCloseEndorsement', PlacementPermission.EDIT],
    ['changeEndorsementClosingStatus', PlacementPermission.EDIT],
  ])('allows endorse-offer or legacy permission on %s', (method, legacy) => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        PlacementEndorsementsController.prototype[
          method as keyof PlacementEndorsementsController
        ],
      ),
    ).toEqual([FacultativeOfferPermission.ENDORSE_OFFER, legacy]);
  });

  it('delegates endorsement reads with authenticated tenant context', async () => {
    const controller = createController();
    endorsementsService.findAll.mockResolvedValue([]);
    endorsementsService.getSummary.mockResolvedValue({ id: 'summary-1' });

    const listResult = await controller.findEndorsements('placement-1', {
      user,
    } as never);
    await controller.findEndorsement('placement-1', 'endorsement-1', {
      user,
    } as never);
    await controller.getEndorsementSummary('placement-1', 'endorsement-1', {
      user,
    } as never);

    expect(endorsementsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(endorsementsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(endorsementsService.getSummary).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
  });

  it('delegates endorsement mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsement(
      'placement-1',
      {
        type: PlacementEndorsementType.SUM_INSURED_INCREASE,
        effectiveDate: '2026-06-04T00:00:00.000Z',
        reason: 'Increase sum insured',
      },
      { user } as never,
    );
    await controller.updateEndorsement(
      'placement-1',
      'endorsement-1',
      { reason: 'Updated' },
      { user } as never,
    );
    await controller.changeEndorsementStatus(
      'placement-1',
      'endorsement-1',
      { status: PlacementEndorsementStatus.MARKETING },
      { user } as never,
    );

    expect(endorsementsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      expect.objectContaining({
        type: PlacementEndorsementType.SUM_INSURED_INCREASE,
      }),
    );
    expect(endorsementsService.update).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      expect.objectContaining({ reason: 'Updated' }),
    );
    expect(endorsementsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      expect.objectContaining({ status: PlacementEndorsementStatus.MARKETING }),
    );
  });

  it('delegates endorsement participant reads with authenticated tenant context', async () => {
    const controller = createController();
    endorsementParticipantsService.findAll.mockResolvedValue({
      items: [],
      aggregates: {
        totalOfferedPercent: 0,
        totalAcceptedPercent: 0,
        remainingPercent: null,
        declinedPercent: 0,
      },
    });

    const listResult = await controller.findEndorsementParticipants(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.findEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );

    expect(endorsementParticipantsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(listResult).toEqual({
      items: [],
      aggregates: {
        totalOfferedPercent: 0,
        totalAcceptedPercent: 0,
        remainingPercent: null,
        declinedPercent: 0,
      },
    });
    expect(endorsementParticipantsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
  });

  it('delegates endorsement participant mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      {
        counterpartyId: 'reinsurer-1',
        originalParticipantId: 'participant-1',
        sharePercent: 20,
      },
      { user } as never,
    );
    await controller.updateEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { signedLinePercent: 15 },
      { user } as never,
    );
    await controller.changeEndorsementParticipantStatus(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { status: PlacementEndorsementParticipantStatus.OFFER_SENT },
      { user } as never,
    );
    await controller.reinviteEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );
    await controller.deleteEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );

    expect(endorsementParticipantsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      expect.objectContaining({ counterpartyId: 'reinsurer-1' }),
    );
    expect(endorsementParticipantsService.update).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      expect.objectContaining({ signedLinePercent: 15 }),
    );
    expect(endorsementParticipantsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      expect.objectContaining({
        status: PlacementEndorsementParticipantStatus.OFFER_SENT,
      }),
    );
    expect(endorsementParticipantsService.reinvite).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
    expect(endorsementParticipantsService.delete).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
  });

  it('delegates endorsement closing reads with authenticated tenant context', async () => {
    const controller = createController();
    endorsementClosingsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findEndorsementClosings(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.findEndorsementClosing(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );

    expect(endorsementClosingsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(endorsementClosingsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
  });

  it('delegates endorsement closing mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsementClosing(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );
    await controller.changeEndorsementClosingStatus(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { status: PlacementClosingStatus.ISSUED },
      { user } as never,
    );
    await controller.validateAndConfirmEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );
    await controller.forceCloseEndorsement('placement-1', 'endorsement-1', {
      user,
    } as never);

    expect(endorsementClosingsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
    expect(endorsementClosingsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      expect.objectContaining({ status: PlacementClosingStatus.ISSUED }),
    );
    expect(endorsementClosingsService.validateAndConfirm).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
    expect(endorsementClosingsService.forceClose).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
    );
  });
});
