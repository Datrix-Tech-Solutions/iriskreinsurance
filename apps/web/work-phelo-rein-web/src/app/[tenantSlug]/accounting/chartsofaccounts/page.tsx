'use client';

import { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/utils';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { ActionMenuButton } from '@/components/organisms/shared/ActionMenuButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { ChartOfAccountsTree } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { AddClassificationPanel } from '@/components/organisms/accounting/panels/AddClassificationPanel';
import { AddParentAccountPanel } from '@/components/organisms/accounting/panels/AddParentAccountPanel';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { GLAccountDetail } from '@/components/organisms/accounting/GLAccountDetail';
import { GLAccount, GLAccountStatus } from '@/types/accounting';
import { useSeedStandardAccountHierarchy } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type OpenPanel = 'classification' | 'parent-account' | 'leaf-account' | null;

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [selectedAccount, setSelectedAccount] = useState<GLAccount | null>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const seedHierarchy = useSeedStandardAccountHierarchy();
  const toast = useToast();

  const seedStandardHierarchy = async () => {
    try {
      const result = await seedHierarchy.mutateAsync();
      setSeedDialogOpen(false);
      toast.success(
        `Standard hierarchy updated: ${result.classificationsCreated} classifications and ${result.groupsCreated} groups created.`,
      );
    } catch (error) {
      toast.error(extractError(error, 'Unable to seed the standard account hierarchy'));
    }
  };

  return (
    <>
      <TwoPanelShell
        header={
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-900">Chart of Accounts</h2>

            <div className={cardClass('px-4 py-2')}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-52 max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search accounts…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={inputClass(undefined, 'pl-9 pr-4 py-2')}
                  />
                </div>

                <div className="w-36">
                  <SearchSelect
                    placeholder="All statuses"
                    size="sm"
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                  />
                </div>

                <div className="flex-1" />

                <ActionMenuButton
                  label="Register Account"
                  items={[
                    {
                      label: 'Classification',
                      description: 'e.g. Current Assets',
                      onClick: () => setOpenPanel('classification'),
                    },
                    {
                      label: 'Parent Account',
                      description: 'e.g. Bank Accounts',
                      onClick: () => setOpenPanel('parent-account'),
                    },
                    {
                      label: 'Leaf Account',
                      description: 'e.g. Ecobank',
                      onClick: () => setOpenPanel('leaf-account'),
                    },
                    {
                      label: 'Seed Standard Hierarchy',
                      description: 'Add any missing standard classifications and account groups',
                      onClick: () => setSeedDialogOpen(true),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        }
        leftPanel={({ collapsed, expand }) => (
          <ChartOfAccountsTree
            collapsed={collapsed}
            onExpand={expand}
            selectedAccountId={selectedAccount?.id}
            onSelectAccount={setSelectedAccount}
            search={search}
            status={(status || undefined) as GLAccountStatus | undefined}
          />
        )}
        rightPanel={
          selectedAccount ? (
            <GLAccountDetail account={selectedAccount} />
          ) : (
            <p className="text-sm text-gray-400">Select a leaf account to view its details</p>
          )
        }
      />

      <AddClassificationPanel
        isOpen={openPanel === 'classification'}
        onClose={() => setOpenPanel(null)}
      />
      <AddParentAccountPanel
        isOpen={openPanel === 'parent-account'}
        onClose={() => setOpenPanel(null)}
      />
      <AddLeafAccountPanel
        isOpen={openPanel === 'leaf-account'}
        onClose={() => setOpenPanel(null)}
      />
      <Modal
        isOpen={seedDialogOpen}
        onClose={() => setSeedDialogOpen(false)}
        title="Seed Standard Account Hierarchy"
        description="This safely adds missing standard classifications and account groups. Existing tenant hierarchy records are preserved and will not be overwritten."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setSeedDialogOpen(false)}
              disabled={seedHierarchy.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={seedStandardHierarchy}
              isLoading={seedHierarchy.isPending}
              loadingText="Seeding…"
            >
              Seed Hierarchy
            </Button>
          </>
        }
      />
    </>
  );
}
