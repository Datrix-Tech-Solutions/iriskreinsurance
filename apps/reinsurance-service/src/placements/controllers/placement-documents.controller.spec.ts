import { StreamableFile } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { PlacementPermission } from '../placement.permissions';
import { PlacementDocumentsService } from '../documents/documents.service';
import { PlacementDocumentsController } from './placement-documents.controller';

describe('PlacementDocumentsController', () => {
  const documentsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    generateOfferSlip: jest.fn(),
    generateParticipantOfferSlip: jest.fn(),
    generateClosingSlip: jest.fn(),
    generateNoteDocument: jest.fn(),
    generateEndorsementSlip: jest.fn(),
    generateEndorsementClosingSlip: jest.fn(),
    generateEndorsementCertificate: jest.fn(),
    generateClaimNotice: jest.fn(),
    generateClaimCashCall: jest.fn(),
    renderPdf: jest.fn(),
    renderAndStorePdf: jest.fn(),
    createDownloadUrl: jest.fn(),
    void: jest.fn(),
  };

  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new PlacementDocumentsController(
      documentsService as unknown as PlacementDocumentsService,
    );

  it.each([
    ['findDocuments', PlacementPermission.VIEW],
    ['findDocument', PlacementPermission.VIEW],
    ['renderDocumentPdf', PlacementPermission.VIEW],
    ['getDocumentDownloadUrl', PlacementPermission.VIEW],
    ['generateOfferSlipDocument', PlacementPermission.EDIT],
    ['generateParticipantOfferSlipDocument', PlacementPermission.EDIT],
    ['generateClosingSlipDocument', PlacementPermission.EDIT],
    ['generateNoteDocument', PlacementPermission.EDIT],
    ['generateEndorsementSlipDocument', PlacementPermission.EDIT],
    ['generateEndorsementClosingSlipDocument', PlacementPermission.EDIT],
    ['generateEndorsementCertificateDocument', PlacementPermission.EDIT],
    ['generateClaimNoticeDocument', PlacementPermission.EDIT],
    ['generateClaimCashCallDocument', PlacementPermission.EDIT],
    ['renderAndStoreDocumentPdf', PlacementPermission.EDIT],
    ['voidDocument', PlacementPermission.EDIT],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementDocumentsController.prototype[
          method as keyof PlacementDocumentsController
        ],
      ),
    ).toEqual([permission]);
  });

  it('delegates document registry reads and generation with authenticated context', async () => {
    const controller = createController();
    documentsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findDocuments('placement-1', {
      user,
    } as never);
    await controller.findDocument('placement-1', 'document-1', {
      user,
    } as never);
    documentsService.renderPdf.mockResolvedValue(Buffer.from('%PDF'));
    const pdf = await controller.renderDocumentPdf(
      'placement-1',
      'document-1',
      { user } as never,
    );
    await controller.renderAndStoreDocumentPdf('placement-1', 'document-1', {
      user,
    } as never);
    documentsService.createDownloadUrl.mockResolvedValue({
      url: 'https://signed.example/document.pdf',
      expiresAt: new Date('2026-06-11T12:05:00.000Z'),
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });
    const downloadUrl = await controller.getDocumentDownloadUrl(
      'placement-1',
      'document-1',
      { user } as never,
    );
    await controller.generateOfferSlipDocument('placement-1', {
      user,
    } as never);
    await controller.generateParticipantOfferSlipDocument(
      'placement-1',
      'participant-1',
      { user } as never,
    );
    await controller.generateClosingSlipDocument('placement-1', 'closing-1', {
      user,
    } as never);
    await controller.generateNoteDocument('placement-1', 'note-1', {
      user,
    } as never);
    await controller.generateEndorsementSlipDocument(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.generateEndorsementClosingSlipDocument(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );
    await controller.generateEndorsementCertificateDocument(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );
    await controller.generateClaimNoticeDocument('placement-1', 'claim-1', {
      user,
    } as never);
    await controller.generateClaimCashCallDocument(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { user } as never,
    );
    await controller.voidDocument(
      'placement-1',
      'document-1',
      { voidReason: 'Replacement generated' },
      { user } as never,
    );

    expect(documentsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(documentsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(documentsService.renderPdf).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(pdf).toBeInstanceOf(StreamableFile);
    expect(documentsService.renderAndStorePdf).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(documentsService.createDownloadUrl).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(downloadUrl).toMatchObject({
      url: 'https://signed.example/document.pdf',
      mimeType: 'application/pdf',
    });
    expect(documentsService.generateOfferSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
    );
    expect(documentsService.generateParticipantOfferSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(documentsService.generateClosingSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
    );
    expect(documentsService.generateNoteDocument).toHaveBeenCalledWith(
      user,
      'placement-1',
      'note-1',
    );
    expect(documentsService.generateEndorsementSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
    );
    expect(
      documentsService.generateEndorsementClosingSlip,
    ).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    expect(
      documentsService.generateEndorsementCertificate,
    ).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    expect(documentsService.generateClaimNotice).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
    );
    expect(documentsService.generateClaimCashCall).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
    );
    expect(documentsService.void).toHaveBeenCalledWith(
      user,
      'placement-1',
      'document-1',
      expect.objectContaining({ voidReason: 'Replacement generated' }),
    );
  });
});
