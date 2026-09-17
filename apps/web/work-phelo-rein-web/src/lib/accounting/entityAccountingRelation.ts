import {
  AccountingTradeSide,
  DEFAULT_ENTITY_ACCOUNTING_RELATION,
  EntityAccountingRelation,
  EntityType,
  SUBLEDGER_TYPE_LABELS,
  SubledgerAccount,
} from '@/types/accounting';

export type EntityAccountingRelationChipColor =
  | 'red'
  | 'green'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'teal'
  | 'gray';

export const ENTITY_ACCOUNTING_RELATION_CHIP_COLOR: Record<
  EntityAccountingRelation,
  EntityAccountingRelationChipColor
> = {
  RECEIVABLE: 'green',
  PAYABLE: 'red',
  BOTH: 'purple',
  NONE: 'gray',
};

export function resolveEntityAccountingRelation(
  entity: Pick<SubledgerAccount, 'type'>,
  entityTypes: EntityType[] | undefined,
): EntityAccountingRelation {
  const label = SUBLEDGER_TYPE_LABELS[entity.type];
  const match = entityTypes?.find((t) => t.name === label);
  return match?.accountingRelation ?? DEFAULT_ENTITY_ACCOUNTING_RELATION[entity.type];
}

export function matchesTradeSide(
  relation: EntityAccountingRelation,
  side: AccountingTradeSide,
): boolean {
  return relation === side || relation === 'BOTH';
}
