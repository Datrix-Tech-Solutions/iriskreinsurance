import { BadRequestException } from '@nestjs/common';
import { PlacementDocumentType } from '../../../../prisma/generated/client';
import { PlacementDocumentTemplateRegistry } from './placement-document-template.registry';

describe('PlacementDocumentTemplateRegistry', () => {
  const registry = new PlacementDocumentTemplateRegistry();
  const documentProfile = {
    tenantId: 'tenant-1',
    identity: {
      displayName: 'Acme Brokers',
      legalName: 'Acme Brokers Limited',
      registrationNumber: 'CS-123',
      taxNumber: 'TIN-123',
    },
    contact: {
      physicalAddress: '1 Broker Street',
      postalAddress: 'P.O. Box 1',
      phone: '+233200000000',
      email: 'broker@acme.example',
      website: 'https://acme.example',
    },
    footer: { text: 'Licensed insurance broker' },
    branding: {
      logo: {
        mimeType: 'image/png',
        fileName: 'logo.png',
        sizeBytes: 4,
        dataUri: 'data:image/png;base64,bG9nbw==',
      },
      signature: null,
      colors: { primaryColor: '#123456' },
      version: 3,
    },
    banking: {
      defaultCurrency: 'GHS',
      defaultAccounts: [
        {
          id: 'account-1',
          bankName: 'GCB Bank',
          branchName: 'High Street',
          accountName: 'Acme Brokers Limited',
          accountNumber: '1036000007232',
          currency: 'GHS',
          swiftCode: 'GHCBGHAC',
          sortCode: null,
        },
      ],
    },
    signatory: { name: 'Ama Mensah', title: 'Managing Director' },
    profileActive: true,
    defaultsApplied: false,
  };
  const offerSlipPayload = {
    documentType: PlacementDocumentType.OFFER_SLIP,
    placement: {
      reference: 'FAC-001',
      policyNumber: 'POL-001',
      classOfBusiness: 'Engineering',
      currency: 'GHS',
      inceptionDate: '2026-01-01',
      expiryDate: '2026-12-31',
      sumInsured: 1000000,
      premium: 50000,
      commission: 10,
      facultativeOffer: 60,
    },
    cedant: { name: 'Acme Insurance' },
    businessEntries: [
      {
        key: 'originalInsured',
        label: 'Original Insured',
        value: 'Acme Plant',
      },
    ],
    offerEntries: [
      { key: 'policyNumber', label: 'Policy Number', value: 'POL-001' },
    ],
    participantPreview: {
      participant: {
        id: 'participant-1',
        sharePercent: 40,
        brokerageFee: 7.5,
        counterparty: { name: 'Avenue Re' },
      },
      slipFinancials: {
        facOffer: 60,
        facSumInsured: 600000,
      },
      distributionFinancials: {
        premiumShare: 12000,
        brokerageFee: 7.5,
        brokerageAmount: 900,
      },
    },
    offerContext: {
      participantId: 'participant-1',
      reinsurerName: 'Avenue Re',
      offeredLinePercent: 40,
    },
    branding: {
      productName: 'WorkPhelo',
      documentFamily: 'Reinsurance Operations',
    },
  };
  const notePayload = (type: PlacementDocumentType) => ({
    documentType: type,
    note: {
      type,
      noteNumber:
        type === PlacementDocumentType.DEBIT_NOTE
          ? 'DN-001'
          : type === PlacementDocumentType.CREDIT_NOTE
            ? 'CN-001'
            : type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
              ? 'EDN-001'
              : 'ECN-001',
      status: 'ISSUED',
      direction:
        type === PlacementDocumentType.DEBIT_NOTE ||
        type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
          ? 'CEDANT_TO_BROKER'
          : 'BROKER_TO_REINSURER',
      noteDate: '2026-06-12T00:00:00.000Z',
      currency: 'GHS',
      grossAmount: '5000',
      commissionPercent: '10',
      commissionAmount: '500',
      brokeragePercent: '5',
      brokerageAmount: '250',
      nicLevyPercent: '1',
      nicLevyAmount: '50',
      withholdingTaxPercent: '2',
      withholdingTaxAmount: '100',
      netAmount: '4100',
      placement: {
        reference: 'FAC-001',
        title: 'Engineering Risk',
      },
      counterparty: {
        name:
          type === PlacementDocumentType.DEBIT_NOTE ||
          type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
            ? 'Acme Insurance'
            : 'Avenue Re',
        registrationNumber: 'REG-001',
        email: 'finance@example.com',
        country: 'GH',
      },
      closing: { closingNumber: 'CLO-001' },
      endorsement: { endorsementNumber: 'END-001' },
      endorsementClosing: { closingNumber: 'END-CLO-001' },
    },
    branding: {
      productName: 'WorkPhelo',
      documentFamily: 'Reinsurance Operations',
    },
  });

  it('resolves CLOSING_SLIP templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.CLOSING_SLIP,
      {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: {
          closingNumber: 'CLO-001',
          currency: 'GHS',
          signedLinePercent: '40',
          participant: {
            counterparty: { name: 'Avenue Re' },
          },
        },
      },
      {
        documentNumber: 'DOC-CS-001',
        title: 'Closing Slip CLO-001',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('Closing Slip');
    expect(html).toContain('DOC-CS-001');
    expect(html).toContain('CLO-001');
    expect(html).toContain('Avenue Re');
  });

  it('resolves OFFER_SLIP templates', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.OFFER_SLIP,
      offerSlipPayload,
      {
        documentNumber: 'DOC-OS-001',
        title: 'Offer Slip FAC-001 - Avenue Re',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('Offer Slip');
    expect(html).toContain('DOC-OS-001');
    expect(html).toContain('Avenue Re');
    expect(html).toContain('POL-001');
    expect(html).toContain('100% Sum Insured');
    expect(html).toContain('Net Premium');
  });

  it('renders newly generated offer slips from the tenant profile snapshot', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.OFFER_SLIP,
      { ...offerSlipPayload, branding: undefined, documentProfile },
      {
        documentNumber: 'DOC-OS-001',
        title: 'Offer Slip FAC-001 - Avenue Re',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('Acme Brokers');
    expect(html).toContain('data:image/png;base64,bG9nbw==');
    expect(html).toContain('Licensed insurance broker');
    expect(html).toContain('1 Broker Street');
    expect(html).not.toContain('For Broker / WorkPhelo');
  });

  it.each([
    [PlacementDocumentType.DEBIT_NOTE, 'Debit Note', 'Acme Insurance'],
    [PlacementDocumentType.CREDIT_NOTE, 'Credit Note', 'Avenue Re'],
    [
      PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE,
      'Endorsement Debit Note',
      'Acme Insurance',
    ],
    [
      PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      'Endorsement Credit Note',
      'Avenue Re',
    ],
  ])('resolves %s templates', (type, title, counterparty) => {
    const html = registry.renderHtml(type, notePayload(type), {
      documentNumber: 'DOC-NOTE-001',
      title,
      generatedAt: '2026-06-12T00:00:00.000Z',
    });

    expect(html).toContain(title);
    expect(html).toContain('DOC-NOTE-001');
    expect(html).toContain(counterparty);
    expect(html).toContain('Gross Amount');
    expect(html).toContain('Commission');
    expect(html).toContain('Brokerage');
    expect(html).toContain('NIC Levy');
    expect(html).toContain('Withholding Tax');
    expect(html).toContain('Net Amount');
    expect(html).toContain('Authorized signature / stamp');
    expect(html).toContain(
      'rendered from an immutable PlacementDocument payload',
    );
  });

  it('renders debit-note payment and signatory details from the snapshot', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.DEBIT_NOTE,
      {
        ...notePayload(PlacementDocumentType.DEBIT_NOTE),
        branding: undefined,
        documentProfile,
      },
      {
        documentNumber: 'DOC-DN-001',
        title: 'Debit Note',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('Acme Brokers');
    expect(html).toContain('Payment Instructions (GHS)');
    expect(html).toContain('1036000007232');
    expect(html).toContain('GHCBGHAC');
    expect(html).toContain('Ama Mensah');
    expect(html).toContain('Managing Director');
    expect(html).toContain('Licensed insurance broker');
  });

  it('renders legacy note payloads with null applied charges without recalculating', () => {
    const html = registry.renderHtml(
      PlacementDocumentType.DEBIT_NOTE,
      {
        ...notePayload(PlacementDocumentType.DEBIT_NOTE),
        note: {
          ...notePayload(PlacementDocumentType.DEBIT_NOTE).note,
          appliedCharges: null,
        },
      },
      {
        documentNumber: 'DOC-DN-LEGACY',
        title: 'Debit Note',
        generatedAt: '2026-06-12T00:00:00.000Z',
      },
    );

    expect(html).toContain('DOC-DN-LEGACY');
    expect(html).toContain('NIC Levy');
    expect(html).toContain('50.00');
    expect(html).toContain('Withholding Tax');
    expect(html).toContain('100.00');
    expect(html).not.toContain('NaN');
  });

  it('renders endorsement slip and certificate payloads', () => {
    const endorsementHtml = registry.renderHtml(
      PlacementDocumentType.ENDORSEMENT_SLIP,
      {
        documentType: PlacementDocumentType.ENDORSEMENT_SLIP,
        endorsement: {
          endorsementNumber: 'END-001',
          type: 'POLICY_AMENDMENT',
          impactType: 'ADMINISTRATIVE',
          status: 'CLOSING',
          effectiveDate: '2026-07-01T00:00:00.000Z',
          originalSnapshot: { placement: { title: 'Original Risk' } },
          proposedSnapshot: { placement: { title: 'Revised Risk' } },
          placement: {
            reference: 'FAC-001',
            title: 'Revised Risk',
            currency: 'GHS',
            cedant: { name: 'Acme Insurance' },
          },
          participants: [
            {
              status: 'CLOSED',
              signedLinePercent: '40',
              counterparty: { name: 'Avenue Re' },
            },
          ],
          closings: [
            {
              status: 'CONFIRMED',
              closingNumber: 'ENC-001',
              signedLinePercent: '40',
              premiumSnapshot: '5000',
              netPremium: '4500',
              endorsementParticipant: {
                counterparty: { name: 'Avenue Re' },
              },
            },
          ],
          notes: [],
        },
        documentProfile: {
          identity: { displayName: 'BrokerCo', legalName: 'BrokerCo Ltd' },
          contact: {},
          footer: { text: 'BrokerCo footer' },
          branding: {},
          banking: { defaultAccounts: [] },
          signatory: { name: 'Ama Broker', title: 'Managing Broker' },
        },
      },
      {
        documentNumber: 'DOC-ES-001',
        title: 'Endorsement Slip',
        generatedAt: '2026-07-01T00:00:00.000Z',
      },
    );

    expect(endorsementHtml).toContain('Endorsement Slip');
    expect(endorsementHtml).toContain('END-001');
    expect(endorsementHtml).toContain('Confirmed Endorsement Closings');
    expect(endorsementHtml).not.toContain('NaN');

    const certificateHtml = registry.renderHtml(
      PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
      {
        documentType: PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
        endorsementCertificate: {
          closingNumber: 'ENC-001',
          status: 'CONFIRMED',
          signedLinePercent: '40',
          premiumSnapshot: '5000',
          commissionAmount: '500',
          brokerageAmount: '250',
          netPremium: '4250',
          currency: 'GHS',
          placement: {
            reference: 'FAC-001',
            title: 'Revised Risk',
            currency: 'GHS',
            cedant: { name: 'Acme Insurance' },
          },
          endorsement: {
            endorsementNumber: 'END-001',
            effectiveDate: '2026-07-01T00:00:00.000Z',
            originalSnapshot: { placement: { title: 'Original Risk' } },
            proposedSnapshot: { placement: { title: 'Revised Risk' } },
          },
          endorsementParticipant: {
            counterparty: { name: 'Avenue Re' },
            originalParticipant: { signedLinePercent: '35' },
          },
          notes: [],
        },
        documentProfile: {
          identity: { displayName: 'BrokerCo', legalName: 'BrokerCo Ltd' },
          contact: {},
          footer: { text: 'BrokerCo footer' },
          branding: {},
          banking: { defaultAccounts: [] },
          signatory: { name: 'Ama Broker', title: 'Managing Broker' },
        },
      },
      {
        documentNumber: 'DOC-ECF-001',
        title: 'Endorsement Certificate',
        generatedAt: '2026-07-01T00:00:00.000Z',
      },
    );

    expect(certificateHtml).toContain('Endorsement Certificate');
    expect(certificateHtml).toContain('ENC-001');
    expect(certificateHtml).toContain('Confirmed Participation');
    expect(certificateHtml).not.toContain('NaN');
  });

  it('rejects unsupported document types', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.CLAIM_NOTICE,
        { documentType: PlacementDocumentType.CLAIM_NOTICE },
        {
          documentNumber: 'DOC-CLM-001',
          title: 'Claim Notice',
          generatedAt: null,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid CLOSING_SLIP render payloads', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.CLOSING_SLIP,
        { documentType: PlacementDocumentType.CLOSING_SLIP },
        {
          documentNumber: 'DOC-CS-001',
          title: 'Closing Slip',
          generatedAt: null,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid OFFER_SLIP render payloads', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.OFFER_SLIP,
        { documentType: PlacementDocumentType.OFFER_SLIP },
        {
          documentNumber: 'DOC-OS-001',
          title: 'Offer Slip',
          generatedAt: null,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed note render payloads', () => {
    expect(() =>
      registry.renderHtml(
        PlacementDocumentType.DEBIT_NOTE,
        {
          documentType: PlacementDocumentType.DEBIT_NOTE,
          note: {
            type: PlacementDocumentType.DEBIT_NOTE,
            noteNumber: 'DN-001',
            currency: 'GHS',
          },
        },
        {
          documentNumber: 'DOC-DN-001',
          title: 'Debit Note',
          generatedAt: null,
        },
      ),
    ).toThrow('DEBIT_NOTE renderPayload is missing valid immutable note data');
  });
});
