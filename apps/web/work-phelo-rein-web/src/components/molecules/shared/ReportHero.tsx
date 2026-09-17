function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface ReportHeroProps {
  title: string;
  /** Legacy fiscal-year mode, still used by reports that haven't moved to a date range. */
  years?: string[];
  startDate?: string;
  endDate?: string;
}

export function ReportHero({ title, years, startDate, endDate }: ReportHeroProps) {
  const sortedYears = years?.length ? [...years].sort((a, b) => Number(a) - Number(b)) : [];

  const subtitle =
    startDate && endDate
      ? startDate === endDate
        ? `Period of Insurance: ${formatDate(startDate)}`
        : `Period of Insurance: ${formatDate(startDate)} - ${formatDate(endDate)}`
      : sortedYears.length === 1
        ? `Year-To-Date (FY${sortedYears[0]})`
        : sortedYears.length > 1
          ? `Comparative Year-To-Date (FY${sortedYears[0]} - FY${sortedYears[sortedYears.length - 1]})`
          : null;

  return (
    <div className="flex items-baseline gap-2 pb-2 border-b border-gray-100 shrink-0">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && (
        <>
          <span className="text-gray-400">·</span>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </>
      )}
    </div>
  );
}
