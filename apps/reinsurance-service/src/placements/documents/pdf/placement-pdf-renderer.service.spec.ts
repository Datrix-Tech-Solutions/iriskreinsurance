import {
  PlacementDocumentStatus,
  PlacementDocumentType,
} from '../../../../prisma/generated/client';
import { PlacementDocumentTemplateRegistry } from './placement-document-template.registry';
import { PlacementPdfRendererService } from './placement-pdf-renderer.service';

const pdfMock = jest.fn();
const setContentMock = jest.fn();
const newPageMock = jest.fn();
const closeMock = jest.fn();
const launchMock = jest.fn();

jest.mock('playwright-core', () => ({
  chromium: {
    launch: (...args: unknown[]): unknown => {
      const result: unknown = launchMock(...args);
      return result;
    },
  },
}));

describe('PlacementPdfRendererService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pdfMock.mockResolvedValue(Buffer.from('%PDF mocked'));
    setContentMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock,
      pdf: pdfMock,
    });
    closeMock.mockResolvedValue(undefined);
    launchMock.mockResolvedValue({
      newPage: newPageMock,
      close: closeMock,
    });
    delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  });

  it('renders registry HTML through Playwright Chromium', async () => {
    const renderer = new PlacementPdfRendererService(
      new PlacementDocumentTemplateRegistry(),
    );

    const pdf = await renderer.render({
      documentNumber: 'DOC-CS-001',
      title: 'Closing Slip CLO-001',
      type: PlacementDocumentType.CLOSING_SLIP,
      status: PlacementDocumentStatus.GENERATED,
      generatedAt: '2026-06-12T00:00:00.000Z',
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    });

    expect(pdf.toString()).toBe('%PDF mocked');
    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }),
    );
    expect(setContentMock).toHaveBeenCalledWith(
      expect.stringContaining('DOC-CS-001'),
      { waitUntil: 'networkidle' },
    );
    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        printBackground: true,
      }),
    );
    expect(closeMock).toHaveBeenCalled();
  });

  it('uses configured system Chromium path when provided', async () => {
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = '/usr/bin/chromium';
    const renderer = new PlacementPdfRendererService(
      new PlacementDocumentTemplateRegistry(),
    );

    await renderer.render({
      documentNumber: 'DOC-CS-001',
      title: 'Closing Slip CLO-001',
      type: PlacementDocumentType.CLOSING_SLIP,
      status: PlacementDocumentStatus.GENERATED,
      generatedAt: null,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    });

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/usr/bin/chromium',
      }),
    );
  });

  it('renders participant offer slip payloads through the shared registry', async () => {
    const renderer = new PlacementPdfRendererService(
      new PlacementDocumentTemplateRegistry(),
    );

    await renderer.render({
      documentNumber: 'DOC-OS-001',
      title: 'Offer Slip FAC-001 - Avenue Re',
      type: PlacementDocumentType.OFFER_SLIP,
      status: PlacementDocumentStatus.GENERATED,
      generatedAt: '2026-06-12T00:00:00.000Z',
      renderPayload: {
        documentType: PlacementDocumentType.OFFER_SLIP,
        placement: {
          reference: 'FAC-001',
          currency: 'GHS',
          sumInsured: 1000000,
          premium: 50000,
          commission: 10,
          facultativeOffer: 60,
        },
        cedant: { name: 'Acme Insurance' },
        participantPreview: {
          participant: {
            sharePercent: 40,
            brokerageFee: 7.5,
            counterparty: { name: 'Avenue Re' },
          },
          slipFinancials: { facOffer: 60, facSumInsured: 600000 },
          distributionFinancials: {
            premiumShare: 12000,
            brokerageFee: 7.5,
            brokerageAmount: 900,
          },
        },
        offerContext: { offeredLinePercent: 40 },
        branding: { productName: 'WorkPhelo' },
      },
    });

    expect(setContentMock).toHaveBeenCalledWith(
      expect.stringContaining('Avenue Re'),
      { waitUntil: 'networkidle' },
    );
    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        printBackground: true,
      }),
    );
  });

  it.each([
    [PlacementDocumentType.DEBIT_NOTE, 'DN-001', 'Acme Insurance'],
    [PlacementDocumentType.CREDIT_NOTE, 'CN-001', 'Avenue Re'],
    [PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE, 'EDN-001', 'Acme Insurance'],
    [PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE, 'ECN-001', 'Avenue Re'],
  ])(
    'renders %s payloads through the shared registry',
    async (type, noteNumber, counterparty) => {
      const renderer = new PlacementPdfRendererService(
        new PlacementDocumentTemplateRegistry(),
      );

      await renderer.render({
        documentNumber: `DOC-${noteNumber}`,
        title: noteNumber,
        type,
        status: PlacementDocumentStatus.GENERATED,
        generatedAt: '2026-06-12T00:00:00.000Z',
        renderPayload: {
          documentType: type,
          note: {
            type,
            noteNumber,
            status: 'ISSUED',
            direction:
              type === PlacementDocumentType.DEBIT_NOTE ||
              type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
                ? 'CEDANT_TO_BROKER'
                : 'BROKER_TO_REINSURER',
            noteDate: '2026-06-12T00:00:00.000Z',
            currency: 'GHS',
            grossAmount: '5000',
            commissionAmount: '500',
            brokerageAmount: '250',
            nicLevyAmount: '50',
            withholdingTaxAmount: '100',
            netAmount: '4100',
            counterparty: { name: counterparty },
          },
          branding: { productName: 'WorkPhelo' },
        },
      });

      expect(setContentMock).toHaveBeenCalledWith(
        expect.stringContaining(counterparty),
        { waitUntil: 'networkidle' },
      );
      expect(setContentMock).toHaveBeenCalledWith(
        expect.stringContaining(noteNumber),
        { waitUntil: 'networkidle' },
      );
      expect(pdfMock).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'A4',
          printBackground: true,
        }),
      );
    },
  );
});
