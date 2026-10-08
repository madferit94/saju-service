import type { SajuChart } from "./chart";
import { tenGod } from "./fortune";

type Element = keyof SajuChart["elements"];

const image: Record<Element, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };
const generates: Record<Element, Element> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const controls: Record<Element, Element> = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };

const theme: Record<string, string> = {
  비견: "제 길을 세우되", 겁재: "함께 힘을 모으되",
  식신: "익힌 것을 꾸준히 만들되", 상관: "새 방식을 말하되",
  편재: "새 기회를 만나되", 정재: "쌓은 것을 지키되",
  편관: "어려운 일을 맡되", 정관: "약속을 지키되",
  편인: "새 길을 탐구하되", 정인: "도움을 받아 배우되",
};

function direction(self: Element, month: Element): string {
  if (self === month) return "함께할 사람과 기준을 맞춰보세요";
  if (generates[month] === self) return "배운 것을 자기 것으로 만들어보세요";
  if (controls[month] === self) return "맡은 책임의 범위를 먼저 정해보세요";
  if (generates[self] === month) return "생각을 작은 결과로 내놓아보세요";
  return "생활의 기준에 맞춰 써보세요";
}

export function buildDoryeongOneLine(chart: SajuChart) {
  const monthPillar = chart.pillars[1];
  const self = chart.dayMaster.element as Element;
  const month = monthPillar.branchElement as Element;
  const monthGod = tenGod(chart.dayMaster.character, monthPillar.stem);
  const line = `${image[self]}의 기운이 ${image[month]}의 달을 만났습니다. ${theme[monthGod]} ${direction(self, month)}.`;
  const basis = `태어난 날 ${chart.dayMaster.character}(${chart.dayMaster.korean}·${self}), 태어난 달 ${monthPillar.branch}(${monthPillar.korean[1]}·${month})와 ${monthPillar.stem}(${monthPillar.korean[0]}·${monthGod})을 함께 읽었습니다.`;
  return { line, basis };
}
