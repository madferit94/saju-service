import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon, type DaewoonTimeline } from "../lib/saju/daewoon";
import { buildLifeSeasons, seasonForGod } from "../lib/saju/life-seasons";
import LifeSeasonsPanel from "../app/life-seasons-panel";
import MansePanel from "../app/manse-panel";

const birth: SajuInput = { date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" };
const chart = calculate(birth);

test("십성의 네 묶음은 주제별 계절에 대응하고 모르는 십성은 거부한다", () => {
  for (const [season, gods] of Object.entries({
    spring: ["비견", "겁재", "편인", "정인"],
    summer: ["식신", "상관"],
    autumn: ["편재", "정재"],
    winter: ["편관", "정관"],
  })) for (const god of gods) assert.equal(seasonForGod(god), season);
  assert.throws(() => seasonForGod("알 수 없음"), /분류/);
});

test("실제 대운의 앞글자 주제와 아래글자 중심 주제를 나누어 설명한다", () => {
  const timeline = calculateDaewoon(birth, 0, 2026);
  const report = buildLifeSeasons(chart, timeline);
  assert.equal(report.periods.length, timeline.periods.filter(period => period.ganji).length);
  assert.equal(report.periods[0].index, 1, "대운 시작 전 구간은 계절로 분류하지 않는다");
  assert.deepEqual(report.periods.map(period => period.index), timeline.periods.filter(period => period.ganji).map(period => period.index));
  for (const period of report.periods) {
    assert.equal(period.season, seasonForGod(period.stemGod));
    assert.equal(period.secondarySeason, seasonForGod(period.branchGod) === period.season ? undefined : seasonForGod(period.branchGod));
    assert.ok(period.reason.includes(period.stemGod));
    assert.ok(period.reason.includes(period.branchGod));
    assert.ok(period.reason.includes(period.ganji));
    assert.ok(period.opportunity.length > 20 && period.risk.length > 20 && period.action.length > 20);
    assert.ok(period.evidence.some(evidence => evidence.includes(period.ganji)));
  }
  assert.ok(report.periods.some(period => period.secondarySeason), "앞·뒤 글자 주제가 다른 실제 대운이 있어야 한다");
});

test("개인별 대운 계절은 고정된 나이 순서가 아니라 반복하거나 건너뛸 수 있다", () => {
  const first = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2026));
  const secondBirth: SajuInput = { ...birth, date: "1994-12-02" };
  const secondChart = calculate(secondBirth);
  const second = buildLifeSeasons(secondChart, calculateDaewoon(secondBirth, 0, 2026));
  assert.notEqual(chart.dayMaster.character, secondChart.dayMaster.character);
  const sameDaewoonForDifferentChart = buildLifeSeasons(secondChart, calculateDaewoon(birth, 0, 2026));
  assert.notEqual(first.periods[0].season, sameDaewoonForDifferentChart.periods[0].season, "같은 대운 글자도 일간에 따라 다른 계절로 읽는다");
  assert.notDeepEqual(first.periods.map(period => period.season), second.periods.map(period => period.season));
  assert.ok(first.periods.some((period, index) => index > 0 && period.season === first.periods[index - 1].season), "같은 계절이 연속해서 나타날 수 있다");
  assert.ok(first.periods.some((period, index) => index > 0 && Math.abs(["spring", "summer", "autumn", "winter"].indexOf(period.season) - ["spring", "summer", "autumn", "winter"].indexOf(first.periods[index - 1].season)) > 1), "계절 순서를 건너뛸 수 있다");
});

test("현재 위치는 저장된 기준 연도의 대운 양끝을 포함하고 연도 가운데로 표시한다", () => {
  for (const [year, index, progress] of [[2010, 1, 0.05], [2019, 1, 0.95], [2020, 2, 0.05], [2029, 2, 0.95]] as const) {
    const report = buildLifeSeasons(chart, calculateDaewoon(birth, 0, year));
    assert.equal(report.current?.periodIndex, index);
    assert.equal(report.current?.currentYear, year);
    assert.equal(report.current?.progress, progress);
    assert.equal(report.current?.season, report.periods.find(period => period.index === index)?.season);
    assert.equal(report.preDaewoon, false);
  }
});

test("대운 시작 전에는 현재 계절을 임의로 정하지 않는다", () => {
  const timeline = calculateDaewoon(birth, 0, 2008);
  assert.equal(timeline.periods[0].index, 0);
  const report = buildLifeSeasons(chart, timeline);
  assert.equal(report.current, null);
  assert.equal(report.preDaewoon, true);
  assert.ok(report.periods.every(period => period.index > 0));
  assert.match(report.method, /점수|확률/);
});

test("첫 대운이 출생 연도부터 시작하는 경우에도 0번 가상 구간을 만들지 않는다", () => {
  const fastBirth: SajuInput = { ...birth, date: "2000-02-04" };
  const fastTimeline = calculateDaewoon(fastBirth, 0, 2026);
  assert.equal(fastTimeline.periods[0].index, 1);
  const result = buildLifeSeasons(calculate(fastBirth), fastTimeline);
  assert.equal(result.periods[0].index, 1);
  assert.equal(result.preDaewoon, false);
  assert.ok(result.current);
});

test("어린 시기에는 성인 직업·금전 조언을 그대로 적용하지 않고 학교·또래 환경으로 읽는다", () => {
  const report = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2026));
  const childhood = report.periods.find(period => period.startAge === 6)!;
  assert.equal(childhood.endAge, 15);
  assert.match(childhood.opportunity, /학교|또래|배움/);
  assert.match(childhood.risk, /성적|또래|학습/);
  assert.match(childhood.action, /공부|도움 요청|배우/);
  assert.doesNotMatch(childhood.action, /투자|거래|직장/);
});

test("스무 살을 지나는 한 대운에서는 어린 시기와 성인 시기의 조언을 나눠 보여준다", () => {
  const report = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2026));
  const crossing = report.periods.find(period => period.startAge === 16)!;
  assert.equal(crossing.endAge, 25);
  for (const field of [crossing.opportunity, crossing.risk, crossing.action]) {
    assert.match(field, /20세 전에는/);
    assert.match(field, /20세 이후에는/);
  }
  const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report }));
  assert.match(html, /20세 전에는/);
  assert.match(html, /20세 이후에는/);
});

test("대운 표의 현재 상태 플래그보다 실제 기준 연도로 현재 지점을 계산한다", () => {
  const timeline = calculateDaewoon(birth, 0, 2026);
  const stale: DaewoonTimeline = { ...timeline, currentYear: 2035 };
  const result = buildLifeSeasons(chart, stale);
  assert.equal(result.current?.currentYear, 2035);
  assert.equal(result.current?.periodIndex, 3);
  assert.equal(result.current?.startYear, 2030);
  assert.equal(result.current?.endYear, 2039);
});

test("그래프는 실제 현재 지점과 같은 연도를 읽을 수 있게 텍스트·현재 배지·키보드 초점을 제공한다", () => {
  const report = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2026));
  const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report }));
  assert.match(html, /role="region"[^>]*tabindex="0"/i);
  assert.match(html, /role="img"[^>]*aria-labelledby=/);
  assert.match(html, /<desc[^>]*>[^<]*위아래는 운의 좋고 나쁨이 아닌/);
  assert.match(html, /2026년, 사주식 나이/);
  assert.match(html, /현재/);
  assert.match(html, /<summary>/, "대운을 키보드로 열 수 있는 기본 summary를 쓴다");
  assert.equal((html.match(/class="life-period /g) ?? []).length, report.periods.length);
  assert.match(html, /<details(?=[^>]*\bopen="")(?=[^>]*class="life-period [^"]+")[^>]*>/);
  assert.match(html, /가로축은 실제 대운이 시작하는 연도/);
  assert.match(html, /행운·성과·수명 점수는 아닙니다/);
});

test("인생 그래프와 4계절 풀이가 각각 독립된 목적지와 제목을 가진다", () => {
  const report = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2026));
  const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report }));
  const graphStart = html.indexOf('<section class="life-graph-panel" id="life-graph"');
  const seasonsStart = html.indexOf('<section class="life-seasons" id="life-seasons"');
  assert.ok(graphStart >= 0 && seasonsStart > graphStart, "두 영역은 별도 section이어야 한다");
  assert.equal((html.match(/id="life-graph"/g) ?? []).length, 1);
  assert.equal((html.match(/id="life-seasons"/g) ?? []).length, 1);
  const graph = html.slice(graphStart, seasonsStart);
  const seasons = html.slice(seasonsStart);
  assert.match(graph, /<h2 id="life-graph-heading">나의 인생 그래프<\/h2>/);
  assert.match(graph, /<svg[^>]*role="img"/);
  assert.match(graph, /href="#life-seasons"/);
  assert.doesNotMatch(graph, /class="season-current|class="life-periods"/);
  assert.match(seasons, /<h2 id="life-seasons-title">나의 인생 4계절<\/h2>/);
  assert.match(seasons, /class="season-current/);
  assert.match(seasons, /class="life-periods"/);
  assert.doesNotMatch(seasons, /<svg\b|class="life-graph-wrap"/);
});

test("결과 바로가기에서 인생 그래프와 4계절 풀이로 각각 이동한다", () => {
  const html = renderToStaticMarkup(createElement(MansePanel, { chart, benefactors: [] }));
  const nav = html.match(/<nav[^>]*aria-label="결과 바로가기"[^>]*>(.*?)<\/nav>/)?.[1];
  assert.ok(nav, "결과 바로가기 메뉴가 있어야 한다");
  assert.match(nav, /<a href="#life-graph">인생 그래프<\/a>/);
  assert.match(nav, /<a href="#life-seasons">인생 4계절<\/a>/);
  assert.equal((nav.match(/href="#life-graph"/g) ?? []).length, 1);
  assert.equal((nav.match(/href="#life-seasons"/g) ?? []).length, 1);
});

test("대운 시작 전 화면은 없는 계절·현재 점을 만들지 않고 이유를 설명한다", () => {
  const report = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2008));
  const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report }));
  assert.match(html, /아직 첫 대운이 시작되기 전/);
  assert.match(html, /계절을 임의로 정하지 않습니다/);
  assert.doesNotMatch(html, /current-graph-label/);
  assert.doesNotMatch(html, /class="current-badge"/);
});
