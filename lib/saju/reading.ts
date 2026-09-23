import { analyzeFlow, forLifeStage } from "./fortune";
import type { SajuChart } from "./chart";
import type { DaewoonPeriod, DaewoonTimeline } from "./daewoon";
import type { Benefactor } from "./benefactors";

export type SajuReading = {
  overview: string;
  pillarReadings: PillarReading[];
  past: string;
  current: string;
  future: string;
  career: string;
  relationships: string;
  money: string;
  caution: string;
  periodReadings: LocalPeriodReading[];
};

export type PillarReading = {
  label: string;
  hanja: string;
  korean: string;
  characterGloss: string;
  interpretation: string;
};

export type LocalPeriodReading = {
  index: number;
  theme: string;
  strengths: string;
  cautions: string;
  advice: string;
  reflection: string;
};

type Element = keyof SajuChart["elements"];
const elementOrder: Element[] = ["목", "화", "토", "금", "수"];
const generates: Record<Element, Element> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const controls: Record<Element, Element> = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };
const stemElements = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"] as const;
const branchElements = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"] as const;
const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
const pillarRoles: Record<string, string> = {
  년주: "전통적으로 초년의 바탕과 집안·바깥 환경을 돌아보는 자리",
  월주: "성장 환경과 사회에서 맡는 역할, 계절 기운을 살펴보는 자리",
  일주: "나 자신을 중심에 두고 가까운 관계를 함께 돌아보는 자리",
  시주: "앞으로 기르고 싶은 일과 장기 계획을 비춰보는 자리",
};

function periodElement(period?: DaewoonPeriod): string {
  if (!period || period.index === 0) return "대운 시작 전";
  return `${period.korean}(${period.ganji}) 대운`;
}

function relationship(day: Element, other: Element): string {
  if (day === other) return "비슷한 방식의 힘을 보태거나 경쟁이 심해질 수 있습니다";
  if (generates[other] === day) return "도움과 배움이 들어올 수 있으나 의존이 커지지 않게 살펴야 합니다";
  if (controls[other] === day) return "규칙과 책임이 성장을 밀어줄 수 있으나 압박도 커질 수 있습니다";
  if (generates[day] === other) return "표현과 결과물을 내기 좋지만 에너지 소모를 함께 살펴야 합니다";
  return "성과와 관리에 눈이 갈 수 있으나 통제하려는 마음이 부담이 될 수 있습니다";
}

function periodContext(period: DaewoonPeriod | undefined, dayElement: Element): string {
  if (!period?.ganji) return "";
  const stem = stemElements[stems.indexOf(period.ganji[0])];
  const branch = branchElements[branches.indexOf(period.ganji[1])];
  return `대운 천간의 오행은 ${stem}입니다. 일간과 비교하면 ${relationship(dayElement, stem)}. 지지의 대표 오행은 ${branch}입니다. 지지와 일간의 관계에서는 ${relationship(dayElement, branch)}.`;
}

function mix(counts: SajuChart["elements"]): { present: string; absent: string } {
  const present = elementOrder.filter((element) => counts[element] > 0).map((element) => `${element} ${counts[element]}`);
  const absent = elementOrder.filter((element) => counts[element] === 0);
  return { present: present.join("·"), absent: absent.length ? absent.join("·") : "없음" };
}

export function buildLocalReading(
  chart: SajuChart,
  timeline: DaewoonTimeline,
  benefactors: Benefactor[],
): SajuReading {
  const dayElement = chart.dayMaster.element as Element;
  const monthElement = chart.pillars[1].branchElement as Element;
  const current = timeline.periods.find((period) => period.status === "current");
  const past = timeline.periods.filter((period) => period.status === "past").at(-1);
  const future = timeline.periods.find((period) => period.status === "future");
  const found = benefactors.filter((star) => star.matchedPillars.length);
  const counts = mix(chart.elements);
  const seasonRelationship = monthElement === dayElement
    ? "월지의 대표 오행과 일간 오행이 같습니다"
    : generates[monthElement] === dayElement
      ? "월지의 대표 오행이 일간 오행을 생하는 관계입니다"
      : controls[monthElement] === dayElement
        ? "월지의 대표 오행이 일간 오행을 제어하는 관계입니다"
        : generates[dayElement] === monthElement
          ? "일간 오행이 월지의 대표 오행을 생하는 관계입니다"
          : controls[dayElement] === monthElement
            ? "일간 오행이 월지의 대표 오행을 제어하는 관계입니다"
            : "월지와 일간은 서로 다른 오행으로 읽습니다";
  const starSummary = found.length
    ? `${found.map((star) => `${star.name}(${star.matchedPillars.join("·")})`).join(", ")}이 확인됩니다`
    : "이번 네 가지 귀인은 원국의 네 기둥에서 확인되지 않습니다";

  const flowFor = (period: DaewoonPeriod) => period.ganji
    ? forLifeStage(analyzeFlow(chart, period.ganji, period.startYear + "–" + period.endYear + "년 " + period.korean + " 대운"), period.status === "current" ? period.startAge + timeline.currentYear - period.startYear : period.endAge)
    : null;
  const currentFlow = current ? flowFor(current) : null;
  const describe = (period: DaewoonPeriod | undefined, empty: string) => {
    const flow = period ? flowFor(period) : null;
    return flow ? flow.opportunity + " " + flow.risk + " " + flow.action : empty;
  };

  return {
    overview: `일간은 ${chart.dayMaster.korean}${dayElement}, 월지는 ${chart.pillars[1].branch}(${monthElement})입니다. ${seasonRelationship}. 보이는 여덟 글자의 오행은 ${counts.present}이며, 보이지 않는 오행은 ${counts.absent}입니다. 이 숫자만으로 좋고 나쁨이나 사주의 강약을 결론 낼 수는 없습니다.`,
    pillarReadings: chart.pillars.map((pillar) => {
      const stemName = pillar.korean[0];
      const branchName = pillar.korean[1];
      const stemElement = pillar.stemElement as Element;
      const branchElement = pillar.branchElement as Element;
      return {
        label: pillar.label,
        hanja: pillar.text,
        korean: pillar.korean,
        characterGloss: `${pillar.stem}(${stemName}·${stemElement}) · ${pillar.branch}(${branchName}·${branchElement})`,
        interpretation: `${pillarRoles[pillar.label]}입니다. 천간 ${pillar.stem}(${stemName}, ${stemElement})은 일간과의 관계에서 ${relationship(dayElement, stemElement)}. 지지 ${pillar.branch}(${branchName}, ${branchElement})는 ${relationship(dayElement, branchElement)}. 이 전통적 자리는 실제 성격이나 사건을 확정하는 표가 아니라, 해당 분야에서 반복된 경험을 돌아보는 관점입니다.`,
      };
    }),
    past: describe(past, "대운 시작 전 구간은 당시 양육·학습·생활 환경과 함께 돌아봅니다."),
    current: describe(current, "현재는 표시된 대운 범위 밖입니다. 아래 세운·월운은 별도 계산한 결과입니다."),
    future: describe(future, "표시된 대운 이후의 흐름은 계산 범위에 포함되지 않습니다."),
    career: currentFlow ? currentFlow.opportunity + " " + currentFlow.action : "일과 배움은 아래 시기별 십성과 실제 환경을 함께 비교해 보세요.",
    relationships: starSummary + ". " + (currentFlow?.evidence.filter((line) => line.startsWith("일주")).join(". ") || "현재 대운과 일주 사이에 이번 계산 범위의 합·충·반복은 없습니다.") + ". 귀인의 유무보다 실제로 도움을 주고받는 사람과 약속·역할을 확인해 보세요.",
    money: currentFlow ? currentFlow.evidence[0] + ". " + currentFlow.risk : "대운 시작 전 구간에서는 재성을 생활 자원과 보호 환경의 관점에서 읽습니다.",
    caution: "십성은 나와 다른 기운의 관계, 지장간은 지지 안의 천간, 합·충은 글자 사이의 결합·긴장을 뜻합니다. 아래 종합 분석에서는 이 계산 근거를 함께 살핍니다. 오행 개수만으로 강약·용신을 정하거나 사건의 발생을 확정하지 않습니다.",
    periodReadings: timeline.periods.map((period) => {
      const flow = flowFor(period);
      return {
        index: period.index,
        theme: period.startYear + "–" + period.endYear + "년 " + periodElement(period) + "입니다. " + (flow ? flow.evidence.slice(0, 2).join(". ") : "이 시기는 원국과 양육 환경을 중심으로 봅니다."),
        strengths: flow?.opportunity ?? "초기의 생활 리듬과 주변에서 얻었던 보호·배움의 기반을 돌아봅니다.",
        cautions: flow?.risk ?? "어린 시절을 성인기의 직업이나 재물 성취 기준으로 읽지 않습니다.",
        advice: flow?.action ?? "보호자에게 당시 생활 변화와 적응 과정을 물어보고 남아 있는 기록과 비교해 보세요.",
        reflection: period.status === "past" ? (flow?.question ?? "당시 가정과 생활 환경은 어떠했나요?") : "아래 근거가 현재 환경에도 맞는지 살펴보세요. " + (flow?.question ?? "지금 필요한 지원은 무엇인가요?"),
      };
    }),
  };
}
