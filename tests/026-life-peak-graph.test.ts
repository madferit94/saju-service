import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { analyzeNatal, type Element } from "../lib/saju/deep-analysis";
import { buildLifeGraph } from "../lib/saju/life-graph";
import LifeGraphPanel from "../app/life-graph-panel";

const input = (date: string): SajuInput => ({ date, time: "08:37", calendar: "solar", topic: "general" });
const stemElement: Record<string, Element> = {
  甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토",
  庚: "금", 辛: "금", 壬: "수", 癸: "수",
};
const branchPrimary: Record<string, string> = {
  子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙",
  午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬",
};
const render = (report: ReturnType<typeof buildLifeGraph>) =>
  renderToStaticMarkup(createElement(LifeGraphPanel, { report, noteStorageKey: "test-life-notes" }));

test("조건부 도움 오행이 있는 원국은 대운 두 글자와 일치한 0~2개로 전성기 후보를 고른다", () => {
  for (const date of ["2005-12-23", "1994-12-01", "2001-08-19"]) {
    const birth = input(date);
    const chart = calculate(birth);
    const analysis = analyzeNatal(chart);
    const graph = buildLifeGraph(chart, calculateDaewoon(birth, 0, 2026));
    assert.equal(analysis.useful.status, "조건부 후보");
    assert.equal(graph.mode, "peak-candidate");
    const favorable = new Set(analysis.useful.candidates.map((candidate) => candidate.element));
    assert.deepEqual(new Set(graph.favorable), favorable);
    for (const period of graph.periods) {
      const expected = [stemElement[period.ganji[0]], stemElement[branchPrimary[period.ganji[1]]]]
        .filter((element) => favorable.has(element));
      assert.deepEqual(period.matchingElements, expected, `${date} ${period.ganji} 일치 오행`);
      assert.equal(period.level, expected.length, `${date} ${period.ganji} 흐름 높이`);
    }
    const max = Math.max(...graph.periods.map((period) => period.level));
    assert.deepEqual(graph.featured.map((period) => period.index),
      graph.periods.filter((period) => period.level === max && max > 0).map((period) => period.index),
      "최고점 동점 구간을 모두 후보로 남겨야 합니다");
    const html = render(graph);
    assert.match(html, /전성기 후보/);
    assert.match(html, /성취나 행복을 보장하지는 않습니다/);
    assert.doesNotMatch(html, /계절에 따른 전성기|건강·수명 예측/);
  }
});

test("강약 또는 도움 오행 판단이 보류되면 전성기를 표시하지 않고 변화 단서로 설명한다", () => {
  for (const date of ["2000-01-01", "1997-06-09"]) {
    const birth = input(date);
    const graph = buildLifeGraph(calculate(birth), calculateDaewoon(birth, 0, 2026));
    assert.equal(graph.mode, "change");
    assert.deepEqual(graph.favorable, []);
    assert.ok(graph.periods.every((period) => period.level === Math.min(2, period.activityCount)));
    const html = render(graph);
    assert.match(html, /전성기 판정 보류/);
    assert.match(html, /변화 단서/);
    assert.doesNotMatch(html, /<strong>전성기 후보<\/strong>/);
    assert.match(html, /전성기를 뜻하지 않습니다/);
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
  assert.ok(graph.featured.length > 2, "동점 후보가 많은 가상 사례");
  const html = render(graph);
  assert.equal((html.match(/<path /g) ?? []).length, 1);
  assert.equal((html.match(/class="life-path graph-flow"/g) ?? []).length, 1);
  assert.ok((html.match(/class="graph-peak-point"/g) ?? []).length <= 2, "동점 후보가 여럿이어도 기본 화면의 강조 점은 두 개 이하로 제한해야 합니다");
  assert.doesNotMatch(html, /graph-connection|graph-adjustment|관계 단서 수|<text[^>]*>\d+<\/text>/);
  assert.match(html, /외 \d+구간/);
  assert.doesNotMatch(html, /life-graph-details|시기별 해석 근거 보기|그래프 계산 기준과 한계|<details[^>]*class="fortune-evidence/);
  assert.equal((html.match(/<article /g) ?? []).length, graph.periods.length, "각 대운의 개인 메모는 유지해야 합니다");
  assert.match(html, /<details class="life-note-disclosure">/, "개인 메모 접기는 유지해야 합니다");
  assert.match(html, /role="region"[^>]*tabindex="0"/i);
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby=/);
  assert.match(html, /<title id="life-graph-title">/);
  assert.match(html, /<desc id="life-graph-description">/);
});
