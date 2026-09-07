'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { ModuleIcons } from '@/components/atoms/icons';
import { Users } from 'lucide-react';

export interface ModuleOption {
  key: string;
  label: string;
  description: string;
  enabled?: boolean;
  icon?: React.ReactNode;
}

export interface Module {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: React.ReactNode;
  options?: ModuleOption[];
}

interface ModuleConfigurationProps {
  modules: Module[];
  onToggle: (moduleId: string, enabled: boolean) => void;
  onSave: (modules: Module[]) => void;
  isSaving?: boolean;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        enabled ? 'bg-brand' : 'bg-gray-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
          enabled ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function ModuleIcon({ moduleKey, className = '' }: { moduleKey: string; className?: string }) {
  const IconComponent = ModuleIcons[moduleKey as keyof typeof ModuleIcons] || Users;

  return (
    <div
      className={cn(
        'w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0',
        className,
      )}
    >
      <IconComponent className="w-5 h-5 text-white" />
    </div>
  );
}

export function ModuleConfiguration({
  modules: initialModules,
  onToggle,
  onSave,
  isSaving,
}: ModuleConfigurationProps) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  const handleToggle = (id: string, enabled: boolean) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)));
    onToggle(id, enabled);
  };

  const handleOptionToggle = (moduleId: string, optKey: string, enabled: boolean) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== moduleId || !mod.options) return mod;
        return {
          ...mod,
          options: mod.options.map((o) => (o.key === optKey ? { ...o, enabled } : o)),
        };
      }),
    );
  };

  const handleRowClick = (mod: Module) => {
    if (mod.options && mod.options.length > 0) {
      setActiveModule(mod);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    modules.forEach((m) => {
      if (m.enabled && m.options && m.options.length > 0) {
        const hasEnabled = m.options.some((o) => o.enabled);
        if (!hasEnabled) {
          errors[m.id] = `${m.name} is enabled but has no features selected.`;
        }
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(modules);
    setShowSaveSuccess(true);
  };

  return (
    <>
      <div className="border border-gray-200 rounded-card bg-white flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Module Configuration</h3>
          <p className="text-sm text-gray-400 mt-1">
            Enable or disable modules available to this company.
          </p>
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto px-5 flex flex-col divide-y divide-gray-100 min-h-0">
          {modules.map((mod) => (
            <div key={mod.id}>
              <div
                onClick={() => handleRowClick(mod)}
                className={cn(
                  'flex items-center gap-4 py-4',
                  mod.options &&
                    mod.options.length > 0 &&
                    'cursor-pointer hover:bg-gray-50 -mx-5 px-5 transition-colors',
                )}
              >
                {mod.icon || <ModuleIcon moduleKey={mod.key} />}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{mod.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{mod.description}</p>
                </div>

                <Toggle enabled={mod.enabled} onChange={(v) => handleToggle(mod.id, v)} />
              </div>

              {validationErrors[mod.id] && (
                <p className="text-xs text-red-500 pb-3 -mt-1 pl-14">{validationErrors[mod.id]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-input hover:bg-brand-hover transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Options Side Panel */}
      {activeModule &&
        (() => {
          // Always read options from live `modules` state so toggles reflect immediately
          const liveModule = modules.find((m) => m.id === activeModule.id) ?? activeModule;
          return (
            <SidePanel
              isOpen={!!activeModule}
              onClose={() => setActiveModule(null)}
              title={liveModule.name}
              description={liveModule.description}
              footer={
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveModule(null)}
                    className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-input hover:bg-brand-hover transition-colors"
                  >
                    Done
                  </button>
                </div>
              }
            >
              <div className="flex flex-col divide-y divide-gray-100">
                {liveModule.options?.map((opt) => (
                  <div key={opt.key} className="flex items-center gap-4 py-4">
                    {opt.icon || <ModuleIcon moduleKey={liveModule.key} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                    </div>
                    <Toggle
                      enabled={opt.enabled ?? false}
                      onChange={(v) => handleOptionToggle(liveModule.id, opt.key, v)}
                    />
                  </div>
                ))}
              </div>
            </SidePanel>
          );
        })()}

      <SuccessModal
        isOpen={showSaveSuccess}
        onClose={() => setShowSaveSuccess(false)}
        title="Configuration Saved!"
        message="Module configuration has been updated successfully."
        actionLabel="Done"
      />
    </>
  );
}
