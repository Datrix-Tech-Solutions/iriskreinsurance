'use client';

import { useState } from 'react';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { Icons } from '@/components/atoms/icons';
import { useReinsurers } from '@/hooks';

export interface ReinsurerEntry {
  id: string;
  name: string;
  emails: string[];
}

interface EditingState {
  entryId: string;
  index: number | 'new';
}

interface ReinsurerDistributionSelectProps {
  value: ReinsurerEntry[];
  onChange: (entries: ReinsurerEntry[]) => void;
  excludeIds?: string[];
  /**
   * Reinsurer whose name matches this (the placement's cedant) is hidden — a
   * company can't take a share of its own cession. Strict match, so distinct
   * variants ("Glico Life" vs "Glico General") are left in.
   */
  excludeName?: string;
}

/** Strict name comparison, resilient only to surrounding whitespace and casing. */
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function ReinsurerDistributionSelect({
  value,
  onChange,
  excludeIds = [],
  excludeName,
}: ReinsurerDistributionSelectProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState('');

  const excludedName = excludeName ? normalizeName(excludeName) : null;
  const multiSelectOptions = reinsurers
    .filter((r) => !excludeIds.includes(r.id))
    .filter((r) => excludedName === null || normalizeName(r.name) !== excludedName)
    .map((r) => ({ value: r.id, label: r.name }));
  const selectedIds = value.map((e) => e.id);

  const handleSelectionChange = (ids: string[]) => {
    const next: ReinsurerEntry[] = ids.map((id) => {
      const existing = value.find((e) => e.id === id);
      if (existing) return existing;
      const reinsurer = reinsurers.find((r) => r.id === id);
      const primaryEmail = reinsurer?.email ?? '';
      return { id, name: reinsurer?.name ?? '', emails: primaryEmail ? [primaryEmail] : [] };
    });
    onChange(next);
    if (editing && !ids.includes(editing.entryId)) setEditing(null);
  };

  const updateEmail = (entryId: string, index: number, email: string) => {
    onChange(
      value.map((e) =>
        e.id === entryId
          ? { ...e, emails: e.emails.map((em, i) => (i === index ? email : em)) }
          : e,
      ),
    );
  };

  const addEmail = (entryId: string, email: string) => {
    if (!email.trim()) return;
    onChange(
      value.map((e) => (e.id === entryId ? { ...e, emails: [...e.emails, email.trim()] } : e)),
    );
  };

  const removeEmail = (entryId: string, index: number) => {
    onChange(
      value.map((e) =>
        e.id === entryId ? { ...e, emails: e.emails.filter((_, i) => i !== index) } : e,
      ),
    );
  };

  const removeEntry = (id: string) => {
    onChange(value.filter((e) => e.id !== id));
    if (editing?.entryId === id) setEditing(null);
  };

  const startEdit = (entryId: string, index: number | 'new') => {
    setEditing({ entryId, index });
    setDraft(
      index === 'new' ? '' : (value.find((e) => e.id === entryId)?.emails[index as number] ?? ''),
    );
  };

  const commitEdit = (entryId: string) => {
    if (!editing) return;
    if (editing.index === 'new') {
      addEmail(entryId, draft);
    } else {
      updateEmail(entryId, editing.index, draft);
    }
    setEditing(null);
    setDraft('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
  };

  const getEmailOptions = (id: string) => {
    const r = reinsurers.find((re) => re.id === id);
    if (!r) return [];
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    const add = (email: string | null) => {
      if (email && !seen.has(email)) {
        seen.add(email);
        opts.push({ value: email, label: email });
      }
    };
    add(r.email);
    r.contacts.forEach((c) => add(c.email));
    return opts;
  };

  return (
    <div className="flex flex-col gap-4">
      <MultiSelect
        label="Reinsurers"
        placeholder="Select reinsurers…"
        options={multiSelectOptions}
        value={selectedIds}
        onChange={handleSelectionChange}
        hideChips
      />

      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((entry) => {
            const emailOpts = getEmailOptions(entry.id);

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-3"
              >
                {/* Name row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{entry.name}</span>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>

                {/* Email list */}
                <div className="flex flex-col gap-2">
                  {entry.emails.map((email, idx) => {
                    const isEditing = editing?.entryId === entry.id && editing.index === idx;
                    // exclude already-used emails except the one in this slot
                    const filteredOpts = emailOpts.filter(
                      (o) => !entry.emails.includes(o.value) || o.value === email,
                    );

                    return isEditing ? (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <CreatableSearchSelect
                            placeholder="Enter or select email…"
                            options={filteredOpts}
                            value={draft}
                            onChange={setDraft}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => commitEdit(entry.id)}
                          className="shrink-0 text-xs font-medium text-brand hover:text-brand/80 transition-colors px-2 py-1"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="shrink-0 text-gray-400 hover:text-gray-500 transition-colors"
                        >
                          <Icons.X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 truncate">
                          {email || <span className="italic text-gray-400">No email</span>}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(entry.id, idx)}
                            className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEmail(entry.id, idx)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Icons.X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add email input or button */}
                  {editing?.entryId === entry.id && editing.index === 'new' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <CreatableSearchSelect
                          placeholder="Enter or select email…"
                          options={emailOpts.filter((o) => !entry.emails.includes(o.value))}
                          value={draft}
                          onChange={setDraft}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => commitEdit(entry.id)}
                        className="shrink-0 text-xs font-medium text-brand hover:text-brand/80 transition-colors px-2 py-1"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="shrink-0 text-gray-400 hover:text-gray-500 transition-colors"
                      >
                        <Icons.X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(entry.id, 'new')}
                      className="self-start flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" />
                      Add email
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
