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
  const hasBalancingCandidates = analysis.useful.status === "조건부 후보";
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
      level: hasBalancingCandidates ? matchingElements.length : Math.min(2, activityCount),
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
  const featured = highest > 0 ? periods.filter((period) => period.level === highest) : [];
  const current = periods.find((period) => period.startYear <= timeline.currentYear && timeline.currentYear <= period.endYear) ?? null;
  return {
    periods,
    current,
    featured,
    currentYear: timeline.currentYear,
    mode: hasBalancingCandidates ? "peak-candidate" as const : "change" as const,
    favorable: [...favorable],
    strengthReason: analysis.useful.reason,
    method: hasBalancingCandidates
      ? "원국의 강약 비교가 안정적일 때 제시한 조건부 도움 오행과 각 대운의 앞글자·아랫글자 중심 글자 오행을 비교합니다. 두 글자 중 맞는 개수 0~2를 상대적 높이로만 표시합니다. 높은 구간도 전성기 후보일 뿐 실제 성취나 좋은 사건을 보장하지 않습니다. 합·충의 개수는 높이에 더하지 않으며, 기간 사이의 선은 시간순 연결을 돕는 표시입니다."
      : "원국의 강약·도움 오행 분석이 보류되어 전성기를 판정하지 않습니다. 대신 각 대운과 원국 네 기둥의 천간합·지지육합·지지충·같은 지지 반복이 드러나는 정도를 0~2단계로 압축했습니다. 높은 구간은 변화 단서가 많다는 뜻이며 좋은 운이나 나쁜 운, 사건의 확률이 아닙니다. 기간 사이의 선은 시간순 연결을 돕는 표시입니다.",
  };
}

export type LifeGraphReport = ReturnType<typeof buildLifeGraph>;
