'use client';

import { useState } from 'react';
import { Moon } from 'lucide-react';
import { ModuleThemeRow } from '@/components/molecules/settings/ModuleThemeRow';
import { Toggle } from '@/components/atoms/Toggle';
import { useThemeStore } from '@/store/theme.store';

const MODULES = [
  { key: 'hr', name: 'Human Resource', defaultColor: '#0D2244' },
  { key: 'marketing', name: 'Marketing', defaultColor: '#16A34A' },
  { key: 'accounting', name: 'Accounting', defaultColor: '#DC2626' },
  { key: 'operations', name: 'Operations', defaultColor: '#4906D9' },
  { key: 'recruitment', name: 'Recruitment', defaultColor: '#0284C7' },
] as const;

type ModuleKey = (typeof MODULES)[number]['key'];

export function AppearanceTab() {
  const [moduleColors, setModuleColors] = useState<Record<ModuleKey, string>>(
    Object.fromEntries(MODULES.map((m) => [m.key, m.defaultColor])) as Record<ModuleKey, string>,
  );
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="py-6 flex flex-col gap-8 max-w-lg">
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Theme Mode</h3>
          <p className="text-sm text-gray-400 mt-0.5">Switch between light and dark appearance.</p>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Dark Mode</p>
              <p className="text-xs text-gray-400">Easier on the eyes in low light.</p>
            </div>
          </div>
          <Toggle
            enabled={theme === 'dark'}
            onChange={(enabled) => setTheme(enabled ? 'dark' : 'light')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Module Themes</h3>
          <p className="text-sm text-gray-400 mt-0.5">Choose an accent color for each module.</p>
        </div>

        <div className="flex flex-col">
          {MODULES.map((mod) => (
            <ModuleThemeRow
              key={mod.key}
              moduleKey={mod.key}
              name={mod.name}
              color={moduleColors[mod.key]}
              onColorChange={(color) => setModuleColors((prev) => ({ ...prev, [mod.key]: color }))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
