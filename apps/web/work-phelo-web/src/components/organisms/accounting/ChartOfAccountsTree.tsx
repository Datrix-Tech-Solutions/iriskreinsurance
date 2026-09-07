'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileText } from 'lucide-react';
import { cardClass, cn } from '@/lib/utils';
import { useAccountClassifications, useAccountGroups, useGLAccounts } from '@/hooks';
import {
  AccountClassification,
  AccountGroup,
  GLAccount,
  GLAccountCategory,
  GLAccountStatus,
} from '@/types/accounting';

const CATEGORIES: { value: GLAccountCategory; label: string; code: string; color: string }[] = [
  { value: 'ASSET', label: 'Asset', code: '1000', color: 'text-blue-500' },
  { value: 'LIABILITY', label: 'Liability', code: '2000', color: 'text-red-500' },
  { value: 'EQUITY', label: 'Equity', code: '3000', color: 'text-purple-500' },
  { value: 'REVENUE', label: 'Revenue', code: '4000', color: 'text-green-500' },
  { value: 'EXPENSE', label: 'Expense', code: '5000', color: 'text-orange-500' },
];

/** Selected-row tint, matching the color of the type folder a row lives under. */
const SELECTED_TINTS: Record<string, string> = {
  'text-blue-500': 'bg-blue-200',
  'text-red-500': 'bg-red-200',
  'text-purple-500': 'bg-purple-200',
  'text-green-500': 'bg-green-200',
  'text-orange-500': 'bg-orange-200',
};

/** Same glass fade-in used for DataTable row hovers, scaled down to tree rows. */
function RowHoverOverlay() {
  return (
    <div
      className={cardClass(
        'absolute inset-0.5 rounded-lg bg-(--table-header-bg,var(--color-gray-200)) opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 pointer-events-none',
        'glass',
      )}
    />
  );
}

interface GroupNodeProps {
  color: string;
  group: AccountGroup;
  glAccounts: GLAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (account: GLAccount) => void;
}

function GroupNode({
  color,
  group,
  glAccounts,
  selectedAccountId,
  onSelectAccount,
}: GroupNodeProps) {
  const [open, setOpen] = useState(false);
  const hasAccounts = glAccounts.length > 0;

  if (!hasAccounts) {
    return (
      <div className="relative group/row rounded-lg">
        <RowHoverOverlay />
        <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600">
          <File className={cn('w-4 h-4 shrink-0', color)} />
          <span className="text-xs font-semibold text-gray-400 shrink-0">{group.code}</span>
          <span className="truncate">{group.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative group/row rounded-lg">
        <RowHoverOverlay />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          {open ? (
            <FolderOpen className={cn('w-4 h-4 shrink-0', color)} />
          ) : (
            <Folder className={cn('w-4 h-4 shrink-0', color)} />
          )}
          <span className="text-xs font-semibold text-gray-400 shrink-0">{group.code}</span>
          <span className="truncate">{group.name}</span>
          <span className="ml-auto text-xs text-gray-400">{glAccounts.length}</span>
        </button>
      </div>

      {open && (
        <div className="ml-6 border-l border-gray-100 pl-3 flex flex-col">
          {glAccounts.map((account) => {
            const isSelected = account.id === selectedAccountId;
            return (
              <div key={account.id} className="relative group/row rounded-lg">
                <RowHoverOverlay />
                <button
                  type="button"
                  onClick={() => onSelectAccount?.(account)}
                  className={cn(
                    'relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600',
                    isSelected && (SELECTED_TINTS[color] ?? 'bg-gray-100'),
                  )}
                >
                  <FileText className={cn('w-4 h-4 shrink-0', color)} />
                  <span className="text-xs font-semibold text-gray-400 shrink-0">
                    {account.code}
                  </span>
                  <span className="truncate">{account.name}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ClassificationNodeProps {
  color: string;
  classification: AccountClassification;
  groups: AccountGroup[];
  glAccounts: GLAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (account: GLAccount) => void;
}

function ClassificationNode({
  color,
  classification,
  groups,
  glAccounts,
  selectedAccountId,
  onSelectAccount,
}: ClassificationNodeProps) {
  const [open, setOpen] = useState(false);
  const hasGroups = groups.length > 0;

  if (!hasGroups) {
    return (
      <div className="relative group/row rounded-lg">
        <RowHoverOverlay />
        <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600">
          <span className="w-4 h-4 shrink-0" />
          <File className={cn('w-4 h-4 shrink-0', color)} />
          <span className="text-xs font-semibold text-gray-400 shrink-0">
            {classification.code}
          </span>
          <span className="truncate">{classification.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative group/row rounded-lg">
        <RowHoverOverlay />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          {open ? (
            <FolderOpen className={cn('w-4 h-4 shrink-0', color)} />
          ) : (
            <Folder className={cn('w-4 h-4 shrink-0', color)} />
          )}
          <span className="text-xs font-semibold text-gray-400 shrink-0">
            {classification.code}
          </span>
          <span className="truncate">{classification.name}</span>
          <span className="ml-auto text-xs text-gray-400">{groups.length}</span>
        </button>
      </div>

      {open && (
        <div className="ml-6 border-l border-gray-100 pl-3 flex flex-col">
          {groups.map((group) => (
            <GroupNode
              key={group.id}
              color={color}
              group={group}
              glAccounts={glAccounts.filter((a) => a.accountGroupId === group.id)}
              selectedAccountId={selectedAccountId}
              onSelectAccount={onSelectAccount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TypeNodeProps {
  label: string;
  code: string;
  color: string;
  open: boolean;
  onToggle: () => void;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  glAccounts: GLAccount[];
  unclassifiedAccounts: GLAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (account: GLAccount) => void;
}

function TypeNode({
  label,
  code,
  color,
  open,
  onToggle,
  classifications,
  groups,
  glAccounts,
  unclassifiedAccounts,
  selectedAccountId,
  onSelectAccount,
}: TypeNodeProps) {
  return (
    <div>
      <div className="relative group/row rounded-lg">
        <RowHoverOverlay />
        <button
          type="button"
          onClick={onToggle}
          className="relative w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm text-gray-700"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          {open ? (
            <FolderOpen className={cn('w-5 h-5 shrink-0', color)} />
          ) : (
            <Folder className={cn('w-5 h-5 shrink-0', color)} />
          )}
          <span className="text-xs font-semibold text-gray-400 shrink-0">{code}</span>
          <span className="font-medium">{label}</span>
          <span className="ml-auto text-xs text-gray-400">
            {classifications.length + (unclassifiedAccounts.length > 0 ? 1 : 0)}
          </span>
        </button>
      </div>

      {open && (
        <div className="ml-6 border-l border-gray-100 pl-3 flex flex-col">
          {classifications.length > 0 &&
            classifications.map((classification) => (
              <ClassificationNode
                key={classification.id}
                color={color}
                classification={classification}
                groups={groups.filter((g) => g.classificationId === classification.id)}
                glAccounts={glAccounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={onSelectAccount}
              />
            ))}
          {unclassifiedAccounts.length > 0 && (
            <div className="mt-1 rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">Unclassified accounts</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Assign these accounts to a standard group when their hierarchy is ready.
              </p>
              <div className="mt-2 flex flex-col">
                {unclassifiedAccounts.map((account) => {
                  const isSelected = account.id === selectedAccountId;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => onSelectAccount?.(account)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-amber-100',
                        isSelected && (SELECTED_TINTS[color] ?? 'bg-gray-100'),
                      )}
                    >
                      <FileText className={cn('h-4 w-4 shrink-0', color)} />
                      <span className="shrink-0 text-xs font-semibold text-gray-400">
                        {account.code}
                      </span>
                      <span className="truncate">{account.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {classifications.length === 0 && unclassifiedAccounts.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No accounts</p>
          )}
        </div>
      )}
    </div>
  );
}

interface ChartOfAccountsTreeProps {
  /** When true, render a narrow icon-only rail instead of the full tree. */
  collapsed?: boolean;
  /** Called when a rail icon is clicked, so the host panel can expand back to full width. */
  onExpand?: () => void;
  selectedAccountId?: string;
  onSelectAccount?: (account: GLAccount) => void;
  search?: string;
  status?: GLAccountStatus;
}

export function ChartOfAccountsTree({
  collapsed = false,
  onExpand,
  selectedAccountId,
  onSelectAccount,
  search = '',
  status,
}: ChartOfAccountsTreeProps) {
  const { data: classificationsData, isLoading: isLoadingClassifications } =
    useAccountClassifications();
  const { data: groupsData, isLoading: isLoadingGroups } = useAccountGroups();
  const { data: glAccountsData, isLoading: isLoadingGLAccounts } = useGLAccounts();

  const classifications = useMemo(() => classificationsData?.items ?? [], [classificationsData]);
  const groups = useMemo(() => groupsData?.items ?? [], [groupsData]);
  const glAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (glAccountsData ?? []).filter((account) => {
      const matchesSearch =
        !normalizedSearch ||
        account.code.toLowerCase().includes(normalizedSearch) ||
        account.name.toLowerCase().includes(normalizedSearch) ||
        account.description?.toLowerCase().includes(normalizedSearch);
      return matchesSearch && (!status || account.status === status);
    });
  }, [glAccountsData, search, status]);

  const hasAccountFilter = Boolean(search.trim() || status);
  const visibleGroups = useMemo(
    () =>
      hasAccountFilter
        ? groups.filter((group) =>
            glAccounts.some((account) => account.accountGroupId === group.id),
          )
        : groups,
    [glAccounts, groups, hasAccountFilter],
  );
  const visibleClassifications = useMemo(
    () =>
      hasAccountFilter
        ? classifications.filter((classification) =>
            visibleGroups.some((group) => group.classificationId === classification.id),
          )
        : classifications,
    [classifications, hasAccountFilter, visibleGroups],
  );

  const isLoading = isLoadingClassifications || isLoadingGroups || isLoadingGLAccounts;

  // Lifted so a rail click can force a specific type open once expanded.
  const [openTypes, setOpenTypes] = useState<Set<GLAccountCategory>>(
    () => new Set(CATEGORIES.map(({ value }) => value)),
  );

  const toggleType = (value: GLAccountCategory) => {
    setOpenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const jumpToType = (value: GLAccountCategory) => {
    setOpenTypes((prev) => new Set(prev).add(value));
    onExpand?.();
  };

  if (collapsed) {
    return (
      <>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => jumpToType(cat.value)}
            title={cat.label}
            aria-label={cat.label}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Folder className={cn('w-4 h-4', cat.color)} />
          </button>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {isLoading ? (
        <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>
      ) : (
        CATEGORIES.map((cat) => (
          <TypeNode
            key={cat.value}
            label={cat.label}
            code={cat.code}
            color={cat.color}
            open={openTypes.has(cat.value)}
            onToggle={() => toggleType(cat.value)}
            classifications={visibleClassifications.filter((c) => c.category === cat.value)}
            groups={visibleGroups}
            glAccounts={glAccounts}
            unclassifiedAccounts={glAccounts.filter(
              (account) => account.category === cat.value && !account.accountGroupId,
            )}
            selectedAccountId={selectedAccountId}
            onSelectAccount={onSelectAccount}
          />
        ))
      )}
    </div>
  );
}
