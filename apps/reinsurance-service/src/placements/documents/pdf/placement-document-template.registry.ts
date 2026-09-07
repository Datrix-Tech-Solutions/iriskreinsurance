import { BadRequestException, Injectable } from '@nestjs/common';
import { PlacementDocumentType } from '../../../../prisma/generated/client';
import {
  isClosingSlipPayload,
  PlacementDocumentTemplateContext,
  renderClosingSlipTemplate,
} from './templates/closing-slip.template';
import {
  isOfferSlipPayload,
  renderOfferSlipTemplate,
} from './templates/offer-slip.template';
import {
  isNoteDocumentPayload,
  renderNoteTemplate,
} from './templates/note.template';
import {
  isEndorsementCertificatePayload,
  isEndorsementSlipPayload,
  renderEndorsementCertificateTemplate,
  renderEndorsementSlipTemplate,
} from './templates/endorsement.template';

@Injectable()
export class PlacementDocumentTemplateRegistry {
  renderHtml(
    type: PlacementDocumentType,
    payload: unknown,
    context: PlacementDocumentTemplateContext,
  ): string {
    if (type === PlacementDocumentType.CLOSING_SLIP) {
      if (!isClosingSlipPayload(payload)) {
        throw new BadRequestException(
          'CLOSING_SLIP renderPayload is missing closing data',
        );
      }

      return renderClosingSlipTemplate(payload, context);
    }

    if (type === PlacementDocumentType.OFFER_SLIP) {
      if (!isOfferSlipPayload(payload)) {
        throw new BadRequestException(
          'OFFER_SLIP renderPayload is missing participant offer data',
        );
      }

      return renderOfferSlipTemplate(payload, context);
    }

    if (
      type === PlacementDocumentType.DEBIT_NOTE ||
      type === PlacementDocumentType.CREDIT_NOTE ||
      type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE ||
      type === PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE
    ) {
      if (!isNoteDocumentPayload(payload)) {
        throw new BadRequestException(
          `${type} renderPayload is missing valid immutable note data`,
        );
      }

      return renderNoteTemplate(payload, context);
    }

    if (type === PlacementDocumentType.ENDORSEMENT_SLIP) {
      if (!isEndorsementSlipPayload(payload)) {
        throw new BadRequestException(
          'ENDORSEMENT_SLIP renderPayload is missing valid immutable endorsement data',
        );
      }

      return renderEndorsementSlipTemplate(payload, context);
    }

    if (type === PlacementDocumentType.ENDORSEMENT_CERTIFICATE) {
      if (!isEndorsementCertificatePayload(payload)) {
        throw new BadRequestException(
          'ENDORSEMENT_CERTIFICATE renderPayload is missing valid immutable endorsement closing data',
        );
      }

      return renderEndorsementCertificateTemplate(payload, context);
    }

    throw new BadRequestException(`PDF rendering is not supported for ${type}`);
  }
}
