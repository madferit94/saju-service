import type { SajuChart } from "./chart";
import type { DaewoonTimeline } from "./daewoon";
import { analyzeNatal, type Element } from "./deep-analysis";
import { analyzeFlow } from "./fortune";

const stemElements: Record<string, Element> = {
  甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토",
  庚: "금", 辛: "금", 壬: "수", 癸: "수",
};

export function buildLifeGraph(chart: SajuChart, timeline: DaewoonTimeline) {
  const analysis = analyzeNatal(chart);
  const favorable = new Set(analysis.useful.candidates.map((candidate) => candidate.element));
  const periods = timeline.periods.filter((period) => period.ganji).map((period) => {
    const flow = analyzeFlow(chart, period.ganji, `${period.korean} 대운`);
    const relations = flow.evidence.slice(2);
    const connections = relations.filter((line) => line.includes("천간합") || line.includes("지지육합"));
    const adjustments = relations.filter((line) => line.includes("지지충"));
    const repeats = relations.filter((line) => line.includes("같은 지지 반복"));
    const stemElement = stemElements[period.ganji[0]];
    const branchElement = stemElements[flow.hiddenStems[0].stem];
    const matchingElements = [stemElement, branchElement].filter((element) => favorable.has(element));
    const activityCount = connections.length + adjustments.length + repeats.length;
    return {
      index: period.index,
      ganji: period.ganji,
      korean: period.korean,
      startYear: period.startYear,
      endYear: period.endYear,
      startAge: period.startAge,
      endAge: period.endAge,
      level: flow.combination.balanceGain,
      explanation: flow.combination.reason,
      opportunity: flow.opportunity,
      action: flow.action,
      matchingElements,
      stemElement,
      branchElement,
      activityCount,
      repeats,
      connections,
      adjustments,
      theme: flow.stemGod,
    };
  });
  const highest = Math.max(0, ...periods.map((period) => period.level));
  const comparable = !analysis.strength.sensitive && !analysis.strength.exceptional;
  const spread = periods.length ? highest - Math.min(...periods.map(p => p.level)) : 0;
  const featured = comparable && highest > .5 && spread > .5 ? periods.filter(period => highest - period.level <= .5) : [];
  const current = periods.find((period) => period.startYear <= timeline.currentYear && timeline.currentYear <= period.endYear) ?? null;
  return {
    periods,
    current,
    featured,
    currentYear: timeline.currentYear,
    mode: comparable ? "peak-candidate" as const : "balanced-context" as const,
    scale: Math.max(5, ...periods.map(p => Math.abs(p.level))),
    favorable: [...favorable],
    strengthReason: analysis.useful.reason,
    method: "월령을 반영한 원국 기여에 대운 천간 10과 모든 지장간 15를 더해 생조 비중이 50%에서 떨어진 거리가 얼마나 줄어드는지 비교합니다. 조후·뿌리·투간은 설명에 함께 제시합니다. 합충 개수는 점수에 더하지 않습니다. 서비스의 상대 비교 규칙이며 사건 확률이나 전통의 공인 점수가 아닙니다. 민감하거나 특수한 원국, 모든 구간이 비슷한 경우에는 전성기를 선정하지 않습니다.",
  };
}

export type LifeGraphReport = ReturnType<typeof buildLifeGraph>;
