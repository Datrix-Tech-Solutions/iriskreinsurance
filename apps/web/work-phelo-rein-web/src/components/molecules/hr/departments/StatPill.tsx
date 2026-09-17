interface StatPillProps {
  label: string;
  value: string | number;
}

export function StatPill({ label, value }: StatPillProps) {
  return (
    <div className="flex flex-col items-start gap-0.5 px-6">
      <span className="text-xs text-white/60">{label}</span>
      <span className="text-2xl font-bold text-white">{value === 0 ? '—' : value}</span>
    </div>
  );
}
