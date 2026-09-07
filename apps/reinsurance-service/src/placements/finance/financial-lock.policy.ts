import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PlacementStatus } from '../../../prisma/generated/client';
import { PlacementLockStatusDto } from '../dto/placement-lock-status.dto';
import { PlacementFinancialActivityReader } from './financial-activity.reader';

type PlacementLockSubject = {
  id: string;
  tenantId: string;
  status: PlacementStatus;
};

@Injectable()
export class PlacementFinancialLockPolicy {
  constructor(
    private readonly financialActivityReader: PlacementFinancialActivityReader,
  ) {}

  async evaluate(
    placement: PlacementLockSubject,
  ): Promise<PlacementLockStatusDto> {
    const activity = await this.financialActivityReader.findLockingActivity(
      placement.tenantId,
      placement.id,
    );

    if (activity) {
      return {
        editable: false,
        locked: true,
        endorsementRequired: true,
        reason: 'Placement is financially locked. Changes require endorsement.',
        lockSource: activity.source,
        lockedAt: activity.lockedAt?.toISOString(),
        canEdit: false,
        editBlockedReason:
          'Placement is financially locked. Changes require endorsement.',
        editRequiresEndorsement: true,
      };
    }

    if (this.isTerminalStatus(placement.status)) {
      return {
        editable: false,
        locked: false,
        endorsementRequired: false,
        reason: `Cannot edit a ${placement.status} placement.`,
        lockSource: 'STATUS_TERMINAL',
        canEdit: false,
        editBlockedReason: `Cannot edit a ${placement.status} placement.`,
        editRequiresEndorsement: false,
      };
    }

    return {
      editable: true,
      locked: false,
      endorsementRequired: false,
      reason: 'Placement has no financial activity and can be edited.',
      lockSource: 'NONE',
      canEdit: true,
      editRequiresEndorsement: false,
    };
  }

  async assertEditable(placement: PlacementLockSubject): Promise<void> {
    const status = await this.evaluate(placement);
    if (status.editable) return;
    if (status.locked) {
      throw new ConflictException(status.reason);
    }
    throw new BadRequestException(status.reason);
  }

  async assertArchivable(placement: PlacementLockSubject): Promise<void> {
    const status = await this.evaluate(placement);
    if (status.locked) {
      throw new ConflictException(status.reason);
    }
  }

  private isTerminalStatus(status: PlacementStatus): boolean {
    return (
      status === PlacementStatus.CLOSED || status === PlacementStatus.CANCELLED
    );
  }
}
