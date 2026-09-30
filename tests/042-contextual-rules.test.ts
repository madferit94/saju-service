import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { combineFlow, flowParts } from "../lib/saju/flow-combination";
import { selectContextualRule } from "../lib/saju/contextual-rules";
import { describeFlowLayers } from "../lib/saju/flow-layers";
import { analyzeFlow, buildFortuneReport, forLifeStage } from "../lib/saju/fortune";

const input = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" } as const;
const chart = calculate(input);
const natal = analyzeNatal(chart);

test("주요 생활 주제는 천간만 보지 않고 모든 지장간의 비중을 반영한다", () => {
  // For 甲 day master, 庚 is authority10, 子 contains resource癸15.
  assert.equal(selectContextualRule(natal, flowParts("甲", "庚子")).group, "resource");
  const examples = [["甲卯", "peers"], ["丙午", "output"], ["戊辰", "wealth"], ["庚申", "authority"], ["壬子", "resource"]] as const;
  for (const [ganji, group] of examples) assert.equal(selectContextualRule(natal, flowParts("甲", ganji)).group, group);
});

test("강약 경계와 편중 원국은 어느 생활 주제에서도 확정 강약 규칙을 적용하지 않는다", () => {
  for (const flag of ["sensitive", "exceptional"] as const) {
    for (const ganji of ["甲卯", "丙午", "戊辰", "庚申", "壬子"]) {
      const context = { ...natal, strength: { ...natal.strength, sensitive: false, exceptional: false, [flag]: true } };
      assert.equal(selectContextualRule(context, flowParts("甲", ganji)).mode, "uncertain");
    }
  }
});

test("동일한 운의 설명은 원국의 생조 조건별로 구분하고 중간 경계값을 포함한다", () => {
  const ruleAt = (score: number) => selectContextualRule({ ...natal, strength: { ...natal.strength, score, sensitive: false, exceptional: false } }, flowParts("甲", "庚申"));
  assert.equal(ruleAt(39.9).mode, "support-needed");
  assert.equal(ruleAt(40).mode, "balanced");
  assert.equal(ruleAt(60).mode, "balanced");
  assert.equal(ruleAt(60.1).mode, "supported");
  assert.notEqual(ruleAt(30).opportunity, ruleAt(70).opportunity);
  assert.notEqual(ruleAt(30).action, ruleAt(70).action);
});

test("계산된 조합 규칙은 존재하는 근거만 참조하고 기존 연령별 보호를 유지한다", () => {
  const combined = combineFlow(chart, "庚申");
  const allowed = new Set([...natal.facts, ...combined.facts].map(f => f.id));
  assert.ok(combined.rule.evidenceIds.length > 0);
  assert.ok(combined.rule.evidenceIds.every(id => allowed.has(id)));
  const flow = analyzeFlow(chart, "戊辰", "가상 대운", [{ label: "현재 대운", ganji: "庚申" }]);
  assert.match(forLifeStage(flow, 12).opportunity, /학교|배움|또래/);
  assert.doesNotMatch(forLifeStage(flow, 12).action, /투자|수익|직장/);
  assert.doesNotMatch(forLifeStage(flow, 75).action, /취업|승진|직장/);
});

test("입춘 전 월운의 연결 자료는 전년도 세운을 보존한다", () => {
  const report = buildFortuneReport(chart, calculateDaewoon(input, 0, 2026), 2026);
  assert.equal(report.months[0].annualGanji, "乙巳");
  assert.equal(report.months[1].annualGanji, "丙午");
  const january = JSON.stringify(report.months[0].hierarchy);
  const february = JSON.stringify(report.months[1].hierarchy);
  assert.match(january, /乙巳/);
  assert.doesNotMatch(january, /丙午/);
  assert.match(february, /丙午/);
  assert.ok(report.months[0].hierarchy.narrative.length > 0);
});

test("같은 주제 반복과 다른 주제 전환은 다른 연결 문장으로 설명한다", () => {
  const same = describeFlowLayers(chart, "甲卯", [{ label: "해당 연도 대운", ganji: "甲卯" }]);
  const changed = describeFlowLayers(chart, "甲卯", [{ label: "해당 연도 대운", ganji: "庚申" }]);
  assert.notEqual(same.narrative, changed.narrative);
  assert.ok(same.layers.length > 0);
  assert.ok(changed.layers.length > 0);
});
