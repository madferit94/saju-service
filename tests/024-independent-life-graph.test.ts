import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildLifeGraph } from "../lib/saju/life-graph";
import { buildLifeSeasons } from "../lib/saju/life-seasons";
import LifeGraphPanel from "../app/life-graph-panel";
import LifeSeasonsPanel from "../app/life-seasons-panel";

const birth: SajuInput = { date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" };

test("인생 그래프는 실제 대운 순서와 연도를 사용하고 계절 풀이와 분리된다", () => {
  const chart = calculate(birth);
  const timeline = calculateDaewoon(birth, 0, 2026);
  const graph = buildLifeGraph(chart, timeline);
  const seasons = buildLifeSeasons(chart, timeline);
  const realPeriods = timeline.periods.filter((period) => period.ganji);
  assert.deepEqual(graph.periods.map((period) => [period.index, period.ganji, period.startYear, period.endYear]),
    realPeriods.map((period) => [period.index, period.ganji, period.startYear, period.endYear]));
  assert.deepEqual(graph.periods.map((period) => [period.startYear, period.endYear]),
    seasons.periods.map((period) => [period.startYear, period.endYear]));
  assert.doesNotMatch(graph.method, /봄|여름|가을|겨울/);

  const graphHtml = renderToStaticMarkup(createElement(LifeGraphPanel, { report: graph, noteStorageKey: "test-life-notes" }));
  const seasonHtml = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report: seasons }));
  assert.match(graphHtml, /id="life-graph"/);
  assert.doesNotMatch(graphHtml, /id="life-seasons"|season-current|봄 ·|여름 ·|가을 ·|겨울 ·/);
  assert.match(seasonHtml, /id="life-seasons"/);
  assert.doesNotMatch(seasonHtml, /id="life-graph"|<svg\b|life-graph-wrap/);
});

test("시기별 합·충·반복 근거는 원국 네 기둥과 대운의 실제 관계로 표시된다", () => {
  const graph = buildLifeGraph(calculate(birth), calculateDaewoon(birth, 0, 2026));
  for (const period of graph.periods) {
    assert.equal(period.activityCount, period.connections.length + period.adjustments.length + period.repeats.length);
    for (const line of period.connections) assert.match(line, /천간합|지지육합/);
    for (const line of period.adjustments) assert.match(line, /지지충/);
    for (const line of period.repeats) assert.match(line, /같은 지지 반복/);
  }
});
