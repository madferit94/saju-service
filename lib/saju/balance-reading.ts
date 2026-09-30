import type { SajuChart } from "./chart";
import type { DeepAnalysis, Element } from "./deep-analysis";

const godMeaning: Record<string, string> = {
  비견: "내 기준을 세우고 동료와 나란히 움직이는 일",
  겁재: "협력과 경쟁 속에서 역할과 몫을 나누는 일",
  식신: "익힌 것을 꾸준히 결과로 만드는 일",
  상관: "생각을 드러내고 익숙한 방식을 바꾸는 일",
  편재: "새 기회와 여러 자원을 다루는 일",
  정재: "돈과 시간을 차근차근 관리하는 일",
  편관: "강한 요구 속에서 책임의 범위를 정하는 일",
  정관: "규칙과 신뢰를 바탕으로 역할을 맡는 일",
  편인: "다른 관점을 탐구하고 배우는 일",
  정인: "도움을 받아 배우고 기반을 다지는 일",
};

const seasonName: Record<string, string> = {
  寅: "봄", 卯: "봄", 辰: "봄", 巳: "여름", 午: "여름", 未: "여름",
  申: "가을", 酉: "가을", 戌: "가을", 亥: "겨울", 子: "겨울", 丑: "겨울",
};

const cycle: Element[] = ["목", "화", "토", "금", "수"];

function particle(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.charCodeAt(word.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? withFinal : withoutFinal;
}

function elementAction(day: Element, element: Element): string {
  const index = cycle.indexOf(day);
  if (element === day) return "함께할 사람과 자신의 몫을 분명히 정해 보십시오";
  if (element === cycle[(index + 4) % 5]) return "배움과 도움을 받아 판단의 바탕을 다져 보십시오";
  if (element === cycle[(index + 1) % 5]) return "익힌 생각을 말과 결과물로 옮겨 보십시오";
  if (element === cycle[(index + 2) % 5]) return "돈과 시간을 어디에 쓸지 순서를 정해 보십시오";
  return "맡을 책임과 지킬 기준을 먼저 정해 보십시오";
}

export function buildBalanceReading(chart: SajuChart, analysis: DeepAnalysis) {
  const day = `${chart.dayMaster.korean}${chart.dayMaster.element}`;
  const month = chart.pillars[1];
  const monthName = `${month.korean}월`;
  const season = seasonName[month.branch];
  const weights = [...analysis.strength.contributions].sort((a, b) => b.weight - a.weight);
  const outward = weights.find((item) => !item.supports);
  const inward = weights.find((item) => item.supports);
  const main = analysis.pattern.candidates[0];
  const other = analysis.pattern.candidates.slice(1);
  const mainMeaning = godMeaning[main?.god] ?? "태어난 달의 주제";
  const mainGod = main?.god ?? "달의 기운";
  const pressure = outward ? `${outward.pillar}의 ${outward.god}` : `${monthName}의 기운`;
  const support = inward ? `${inward.pillar}의 ${inward.god}` : `${day}의 바탕`;

  const strengthBody = analysis.strength.score < 40
    ? `${day}${particle(day, "은", "는")} ${season} ${monthName}에 놓였습니다. ${pressure}${particle(pressure, "이", "가")} 앞서 ${godMeaning[outward?.god ?? ""] ?? "바깥의 일"}에 마음을 쓰기 쉽습니다. ${support}${particle(support, "을", "를")} 살려, 맡을 일과 내 몫을 먼저 가르십시오.`
    : analysis.strength.score > 60
      ? `${day}${particle(day, "은", "는")} ${season} ${monthName}에 놓였습니다. ${support}${particle(support, "이", "가")} 받쳐 주는 만큼 생각과 기준을 쌓는 힘이 있습니다. ${pressure}의 주제를 실제 일로 옮길 때 흐름이 살아납니다.`
      : `${day}${particle(day, "은", "는")} ${season} ${monthName}에 놓였습니다. ${support}의 도움과 ${pressure}의 요구가 함께 보입니다. 배운 것을 ${godMeaning[outward?.god ?? ""] ?? "생활의 일"}로 옮기는 연결이 중요합니다.`;

  const monthBody = `${monthName}에서 읽히는 ${mainGod}${particle(mainGod, "은", "는")} ${mainMeaning}입니다. ${other.length ? `${other.map((candidate) => candidate.god).join("·")}의 흐름도 함께 드러나, ` : ""}${mainGod === "정재" || mainGod === "편재" ? "들이는 것과 쓰는 것의 기준을 세울 때 이 사주의 장점이 또렷해집니다." : mainGod === "정관" || mainGod === "편관" ? "남의 기대와 내 책임의 경계를 정할 때 힘을 제대로 쓸 수 있습니다." : mainGod === "식신" || mainGod === "상관" ? "생각을 실제로 만들어 보여 줄 때 기운의 쓰임이 분명해집니다." : "내가 익힌 것을 어떤 자리에서 쓸지 정할 때 방향이 선명해집니다."}`;

  const favorable = analysis.useful.candidates.map((candidate) => candidate.element);
  const focus = favorable[0] ?? analysis.useful.climate.element;
  const helpfulBody = focus
    ? `${season}의 ${monthName}에는 ${focus}의 쓰임을 눈여겨보십시오. ${elementAction(chart.dayMaster.element as Element, focus)}. ${favorable.length > 1 ? `${favorable.slice(1).join("·")} 기운도 같은 방향에서 함께 살펴볼 만합니다.` : ""}`
    : `${monthName}에서 드러난 ${mainGod}의 주제를 ${support}과 연결해 보십시오. ${mainMeaning}을 실제 생활에서 어떻게 쓰는지가 핵심입니다.`;

  return {
    lead: `${day}${particle(day, "과", "와")} ${monthName}의 관계에서 이 사주의 중심과 쓰임을 읽었습니다.`,
    strengthTitle: `${day}${particle(day, "이", "가")} 놓인 자리`,
    strengthBody,
    monthTitle: `${monthName}의 ${mainGod}`,
    monthBody,
    helpfulTitle: focus ? `${focus} 기운을 쓰는 방향` : "기운을 쓰는 방향",
    helpfulBody,
  };
}
