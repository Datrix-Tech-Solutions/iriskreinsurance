interface Props {
  score: number;
  max: number;
}

export function ScorePip({ score, max }: Props) {
  const pct = max > 0 ? (score / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-20">
        <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-800 w-14 text-right">
        {score} / {max}
      </span>
    </div>
  );
}
