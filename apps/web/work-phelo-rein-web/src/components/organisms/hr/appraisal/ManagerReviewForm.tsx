'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { extractError } from '@/lib/extractError';
import { useSubmitManagerReview } from '@/hooks';
import { useToastStore } from '@/store/toast.store';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';

interface KpiRow {
  kpiId: string;
  title: string;
  description?: string;
  maxScore: number;
  selfScore: number;
}

interface KpiState {
  score: number | null;
  comment: string;
}

interface Props {
  appraisalId: string;
  kpis: KpiRow[];
  backHref: string;
}

export function ManagerReviewForm({ appraisalId, kpis, backHref }: Props) {
  const router = useRouter();
  const { mutate, isPending } = useSubmitManagerReview();

  const [answers, setAnswers] = useState<Record<string, KpiState>>(() =>
    Object.fromEntries(kpis.map((k) => [k.kpiId, { score: null, comment: '' }])),
  );
  const [overallComment, setOverallComment] = useState('');

  const setScore = (kpiId: string, score: number) =>
    setAnswers((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], score } }));

  const setComment = (kpiId: string, comment: string) =>
    setAnswers((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], comment } }));

  const allScored = kpis.every((k) => answers[k.kpiId]?.score !== null);

  const handleSubmit = () => {
    if (!allScored) {
      useToastStore
        .getState()
        .addToast({ message: 'Please score all KPIs before submitting', type: 'error' });
      return;
    }

    const kpiScores = kpis.map((k) => ({
      kpiId: k.kpiId,
      score: answers[k.kpiId].score as number,
      comment: answers[k.kpiId].comment || undefined,
    }));

    mutate(
      { id: appraisalId, kpiScores, comment: overallComment || undefined },
      {
        onSuccess: () => {
          useToastStore
            .getState()
            .addToast({ message: 'Manager review submitted', type: 'success' });
          router.push(backHref);
        },
        onError: (err) => {
          useToastStore
            .getState()
            .addToast({ message: extractError(err, 'Submission failed'), type: 'error' });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {kpis.map((kpi) => {
        const state = answers[kpi.kpiId];
        const scores = Array.from({ length: kpi.maxScore }, (_, i) => i + 1);

        return (
          <div
            key={kpi.kpiId}
            className="rounded-xl border border-gray-200 bg-white px-6 py-5 flex flex-col gap-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-semibold text-gray-900">{kpi.title}</p>
                {kpi.description && <p className="text-sm text-gray-500">{kpi.description}</p>}
              </div>
              <div className="flex flex-col items-end shrink-0 text-right">
                <span className="text-xs text-gray-400">Employee Score</span>
                <span className="text-base font-bold text-gray-900">
                  {kpi.selfScore}/{kpi.maxScore}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {scores.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(kpi.kpiId, n)}
                  className={cn(
                    'w-12 h-12 rounded-lg text-sm font-semibold transition-colors border',
                    state?.score === n
                      ? 'bg-(--chip-dark,#111827) text-white border-(--chip-dark,#111827)'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <label className="text-sm font-semibold text-gray-900">Comment</label>
              <textarea
                rows={3}
                placeholder="Add a comment on your selected score"
                value={state?.comment ?? ''}
                onChange={(e) => setComment(kpi.kpiId, e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none"
              />
            </div>
          </div>
        );
      })}

      {/* Overall Comment */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 flex flex-col gap-3">
        <p className="text-base font-semibold text-gray-900">Overall Comment</p>
        <textarea
          rows={4}
          placeholder="Add an overall comment on your review"
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={() => router.push(backHref)}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          isLoading={isPending}
          loadingText="Submitting..."
          disabled={!allScored}
        >
          Submit Review
        </Button>
      </div>
    </div>
  );
}
