import type { SajuChart } from "./chart";

export type Benefactor = {
  name: string;
  basis: string;
  targets: string[];
  matchedPillars: string[];
  description: string;
};

const heavenlyHelper: Record<string, string[]> = {
  甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
  乙: ["子", "申"], 己: ["子", "申"],
  丙: ["亥", "酉"], 丁: ["亥", "酉"],
  壬: ["卯", "巳"], 癸: ["卯", "巳"],
  辛: ["寅", "午"],
};

const supremeUltimate: Record<string, string[]> = {
  甲: ["子", "午"], 乙: ["子", "午"],
  丙: ["卯", "酉"], 丁: ["卯", "酉"],
  庚: ["寅", "亥"], 辛: ["寅", "亥"],
  壬: ["巳", "申"], 癸: ["巳", "申"],
  戊: ["辰", "戌", "丑", "未"], 己: ["辰", "戌", "丑", "未"],
};

// 《삼명통회》에 실린 문창귀인 규칙. 다른 유파의 규칙과 구별한다.
const literaryStar: Record<string, string[]> = {
  甲: ["巳"], 乙: ["亥"], 丙: ["戌"], 丁: ["辰"], 戊: ["申"],
  己: ["午"], 庚: ["寅"], 辛: ["未"], 壬: ["卯"], 癸: ["丑"],
};

const monthlyVirtue: Record<string, string> = {
  寅: "丙", 午: "丙", 戌: "丙",
  申: "壬", 子: "壬", 辰: "壬",
  亥: "甲", 卯: "甲", 未: "甲",
  巳: "庚", 酉: "庚", 丑: "庚",
};

export function calculateBenefactors(chart: SajuChart): Benefactor[] {
  const dayStem = chart.pillars[2].stem;
  const monthBranch = chart.pillars[1].branch;
  const branchStar = (name: string, targets: string[], description: string): Benefactor => ({
    name,
    basis: `일간 ${dayStem} 기준 · 지지 ${targets.join("·")}`,
    targets,
    matchedPillars: chart.pillars.filter((pillar) => targets.includes(pillar.branch)).map((pillar) => pillar.label),
    description,
  });

  const virtueStem = monthlyVirtue[monthBranch];
  return [
    branchStar("천을귀인", heavenlyHelper[dayStem] ?? [], "도움과 조력의 가능성을 살펴보는 전통 표지"),
    branchStar("태극귀인", supremeUltimate[dayStem] ?? [], "배움과 성찰의 가능성을 살펴보는 전통 표지"),
    branchStar("문창귀인", literaryStar[dayStem] ?? [], "학습과 표현의 가능성을 살펴보는 전통 표지 · 삼명통회 기준"),
    {
      name: "월덕귀인",
      basis: `월지 ${monthBranch} 기준 · 천간 ${virtueStem}`,
      targets: [virtueStem],
      matchedPillars: chart.pillars.filter((pillar) => pillar.stem === virtueStem).map((pillar) => pillar.label),
      description: "관계의 완충 가능성을 살펴보는 전통 표지",
    },
  ];
}
