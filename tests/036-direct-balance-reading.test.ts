import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { buildBalanceReading } from "../lib/saju/balance-reading";

function reading(date: string) {
  const input: SajuInput = { date, time: "08:37", calendar: "solar", topic: "general" };
  const chart = calculate(input);
  const analysis = analyzeNatal(chart);
  return { chart, analysis, text: Object.values(buildBalanceReading(chart, analysis)).join(" ") };
}

test("균형 풀이의 계절·십성·도움 오행은 실제 계산값을 따른다", () => {
  const winter = reading("2000-01-01");
  const summer = reading("1997-06-09");
  const supported = reading("1994-12-01");

  assert.ok(winter.text.includes(`겨울의 ${winter.chart.pillars[1].korean}월`));
  assert.ok(summer.text.includes(`여름의 ${summer.chart.pillars[1].korean}월`));
  for (const result of [winter, summer, supported]) {
    assert.ok(result.text.includes(result.chart.dayMaster.korean + result.chart.dayMaster.element));
    assert.ok(result.text.includes(result.analysis.pattern.candidates[0].god));
    const focus = result.analysis.useful.candidates[0]?.element ?? result.analysis.useful.climate.element;
    if (focus) assert.ok(result.text.includes(`${focus} 기운을 쓰는 방향`));
    assert.doesNotMatch(result.text, /판정 보류|조건부 후보|확률|공인 점수|서비스 비교 지표|확정은 아닙니다/);
  }
  assert.notEqual(winter.text, summer.text);
  assert.notEqual(summer.text, supported.text);
});

test("일간과 십성 이름에 붙은 조사가 어색하지 않다", () => {
  for (const date of ["1994-12-01", "2000-01-01", "1997-06-09"]) {
    const { text } = reading(date);
    assert.doesNotMatch(text, /신금와|신금가|신금는|상관가|정재은|겁재을/);
  }
});
