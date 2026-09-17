import { SubledgerType } from '@/types/accounting';

// Mirrors the color union on `TypeChip` — kept as its own literal type here rather than
// importing the component's prop type, matching `ENTITY_ACCOUNTING_RELATION_CHIP_COLOR` in
// `entityAccountingRelation.ts`.
export type SubledgerTypeChipColor = 'red' | 'green' | 'blue' | 'purple' | 'amber' | 'teal' | 'gray';

/** Chip color per Entity Type, so Customer/Vendor/Employee/etc. stay visually distinct in the
 *  Entities table's Type column. */
export const SUBLEDGER_TYPE_CHIP_COLOR: Record<SubledgerType, SubledgerTypeChipColor> = {
  CUSTOMER: 'green',
  VENDOR: 'red',
  EMPLOYEE: 'blue',
  STATUTORY: 'amber',
  OTHER: 'gray',
  CEDANT: 'purple',
  REINSURER: 'teal',
};
