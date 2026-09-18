import { ColorSwatch } from '@/components/atoms/ColorSwatch';
import { ModuleIcons } from '@/components/atoms/icons';

const THEME_COLORS = [
  { label: 'Navy', value: '#0D2244' },
  { label: 'Blue', value: '#1D4ED8' },
  { label: 'Sky', value: '#0284C7' },
  { label: 'Teal', value: '#0D9488' },
  { label: 'Green', value: '#16A34A' },
  { label: 'Amber', value: '#D97706' },
  { label: 'Orange', value: '#EA580C' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Rose', value: '#E11D48' },
  { label: 'Purple', value: '#7C3AED' },
  { label: 'Indigo', value: '#4906D9' },
  { label: 'Slate', value: '#475569' },
];

interface ModuleThemeRowProps {
  moduleKey: string;
  name: string;
  color: string;
  onColorChange: (color: string) => void;
}

export function ModuleThemeRow({ moduleKey, name, color, onColorChange }: ModuleThemeRowProps) {
  const IconComponent = ModuleIcons[moduleKey as keyof typeof ModuleIcons];

  return (
    <div className="flex flex-col gap-3 py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: color }}
        >
          {IconComponent && <IconComponent className="w-4 h-4 text-white" />}
        </div>
        <span className="text-sm font-medium text-gray-900">{name}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {THEME_COLORS.map(({ label, value }) => (
          <ColorSwatch
            key={value}
            color={value}
            label={label}
            selected={color === value}
            onClick={() => onColorChange(value)}
          />
        ))}
      </div>
    </div>
  );
}
