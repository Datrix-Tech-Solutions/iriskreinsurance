'use client';

import { useState } from 'react';
import { SortableList, SortableListItem } from '@/components/organisms/shared/SortableList';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  SalesPipelineStageForm,
  SalesPipelineStageFields,
} from '@/components/molecules/marketing/SalesPipelineStageForm';

const INITIAL_STAGES: SortableListItem[] = [];

const EMPTY_FORM: SalesPipelineStageFields = { name: '', probability: '' };

type ModalMode = 'add' | 'edit';

export default function SalesPipelinePage() {
  const [stages, setStages] = useState<SortableListItem[]>(INITIAL_STAGES);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SalesPipelineStageFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<SalesPipelineStageFields>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = stages.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setModalMode('add');
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const stage = stages.find((s) => s.id === id);
    if (!stage) return;
    const prob = stage.sublabel.match(/^(\d+)%/)?.[1] ?? '';
    setForm({ name: stage.label, probability: prob });
    setErrors({});
    setModalMode('edit');
    setEditingId(id);
    setModalOpen(true);
  }

  function validate(): boolean {
    const next: Partial<SalesPipelineStageFields> = {};
    if (!form.name.trim()) next.name = 'Stage name is required.';
    if (form.probability === '' || Number(form.probability) < 0 || Number(form.probability) > 100)
      next.probability = 'Enter a value between 0 and 100.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const sublabel = `${form.probability}% Probability of achieving sales`;

    if (modalMode === 'add') {
      const newStage: SortableListItem = {
        id: Date.now().toString(),
        label: form.name.trim(),
        sublabel,
      };
      setStages((prev) => [...prev, newStage]);
    } else if (editingId) {
      setStages((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, label: form.name.trim(), sublabel } : s)),
      );
    }

    setModalOpen(false);
  }

  function handleDelete() {
    if (!deleteId) return;
    setStages((prev) => prev.filter((s) => s.id !== deleteId));
    setDeleteId(null);
  }

  function handleReorder(orderedIds: string[]) {
    setStages((prev) => {
      const map = Object.fromEntries(prev.map((s) => [s.id, s]));
      return orderedIds.map((id) => map[id]).filter(Boolean);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SortableList
        title="Sales Pipeline"
        addLabel="Add Stage"
        items={filtered}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(id) => setDeleteId(id)}
        onReorder={handleReorder}
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* Add / Edit side panel */}
      <SidePanel
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'add' ? 'Add Stage' : 'Edit Stage'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {modalMode === 'add' ? 'Add Stage' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <SalesPipelineStageForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Stage"
        description="Are you sure you want to delete this stage? This action cannot be undone."
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
