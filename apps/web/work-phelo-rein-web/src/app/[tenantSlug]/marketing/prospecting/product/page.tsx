'use client';

import { useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { ProductForm, ProductFields } from '@/components/molecules/marketing/ProductForm';

const EMPTY_FORM: ProductFields = { name: '', description: '' };

type PanelMode = 'add' | 'edit';

export default function ProductPage() {
  const [products, setProducts] = useState<CardListItem[]>([]);
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<ProductFields>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products.filter((p) => p.label.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('add');
    setEditingId(null);
    setPanelOpen(true);
  }

  function openEdit(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setForm({ name: product.label, description: product.sublabel ?? '' });
    setErrors({});
    setPanelMode('edit');
    setEditingId(id);
    setPanelOpen(true);
  }

  function validate(): boolean {
    const next: Partial<ProductFields> = {};
    if (!form.name.trim()) next.name = 'Product name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    if (panelMode === 'add') {
      setProducts((prev) => [
        ...prev,
        { id: Date.now().toString(), label: form.name.trim(), sublabel: form.description.trim() },
      ]);
    } else if (editingId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, label: form.name.trim(), sublabel: form.description.trim() }
            : p,
        ),
      );
    }

    setPanelOpen(false);
  }

  function handleDelete() {
    if (!deleteId) return;
    setProducts((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title="Products"
        addLabel="Add Product"
        items={filtered}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(id) => setDeleteId(id)}
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* Add / Edit side panel */}
      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelMode === 'add' ? 'Add Product' : 'Edit Product'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {panelMode === 'add' ? 'Add Product' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <ProductForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
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
