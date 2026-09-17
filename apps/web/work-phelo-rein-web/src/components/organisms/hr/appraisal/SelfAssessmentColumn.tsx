import { ResponseColumn } from '@/components/molecules/hr/appraisal/ResponseColumn';
import { ScorePip } from '@/components/molecules/hr/appraisal/ScorePip';
import { SectionAnswer } from '@/components/molecules/hr/appraisal/SectionAnswer';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import type {
  AppraisalResponse,
  AppraisalKpi,
  AppraisalSection,
  KpiScore,
  SectionResponse,
} from '@/types/hr';

interface Props {
  self: AppraisalResponse | undefined;
  kpis: AppraisalKpi[];
  sections: AppraisalSection[];
}

export function SelfAssessmentColumn({ self, kpis, sections }: Props) {
  return (
    <ResponseColumn title="Self Assessment" status={self?.status}>
      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KPIs</p>
          {kpis.map((kpi) => {
            const scored = self?.kpiScores?.find((s: KpiScore) => s.kpiId === kpi.id);
            return (
              <SectionCard key={kpi.id} title={kpi.title}>
                {scored ? (
                  <div className="flex flex-col gap-1.5">
                    <ScorePip score={scored.score} max={kpi.maxScore} />
                    {scored.comment && (
                      <p className="text-xs text-gray-500 mt-1">{scored.comment}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 italic">Not scored</span>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Questionnaire
          </p>
          {sections.map((section) => (
            <SectionCard key={section.id} title={section.name}>
              <SectionAnswer
                type={section.type}
                response={self?.sectionResponses?.find(
                  (s: SectionResponse) => s.sectionId === section.id,
                )}
              />
            </SectionCard>
          ))}
        </div>
      )}

      {!self && (
        <div className="flex-1 flex items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-card">
          <p className="text-sm text-gray-400">Self assessment not submitted yet</p>
        </div>
      )}
    </ResponseColumn>
  );
}
