'use client';

import { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { Period } from '@/components/atoms/PeriodToggle';
import { Icons } from '@/components/atoms/icons';
import { Skeleton } from '@/components/atoms/Skeleton';
import { TrendBadge } from '@/components/atoms/TrendBadge';
import { cardClass, cn } from '@/lib/utils';
import { useReinsuranceDashboard } from '@/hooks';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const PERIOD_PREV_LABELS: Record<Period, string> = {
  daily: 'Yesterday',
  weekly: 'Last week',
  monthly: 'Last month',
  quarterly: 'Last quarter',
  yearly: 'Last year',
};

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 90;
const STROKE = 10;
const CIRC = 2 * Math.PI * RADIUS;

// Gauge geometry: leave an open gap at the bottom, arc starts right after
// the gap and sweeps clockwise all the way around to just before the gap.
const GAP_DEGREES = 80;
const ARC_FRACTION = (360 - GAP_DEGREES) / 360;
const ARC_LEN = ARC_FRACTION * CIRC;
const ROTATE = 90 + GAP_DEGREES / 2;

type MetricKey = 'totalOffers' | 'placedOffers' | 'partiallyClosedOffers' | 'closedOffers';

interface MetricDef {
  key: MetricKey;
  label: string;
  icon: LucideIcon;
  color: string;
}

const METRICS: MetricDef[] = [
  { key: 'totalOffers', label: 'Total Offers', icon: Icons.FileCheck2, color: '#4c8dff' },
  { key: 'placedOffers', label: 'Placed Offers', icon: Icons.Handshake, color: '#f472b6' },
  {
    key: 'partiallyClosedOffers',
    label: 'Partially Placed',
    icon: Icons.CircleCheckBig,
    color: '#f5a623',
  },
  { key: 'closedOffers', label: 'Closed Offers', icon: Icons.CircleCheck, color: '#34d399' },
];

interface OffersOverviewCardProps {
  period: Period;
  year?: number;
}

export function OffersOverviewCard({ period, year }: OffersOverviewCardProps) {
  const { data, isLoading } = useReinsuranceDashboard({ period, year });
  const [selected, setSelected] = useState<MetricKey | null>(null);
  // Whichever key is currently being reset to zero (no transition) right before
  // it sweeps back up — forces a fresh "from the bottom" animation on every click,
  // even when jumping directly from one selected metric to another.
  const [growFrom, setGrowFrom] = useState<MetricKey | null>(null);
  // Direction the center number/label should slide in from — 'up' when moving to
  // a later metric in the list, 'down' when moving to an earlier one.
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  const periodLabel = PERIOD_LABELS[period];
  const prevLabel = PERIOD_PREV_LABELS[period];
  const total = data.totalOffers;

  const metricIndex = (key: MetricKey | null) =>
    key === null ? 0 : METRICS.findIndex((m) => m.key === key);

  function handleSelect(key: MetricKey) {
    const next = selected === key ? null : key;
    const prevIndex = metricIndex(selected);
    const nextIndex = metricIndex(next);
    if (nextIndex !== prevIndex) {
      setDirection(nextIndex > prevIndex ? 'up' : 'down');
    }
    setSelected(next);
    if (next) {
      setGrowFrom(next);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setGrowFrom(null));
      });
    } else {
      setGrowFrom(null);
    }
  }

  // Largest value first so bigger arcs sit behind smaller ones when nothing is
  // selected; the selected arc always paints last (on top) once one is picked.
  const orderedForOverlay = [...METRICS].sort((a, b) => data[b.key] - data[a.key]);
  const displayOrder = selected
    ? [...METRICS.filter((m) => m.key !== selected), METRICS.find((m) => m.key === selected)!]
    : orderedForOverlay;
  const centerMetric = selected ? METRICS.find((m) => m.key === selected)! : null;
  const centerValue = centerMetric
    ? data[centerMetric.key].toLocaleString()
    : `${data.closedRate.toFixed(1)}%`;
  const centerLabel = centerMetric ? centerMetric.label : 'Closed Rate';
  const centerTrend = centerMetric ? data.trends[centerMetric.key] : data.trends.closedRate;
  const centerPrev = centerMetric ? data.previous[centerMetric.key] : data.previous.closedRate;

  // Selected arc sweeps to a full ring ("fills up"); every other arc sweeps to
  // zero. With nothing selected, each arc shows its own share of the total —
  // all driven off the same circles so the length change always animates.
  function targetPct(m: MetricDef): number {
    if (growFrom === m.key) return 0;
    if (selected) return m.key === selected ? 100 : 0;
    return total > 0 ? Math.min(100, (data[m.key] / total) * 100) : 0;
  }

  return (
    <div className={cardClass('flex flex-col gap-2 p-6 w-full lg:w-100', 'glass')}>
      <h3 className="text-sm font-semibold text-gray-900">Offers Overview</h3>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-2 shrink-0">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const active = selected === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => handleSelect(m.key)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-2 py-2 border transition-[transform,box-shadow,background-color,border-color] duration-200 text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
                  active
                    ? 'bg-(--tint) border-(--tint-border) shadow-sm'
                    : 'bg-gray-100/60 hover:bg-gray-200/60 border-(--rest-border) shadow-l',
                )}
                style={
                  {
                    '--tint': `color-mix(in oklab, ${m.color} 20%, white)`,
                    '--tint-border': `color-mix(in oklab, ${m.color} 50%, white)`,
                    '--rest-border': `color-mix(in oklab, ${m.color} 100%, white)`,
                  } as React.CSSProperties
                }
              >
                <Icon size={16} color={active ? m.color : '#9ca3af'} className="shrink-0" />
                <span className="flex flex-col leading-tight min-w-0">
                  <span
                    className="text-[10px] text-gray-500 truncate"
                    style={{ color: active ? m.color : undefined }}
                  >
                    {m.label}
                  </span>
                  <span
                    className="text-xs font-semibold text-gray-900"
                    style={{ color: active ? m.color : undefined }}
                  >
                    {isLoading ? '—' : data[m.key].toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center justify-center flex-1" style={{ height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <g transform={`rotate(${ROTATE} ${CENTER} ${CENTER})`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${ARC_LEN} ${CIRC - ARC_LEN}`}
              />
              {!isLoading &&
                displayOrder.map((m) => {
                  const filled = (targetPct(m) / 100) * ARC_LEN;
                  return (
                    <circle
                      key={m.key}
                      cx={CENTER}
                      cy={CENTER}
                      r={RADIUS}
                      fill="none"
                      stroke={m.color}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                      strokeDasharray={`${filled} ${CIRC - filled}`}
                      style={{
                        transition:
                          growFrom === m.key
                            ? 'none'
                            : 'stroke-dasharray 900ms cubic-bezier(0.65, 0, 0.35, 1)',
                      }}
                    />
                  );
                })}
            </g>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <div
                key={selected ?? 'closedRate'}
                className={direction === 'up' ? 'metric-slide-up' : 'metric-slide-down'}
              >
                <div className="text-2xl font-semibold text-gray-900">{centerValue}</div>
                <div className="text-sm text-gray-400 mt-1">{centerLabel}</div>

                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <TrendBadge change={centerTrend} tooltip={`${prevLabel}: ${centerPrev}`} />
                  <span className="text-[10px] text-gray-400">vs previous {periodLabel}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
