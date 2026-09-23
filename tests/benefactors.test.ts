import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuChart, type SajuInput } from "../lib/saju/chart";
import { calculateBenefactors } from "../lib/saju/benefactors";

const input: SajuInput = {
  date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general",
};

function withPillars(stems: string[], branches: string[]): SajuChart {
  const chart = calculate(input);
  return {
    ...chart,
    pillars: chart.pillars.map((pillar, index) => ({
      ...pillar, stem: stems[index], branch: branches[index],
    })),
  };
}

test("공개 기준 사주에서 월덕귀인은 子월의 壬 시주에 나타난다", () => {
  const chart = calculate(input);
  assert.deepEqual(chart.pillars.map((pillar) => pillar.text), ["乙酉", "戊子", "辛巳", "壬辰"]);
  const stars = calculateBenefactors(chart);
  assert.deepEqual(stars.map((star) => star.name), ["천을귀인", "태극귀인", "문창귀인", "월덕귀인"]);
  assert.deepEqual(stars.find((star) => star.name === "월덕귀인")?.targets, ["壬"]);
  assert.deepEqual(stars.find((star) => star.name === "월덕귀인")?.matchedPillars, ["시주"]);
  for (const star of stars.slice(0, 3)) assert.deepEqual(star.matchedPillars, []);
});

test("천을·태극·문창은 일간별로 정해진 지지를 사용하며 근거를 보여준다", () => {
  const expectations: Record<string, [string[], string[], string[]]> = {
    甲: [["丑", "未"], ["子", "午"], ["巳"]],
    乙: [["子", "申"], ["子", "午"], ["亥"]],
    丙: [["亥", "酉"], ["卯", "酉"], ["戌"]],
    丁: [["亥", "酉"], ["卯", "酉"], ["辰"]],
    戊: [["丑", "未"], ["辰", "戌", "丑", "未"], ["申"]],
    己: [["子", "申"], ["辰", "戌", "丑", "未"], ["午"]],
    庚: [["丑", "未"], ["寅", "亥"], ["寅"]],
    辛: [["寅", "午"], ["寅", "亥"], ["未"]],
    壬: [["卯", "巳"], ["巳", "申"], ["卯"]],
    癸: [["卯", "巳"], ["巳", "申"], ["丑"]],
  };
  for (const [dayStem, expected] of Object.entries(expectations)) {
    const stars = calculateBenefactors(withPillars(["甲", "乙", dayStem, "丁"], ["寅", "卯", "辰", "巳"]));
    assert.deepEqual(stars.slice(0, 3).map((star) => star.targets), expected, dayStem);
    for (const star of stars.slice(0, 3)) assert.match(star.basis, new RegExp(`일간 ${dayStem} 기준`));
    assert.match(stars[2].description, /삼명통회/);
  }
});

test("월덕은 월지 삼합별 천간을 사용하고 해당 기둥을 찾는다", () => {
  const groups: Record<string, string> = {
    寅: "丙", 午: "丙", 戌: "丙",
    申: "壬", 子: "壬", 辰: "壬",
    亥: "甲", 卯: "甲", 未: "甲",
    巳: "庚", 酉: "庚", 丑: "庚",
  };
  for (const [monthBranch, expectedStem] of Object.entries(groups)) {
    const stars = calculateBenefactors(withPillars([expectedStem, "乙", "辛", "丁"], ["寅", monthBranch, "辰", "巳"]));
    const monthly = stars.find((star) => star.name === "월덕귀인");
    assert.deepEqual(monthly?.targets, [expectedStem], monthBranch);
    assert.deepEqual(monthly?.matchedPillars, ["년주"], monthBranch);
    assert.match(monthly?.basis ?? "", new RegExp(`월지 ${monthBranch} 기준`));
  }
});

test("귀인과 일치하는 모든 기둥을 표시하고 없을 때는 빈 목록으로 둔다", () => {
  const stars = calculateBenefactors(withPillars(["甲", "乙", "辛", "丁"], ["寅", "子", "午", "寅"]));
  assert.deepEqual(stars.find((star) => star.name === "천을귀인")?.matchedPillars, ["년주", "일주", "시주"]);
  assert.deepEqual(stars.find((star) => star.name === "태극귀인")?.matchedPillars, ["년주", "시주"]);
  assert.deepEqual(stars.find((star) => star.name === "문창귀인")?.matchedPillars, []);
});
