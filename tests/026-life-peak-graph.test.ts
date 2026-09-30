import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { combineFlow } from "../lib/saju/flow-combination";
import { buildLifeGraph } from "../lib/saju/life-graph";
import LifeGraphPanel from "../app/life-graph-panel";

const input = (date: string): SajuInput => ({ date, time: "08:37", calendar: "solar", topic: "general" });
const render = (report: ReturnType<typeof buildLifeGraph>) =>
  renderToStaticMarkup(createElement(LifeGraphPanel, { report, noteStorageKey: "test-life-notes" }));

test("안정된 원국의 그래프는 원국과 운의 균형 보완 정도로 후보를 비교한다", () => {
  for (const date of ["2005-12-23", "1994-12-01", "2001-08-19"]) {
    const birth = input(date), chart = calculate(birth);
    const graph = buildLifeGraph(chart, calculateDaewoon(birth, 0, 2026));
    assert.equal(graph.mode, "peak-candidate");
    for (const period of graph.periods) {
      assert.equal(period.level, combineFlow(chart, period.ganji).balanceGain);
    }
    const max = Math.max(...graph.periods.map(p => p.level));
    const min = Math.min(...graph.periods.map(p => p.level));
    const expected = max > .5 && max-min > .5 ? graph.periods.filter(p => max-p.level <= .5 && p.level > .5) : [];
    assert.deepEqual(graph.featured.map(p => p.index), expected.map(p => p.index));
    const html = render(graph);
    assert.doesNotMatch(html, /판정 보류|조건부 후보/);
    assert.match(html, /균형/);
  }
});

test("민감한 원국에서도 그래프 높이 의미는 균형 보완이며 전성기를 확정하지 않는다", () => {
  for (const date of ["2000-01-01", "1997-06-09"]) {
    const birth = input(date), chart = calculate(birth);
    assert.ok(analyzeNatal(chart).strength.sensitive || analyzeNatal(chart).strength.exceptional);
    const graph = buildLifeGraph(chart, calculateDaewoon(birth, 0, 2026));
    assert.notEqual(graph.mode, "peak-candidate");
    assert.deepEqual(graph.featured, []);
    assert.ok(graph.periods.every(p => p.level === combineFlow(chart, p.ganji).balanceGain));
    assert.doesNotMatch(render(graph), /<strong>전성기 후보<\/strong>|합·충·반복이 더 많이 나타납니다/);
  }
});

test("현재 대운은 양쪽 경계를 포함하며 시작 전에는 현재 표시가 없다", () => {
  const birth = input("2005-12-23");
  const baseline = calculateDaewoon(birth, 0, 2026);
  const first = baseline.periods.find((period) => period.ganji)!;
  const second = baseline.periods.find((period) => period.index === first.index + 1)!;
  for (const year of [first.startYear, first.endYear, second.startYear, second.endYear]) {
    const graph = buildLifeGraph(calculate(birth), calculateDaewoon(birth, 0, year));
    const expected = baseline.periods.find((period) => period.ganji && period.startYear <= year && year <= period.endYear)!;
    assert.equal(graph.current?.index, expected.index);
    assert.equal((render(graph).match(/class="current-graph-label"/g) ?? []).length, 1);
  }
  const before = buildLifeGraph(calculate(birth), calculateDaewoon(birth, 0, first.startYear - 1));
  assert.equal(before.current, null);
  assert.doesNotMatch(render(before), /class="current-graph-label"|class="current-badge"/);
});

test("기본 화면은 선 하나와 강조 구간 두 개 이하만 제시하고 근거 접기 창을 표시하지 않는다", () => {
  const birth = input("1990-01-01");
  const graph = buildLifeGraph(calculate(birth), calculateDaewoon(birth, 0, 2026));
  const html = render(graph);
  assert.equal((html.match(/<path /g) ?? []).length, 1);
  assert.equal((html.match(/class="life-path graph-flow"/g) ?? []).length, 1);
  assert.ok((html.match(/class="graph-peak-point"/g) ?? []).length <= 2, "동점 후보가 여럿이어도 기본 화면의 강조 점은 두 개 이하로 제한해야 합니다");
  assert.doesNotMatch(html, /graph-connection|graph-adjustment|관계 단서 수|<text[^>]*>\d+<\/text>/);
  if (graph.featured.length > 2) assert.match(html, /외 \d+구간/);
  assert.doesNotMatch(html, /life-graph-details|시기별 해석 근거 보기|그래프 계산 기준과 한계|<details[^>]*class="fortune-evidence/);
  assert.equal((html.match(/<article /g) ?? []).length, graph.periods.length, "각 대운의 개인 메모는 유지해야 합니다");
  assert.match(html, /<details class="life-note-disclosure">/, "개인 메모 접기는 유지해야 합니다");
  assert.match(html, /role="region"[^>]*tabindex="0"/i);
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby=/);
  assert.match(html, /<title id="life-graph-title">/);
  assert.match(html, /<desc id="life-graph-description">/);
});
