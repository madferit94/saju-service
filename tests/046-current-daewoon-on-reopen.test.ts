import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon, type DaewoonTimeline, type YunGender } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { buildLocalReading } from "../lib/saju/reading";
import { buildFortuneReport } from "../lib/saju/fortune";
import { buildLifeSeasons } from "../lib/saju/life-seasons";
import { buildLifeGraph } from "../lib/saju/life-graph";
import { isSavedSajuResult, type SavedSajuResult } from "../lib/saju/persistence";
import type { CloudPayload } from "../lib/account/results";
import { nodes, sajuFormHarness, textOf, type VNode } from "./helpers/saju-form-harness";

const seoul = { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 };
const SAVED_YEAR = 2015;

function savedResult(date = "2000-02-04", gender: YunGender = 0, year = SAVED_YEAR): SavedSajuResult {
  const input: SajuInput = { date, time: "08:37", calendar: "solar", topic: "general", birthplace: seoul };
  const chart = calculate(input);
  return { version: 1, savedAt: `${year}-05-01T03:00:00.000Z`, input, yunGender: gender, chart, timeline: calculateDaewoon(input, gender, year), benefactors: calculateBenefactors(chart), reading: null };
}

type Form = ReturnType<typeof sajuFormHarness>;

function periodCards(form: Form): VNode[] {
  return form.all((node) => node.type === "li" && String(node.props.className).startsWith("period-card"));
}

// 화면에 보이는 대운 시간표·기본 풀이·인생 4계절·인생 그래프 등이 "올해 새로 계산한 대운표"와 같은지 확인한다.
function assertShownForYear(form: Form, saved: SavedSajuResult, year: number, fortuneYear: number) {
  const fresh = calculateDaewoon(saved.input, saved.yunGender, year);
  const freshCurrent = fresh.periods.find((period) => period.status === "current");

  form.navigate("chart");
  assert.deepEqual(form.panel("./manse-panel")!.timeline, fresh, "만세력에 넘기는 대운표");

  form.navigate("flow");
  const text = form.text();
  assert.ok(text.includes(`${year}년 기준`), `“${year}년 기준”이 보여야 합니다`);
  if (year !== saved.timeline.currentYear) assert.ok(!text.includes(`${saved.timeline.currentYear}년 기준`), "저장한 해 기준 문구가 남으면 안 됩니다");
  assert.deepEqual(form.panel("./flow-overview")!.timeline, fresh, "운의 흐름에 넘기는 대운표");
  assert.deepEqual(form.panel("./fortune-panel")!.report, buildFortuneReport(saved.chart, fresh, fortuneYear), "연운·월운 보고서");

  const cards = periodCards(form);
  assert.equal(cards.length, fresh.periods.length);
  const currentCards = cards.filter((card) => card.props.className === "period-card period-current");
  assert.equal(currentCards.length, freshCurrent ? 1 : 0, "현재 대운 카드 수");
  const badges = form.all((node) => node.props.className === "current-badge");
  assert.equal(badges.length, freshCurrent ? 1 : 0);
  if (freshCurrent) {
    assert.equal(textOf(nodes(currentCards[0]).find((node) => node.props.className === "period-years")), `${freshCurrent.startYear}–${freshCurrent.endYear}`);
    assert.equal(textOf(badges[0]), "현재");
    assert.ok(nodes(currentCards[0]).includes(badges[0]), "“현재” 표시는 올해가 든 대운 카드에 붙어야 합니다");
  }
  // 상태별 묶음(지나온·지금·앞으로)과 카드 순서가 새 계산과 같다.
  assert.deepEqual(cards.map((card) => card.props.className.replace("period-card period-", "")), [
    ...fresh.periods.filter((period) => period.status === "past"),
    ...fresh.periods.filter((period) => period.status === "current"),
    ...fresh.periods.filter((period) => period.status === "future"),
  ].map((period) => period.status));
  // 자동으로 펼쳐지는 기본 풀이는 현재 대운 하나뿐이고, 그 내용은 올해 기준 계산과 같다.
  const local = buildLocalReading(saved.chart, fresh, saved.benefactors);
  const details = form.all((node) => node.type === "details");
  assert.equal(details.filter((node) => node.props.open).length, freshCurrent ? 1 : 0);
  const themes = form.all((node) => node.props.className === "period-theme").map(textOf);
  const order = [...fresh.periods.filter((p) => p.status === "past"), ...fresh.periods.filter((p) => p.status === "current"), ...fresh.periods.filter((p) => p.status === "future")];
  assert.deepEqual(themes, order.map((period) => local.periodReadings.find((item) => item.index === period.index)!.theme), "기본 풀이 문단");

  form.navigate("seasons");
  const seasons = form.panel("./life-seasons-panel")!.report;
  assert.deepEqual(seasons, buildLifeSeasons(saved.chart, fresh), "인생 4계절");
  assert.equal(seasons.current?.currentYear ?? null, freshCurrent && freshCurrent.index !== 0 ? year : null);
  if (seasons.current) assert.equal(seasons.current.periodIndex, freshCurrent!.index, "인생 4계절의 현재 계절은 올해 대운");

  form.navigate("graph");
  const graph = form.panel("./life-graph-panel")!.report;
  assert.deepEqual(graph, buildLifeGraph(saved.chart, fresh), "인생 그래프");
  assert.equal(graph.currentYear, year);

  form.navigate("daily");
  assert.deepEqual(form.panel("./daily-fortune-panel")!.timeline, fresh, "오늘의 운세에 넘기는 대운표");
}

const thisYear = new Date().getFullYear(); // 컴포넌트와 같은 방식(new Date().getFullYear())으로 올해를 구한다.

test("예전 해에 브라우저에 저장된 결과를 열면 올해 기준으로 현재 대운과 기준 연도를 보여 준다", () => {
  const saved = savedResult();
  assert.ok(isSavedSajuResult(saved));
  const form = sajuFormHarness({ saved });
  form.mount();
  assertShownForYear(form, saved, thisYear, thisYear);
  // 저장 자료(계정 저장 후보 포함)는 원래 대운표 그대로다.
  assert.equal(form.writes.length, 0, "열기만으로 브라우저 저장본을 다시 쓰지 않는다");
  const current = form.account().current as CloudPayload;
  assert.equal(current.result.timeline, saved.timeline, "계정 저장용 자료는 원래 timeline 객체 그대로");
  assert.equal(current.result.timeline.currentYear, SAVED_YEAR);
  assert.deepEqual(current.result.timeline, calculateDaewoon(saved.input, saved.yunGender, SAVED_YEAR));
});

test("예전 해에 계정에 저장된 결과를 열어도 올해 기준으로 보여 주고 cloudPayload는 저장된 그대로다", () => {
  const saved = savedResult("1995-07-15", 1);
  const original: CloudPayload = { version: 1, fortuneYear: SAVED_YEAR, result: structuredClone(saved) };
  const value = structuredClone(original);
  const form = sajuFormHarness();
  form.mount();
  form.account().onLoad(value); form.render();
  assertShownForYear(form, saved, thisYear, SAVED_YEAR); // 살펴볼 운의 연도는 저장 때 고른 연도를 그대로 복원한다(기존 동작).
  const current = form.account().current as CloudPayload;
  assert.equal(current.fortuneYear, SAVED_YEAR);
  assert.deepEqual(JSON.parse(JSON.stringify(current)), JSON.parse(JSON.stringify(original)), "계정 자료 형식·내용이 바뀌지 않는다");
  assert.deepEqual(value, original, "불러온 객체를 고치지 않는다");
  assert.equal(form.writes.length, 0);
  assert.equal(form.requests.filter((request) => request.url === "/api/reading").length, 0);
});

test("고정한 현재 시각에서도 대운 시작 해·끝 해·대운 시작 전 구간을 올바르게 보여 준다", () => {
  // 2000-02-04 여성식: 2000–2009, 2010–2019, 2020–2029, 2030–2039 …
  // 2000-02-04 남성식: 대운 시작 전 2000–2008, 첫 대운 2009–2018 …
  const cases: [string, YunGender, number][] = [
    ["2000-02-04", 0, 2029], // 앞 대운의 끝 해
    ["2000-02-04", 0, 2030], // 새 대운의 시작 해
    ["2000-02-04", 0, 2041],
    ["2000-02-04", 1, 2005], // 대운 시작 전 구간이 현재
    ["2000-02-04", 1, 2009], // 첫 대운 시작 해
  ];
  for (const [date, gender, year] of cases) {
    const saved = savedResult(date, gender, SAVED_YEAR);
    const form = sajuFormHarness({ saved, now: `${year}-06-15T03:00:00.000Z` });
    form.mount();
    assertShownForYear(form, saved, year, year);
    assert.equal((form.account().current as CloudPayload).result.timeline, saved.timeline);
  }
  const preDaewoon = calculateDaewoon(savedResult("2000-02-04", 1).input, 1, 2005);
  assert.equal(preDaewoon.periods.find((period) => period.status === "current")!.index, 0, "2005년은 대운 시작 전 구간이어야 합니다");
});

test("저장본을 연 뒤 Gemini 해석을 다시 만들다 실패해도 브라우저에 다시 쓰는 대운표는 원래 형식 그대로다", async () => {
  const saved = savedResult();
  // 예전 연도로 작성된 해석이 있으면 “선택한 연도로 Gemini 해석 만들기” 버튼이 나온다.
  saved.reading = { readingVersion: 2, fortuneYear: SAVED_YEAR } as SavedSajuResult["reading"];
  const stored = structuredClone(saved);
  const form = sajuFormHarness({ saved });
  form.mount();
  const button = form.find((node) => node.type === "button" && node.props.children === "선택한 연도로 Gemini 해석 만들기");
  assert.ok(button, "다시 만들기 버튼이 보여야 합니다");
  const request = button.props.onClick(); form.render();
  assert.ok(form.requests.some((item) => item.url === "/api/reading"));
  for (const item of form.requests.filter((entry) => entry.url === "/api/reading")) {
    assert.equal(item.body?.timeline, undefined, "AI 요청에는 대운표를 보내지 않는다(서버가 계산)");
    assert.equal(item.body?.fortuneYear, thisYear);
  }
  await form.respondAll({ error: { message: "가상 오류" } }, false);
  await request; form.render();
  assert.equal(form.writes.length, 1);
  const written = form.writes[0];
  assert.equal(written.timeline, saved.timeline, "다시 쓰는 대운표는 원래 객체");
  assert.deepEqual(written.timeline, stored.timeline, "저장한 해의 기준·구분을 그대로 둔다");
  assert.equal(written.timeline.currentYear, SAVED_YEAR);
  // 해석 자리는 테스트용 가짜 값이므로 비우고, 나머지가 기존 저장 형식 검사를 통과하는지 본다.
  assert.ok(isSavedSajuResult({ ...JSON.parse(JSON.stringify(written)), reading: null }), "다시 쓴 자료는 기존 저장 형식 검사를 통과한다");
  // 실패 뒤에도 화면은 올해 기준이다.
  form.navigate("flow");
  assert.ok(form.text().includes(`${thisYear}년 기준`));
});

test("새로 계산한 결과는 저장 대운표와 화면 대운표가 같은 객체다(올해 계산이라 바꿀 것이 없음)", async () => {
  // 출생지는 상태 번호에 기대지 않고 도시 목록에서 고른다.
  const cityForm = sajuFormHarness({ cities: [seoul] });
  await cityForm.searchCity("서울");
  cityForm.all((node) => node.type === "button" && textOf(node).startsWith("서울"))[0].props.onClick(); cityForm.render();
  cityForm.find((node) => node.type === "form")!.props.onSubmit({ preventDefault() {}, currentTarget: { values: { date: "2000-02-04", time: "08:37", yunGender: "0" } } });
  cityForm.render();
  const stored = cityForm.writes[0].timeline as DaewoonTimeline;
  assert.equal(stored.currentYear, thisYear);
  cityForm.navigate("flow");
  assert.equal(cityForm.panel("./flow-overview")!.timeline, stored, "올해 계산한 대운표는 그대로 화면에 쓴다");
  await cityForm.respondAll({ error: { message: "가상 오류" } }, false);
});
