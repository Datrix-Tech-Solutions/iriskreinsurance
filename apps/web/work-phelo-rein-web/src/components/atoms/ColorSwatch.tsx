import { cn } from '@/lib/utils';

interface ColorSwatchProps {
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function ColorSwatch({ color, label, selected, onClick }: ColorSwatchProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none',
        selected && 'ring-2 ring-offset-2 ring-gray-400 scale-110',
      )}
      style={{ backgroundColor: color }}
    />
  );
}
