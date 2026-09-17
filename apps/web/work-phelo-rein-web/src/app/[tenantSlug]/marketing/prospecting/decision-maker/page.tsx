'use client';

import { useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  DecisionMakerForm,
  DecisionMakerFields,
} from '@/components/molecules/marketing/DecisionMakerForm';

const EMPTY_FORM: DecisionMakerFields = { name: '', description: '' };

type PanelMode = 'add' | 'edit';

export default function DecisionMakerPage() {
  const [items, setItems] = useState<CardListItem[]>([]);
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DecisionMakerFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<DecisionMakerFields>>({});

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
    setForm({ name: item.label, description: item.sublabel ?? '' });
    setErrors({});
    setPanelMode('edit');
    setEditingId(id);
    setPanelOpen(true);
  }

  function validate(): boolean {
    const next: Partial<DecisionMakerFields> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    if (panelMode === 'add') {
      setItems((prev) => [
        ...prev,
        { id: Date.now().toString(), label: form.name.trim(), sublabel: form.description.trim() },
      ]);
    } else if (editingId) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingId
            ? { ...i, label: form.name.trim(), sublabel: form.description.trim() }
            : i,
        ),
      );
    }

    setPanelOpen(false);
  }

  function handleDelete() {
    if (!deleteId) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title="Decision Makers"
        addLabel="Add Decision Maker"
        items={filtered}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(id) => setDeleteId(id)}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelMode === 'add' ? 'Add Decision Maker' : 'Edit Decision Maker'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {panelMode === 'add' ? 'Add Decision Maker' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <DecisionMakerForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Decision Maker"
        description="Are you sure you want to delete this decision maker? This action cannot be undone."
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
    </div>
  );
}
