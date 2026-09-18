'use client';

import { useMemo, useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';
import { useFacultatives, useRiskTypes, useRiskClasses } from '@/hooks';
import { useThemeStore } from '@/store/theme.store';

const COLORS = [
  '#f97316',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#eab308',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
];

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

interface SliceMeta {
  totalPremium: number;
  totalSumInsured: number;
  color: string;
}

interface RiskClassPieChartProps {
  period: Period;
  year?: number;
}

export function RiskClassPieChart({ period, year }: RiskClassPieChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const { data: all = [] } = useFacultatives();
  const { data: riskTypes = [] } = useRiskTypes();
  const { data: riskClasses = [] } = useRiskClasses();

  const { pieData, meta } = useMemo(() => {
    const { start, end } = periodWindow(period, { year });
    const placements = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= end;
    });

    const riskTypeMap = new Map(riskTypes.map((rt) => [rt.id, rt]));
    const riskClassMap = new Map(riskClasses.map((rc) => [rc.id, rc.name]));

    const counts = new Map<string, { count: number; premium: number; sumInsured: number }>();
    for (const f of placements) {
      const name = f.riskTypeId
        ? (riskClassMap.get(riskTypeMap.get(f.riskTypeId)?.riskClassId ?? '') ?? 'Unclassified')
        : 'Unclassified';
      const prev = counts.get(name) ?? { count: 0, premium: 0, sumInsured: 0 };
      counts.set(name, {
        count: prev.count + 1,
        premium: prev.premium + (f.premium ?? 0),
        sumInsured: prev.sumInsured + (f.sumInsured ?? 0),
      });
    }

    const entries = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);

    const pieData = entries.map(([name, d], i) => ({
      id: i,
      value: d.count,
      label: name,
      color: COLORS[i % COLORS.length],
    }));

    const meta: SliceMeta[] = entries.map(([, d], i) => ({
      totalPremium: d.premium,
      totalSumInsured: d.sumInsured,
      color: COLORS[i % COLORS.length],
    }));

    return { pieData, meta };
  }, [all, riskTypes, riskClasses, period, year]);

  if (pieData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
        No offers for this period.
      </div>
    );
  }

  const activeSlice = hovered !== null ? { ...pieData[hovered], ...meta[hovered] } : null;
  const total = pieData.reduce((s, x) => s + x.value, 0);

  return (
    <div className="flex items-center gap-3 w-full min-w-0 h-full">
      <div className="relative shrink-0">
        <PieChart
          series={[
            {
              data: pieData,
              highlightScope: { fade: 'global', highlight: 'item' },
              faded: { innerRadius: 26, additionalRadius: -26, color: 'gray' },
              valueFormatter: (item) => `${item.value} offers`,
              outerRadius: 90,
            },
          ]}
          width={200}
          height={200}
          onHighlightChange={(h) => setHovered(h?.dataIndex ?? null)}
          sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
          slotProps={{ tooltip: { trigger: 'none' } as never }}
        />

        {/* Centre label */}
        {/* <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400">total offers</span>
        </div> */}

        {/* Tooltip */}
        {activeSlice && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 -translate-y-full z-10 pointer-events-none">
            <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
              <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: activeSlice.color }}
                />
                {activeSlice.label}
                <span className="ml-auto pl-3 text-[#d1d5db]">
                  {((activeSlice.value / total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="border-t border-[#374151] pt-1 flex flex-col gap-0.5">
                <div className="flex justify-between gap-4">
                  <span className="text-[#9ca3af]">Offers</span>
                  <span className="font-medium">{activeSlice.value}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#9ca3af]">Premium</span>
                  <span className="font-medium">{fmt(activeSlice.totalPremium)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#9ca3af]">Sum Insured</span>
                  <span className="font-medium">{fmt(activeSlice.totalSumInsured)}</span>
                </div>
              </div>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm" />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-3 min-w-0">
        {pieData.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between gap-6 text-sm w-full">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-200"
                style={{ background: hovered !== null && hovered !== i ? '#d1d5db' : s.color }}
              />
              <span
                className="truncate transition-colors duration-200"
                style={{
                  color:
                    hovered !== null && hovered !== i
                      ? isDark
                        ? '#374151'
                        : '#9ca3af'
                      : isDark
                        ? '#9ca3af'
                        : '#374151',
                }}
              >
                {s.label}
              </span>
            </span>
            <span className="text-gray-400 shrink-0">{((s.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
