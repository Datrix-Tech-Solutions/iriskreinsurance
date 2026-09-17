'use client';

import { useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FollowUpForm, FollowUpFields } from '@/components/molecules/marketing/FollowUpForm';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const EMPTY_FORM: FollowUpFields = { prospectName: '', followUpDate: '', notes: '' };
type PanelMode = 'add' | 'edit';

export default function UpcomingFollowUpsPage() {
  const [items, setItems] = useState<CardListItem[]>([]);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowUpFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FollowUpFields>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('add');
    setEditingId(null);
    setPanelOpen(true);
  }

  function openEdit(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const [prospectName, followUpDate] = [item.label, item.sublabel ?? ''];
    setForm({ prospectName, followUpDate, notes: '' });
    setErrors({});
    setPanelMode('edit');
    setEditingId(id);
    setPanelOpen(true);
  }

  function validate(): boolean {
    const next: Partial<FollowUpFields> = {};
    if (!form.prospectName.trim()) next.prospectName = 'Prospect name is required.';
    if (!form.followUpDate) next.followUpDate = 'Follow-up date is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function handleSave() {
    if (!validate()) return;
    const label = form.prospectName.trim();
    const sublabel = form.followUpDate ? `Follow-up: ${formatDate(form.followUpDate)}` : undefined;

    if (panelMode === 'add') {
      setItems((prev) => [...prev, { id: Date.now().toString(), label, sublabel }]);
    } else if (editingId) {
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, label, sublabel } : i)));
    }
    setPanelOpen(false);
  }

  function handleDelete() {
    if (!deleteId) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <CardList
          addLabel="Add Follow Up"
          items={filtered}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
          searchValue={search}
          onSearchChange={setSearch}
        />
      </div>

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelMode === 'add' ? 'Add Follow Up' : 'Edit Follow Up'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {panelMode === 'add' ? 'Add Follow Up' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <FollowUpForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Follow Up"
        description="Are you sure you want to remove this follow up? This action cannot be undone."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}
