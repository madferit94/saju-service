import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuChart } from "../lib/saju/chart";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { koreanGanji } from "../lib/saju/fortune";

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const elements = ["목", "화", "토", "금", "수"] as const;
const branchElements: Record<string, string> = { 子:"수",丑:"토",寅:"목",卯:"목",辰:"토",巳:"화",午:"화",未:"토",申:"금",酉:"금",戌:"토",亥:"수" };
function dated(date: string) { return calculate({ date, time: "12:00", calendar: "solar", topic: "general" }); }
// Deliberate model inputs isolate rules; these are not claimed as a historical birth chart.
function chartOf(texts: [string, string, string, string]): SajuChart {
  const chart = dated("1994-12-01");
  chart.pillars = texts.map((text, i) => ({ label: ["년주", "월주", "일주", "시주"][i], text, korean: koreanGanji(text), stem: text[0], branch: text[1], stemElement: elements[Math.floor(stems.indexOf(text[0]) / 2)], branchElement: branchElements[text[1]] }));
  chart.dayMaster = { character: texts[2][0], korean: koreanGanji(texts[2])[0], element: chart.pillars[2].stemElement };
  return chart;
}

test("강약 비교는 일간 자체를 제외하고 위치·지장간·계절을 반영한다", () => {
  const result = analyzeNatal(chartOf(["癸亥", "丙寅", "甲辰", "庚申"]));
  const contributions = result.strength.contributions;
  assert.equal(contributions.reduce((sum, item) => sum + item.base, 0), 95);
  assert.ok(!contributions.some(item => item.pillar === "일주" && item.source.startsWith("천간")));
  assert.deepEqual(contributions.filter(item => item.monthly).map(item => item.base), [18, 9, 3]);
  // Spring: wood旺1.5, fire相1.2, water休1, metal囚0.8, earth死0.6.
  const coefficients = Object.fromEntries(contributions.map(item => [item.element, item.seasonalFactor]));
  assert.deepEqual(coefficients, { 수: 1, 목: 1.5, 화: 1.2, 토: 0.6, 금: 0.8 });
  assert.equal(result.strength.score, 57.9); // 59.75 supportive / 103.15 total, rounded once.
  assert.ok(contributions.every(item => item.supports === ["목", "수"].includes(item.element)));
});

test("월지 지장간이 둘이면 70/30, 하나면 100 비율로 배분한다", () => {
  assert.deepEqual(analyzeNatal(chartOf(["甲子", "丙午", "戊辰", "庚申"])).strength.contributions.filter(item => item.monthly).map(item => item.base), [21, 9]);
  assert.deepEqual(analyzeNatal(chartOf(["甲子", "丙卯", "戊辰", "庚申"])).strength.contributions.filter(item => item.monthly).map(item => item.base), [30]);
});

test("강약 비교 규칙 변화에 민감한 원국은 확정 용신을 보류한다", () => {
  const result = analyzeNatal(dated("1994-01-15"));
  assert.equal(result.strength.baseLabel, "신강 경향");
  assert.equal(result.strength.sensitive, true);
  assert.match(result.strength.label, /경계/);
  assert.equal(result.useful.status, "판정 보류");
  assert.deepEqual(result.useful.candidates, []);
  assert.ok(result.strength.range[0] < 60 && result.strength.range[1] > 60);
});

test("극단 편중은 강약 반대 오행을 자동 용신으로 지정하지 않는다", () => {
  for (const texts of [["甲卯", "甲卯", "甲卯", "甲卯"], ["庚酉", "庚酉", "甲酉", "庚酉"]] as [string,string,string,string][]) {
    const result = analyzeNatal(chartOf(texts));
    assert.equal(result.strength.exceptional, true);
    assert.equal(result.useful.status, "판정 보류");
    assert.deepEqual(result.useful.candidates, []);
    assert.match(result.useful.reason, /별도 검토/);
  }
});

test("중화 범위는 부족 오행이 있어도 특정 용신을 확정하지 않는다", () => {
  const chart = dated("1994-05-15");
  chart.elements = { 목: 0, 화: 8, 토: 0, 금: 0, 수: 0 };
  const result = analyzeNatal(chart);
  assert.equal(result.strength.baseLabel, "중화 범위");
  assert.equal(result.useful.status, "판정 보류");
  assert.deepEqual(result.useful.candidates, []);
});

test("안정적인 신강·신약은 서로 다른 억부 후보를 내며 오행 개수에 의존하지 않는다", () => {
  const weakChart = dated("1994-09-15"), strongChart = dated("1994-11-15");
  const weak = analyzeNatal(weakChart), strong = analyzeNatal(strongChart);
  assert.equal(weak.useful.status, "조건부 후보");
  assert.equal(strong.useful.status, "조건부 후보");
  assert.equal(weak.useful.candidates.length, 2);
  assert.equal(strong.useful.candidates.length, 3);
  const original = analyzeNatal(weakChart);
  weakChart.elements = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 8 };
  assert.deepEqual(analyzeNatal(weakChart), original);
  assert.notEqual(weak.strength.score, strong.strength.score);
});

test("월지 복수 투간은 각각 후보를 제공하고 일간만의 투간은 세지 않는다", () => {
  const exposed = analyzeNatal(chartOf(["丙子", "戊寅", "庚辰", "癸亥"]));
  assert.deepEqual(exposed.pattern.candidates.map(candidate => candidate.stem), ["丙", "戊"]);
  assert.ok(exposed.pattern.candidates.every(candidate => candidate.reason.includes("투간")));
  const dayOnly = analyzeNatal(chartOf(["癸子", "壬寅", "丙辰", "辛酉"]));
  assert.deepEqual(dayOnly.pattern.candidates.map(candidate => candidate.stem), ["甲"]);
  assert.match(dayOnly.pattern.candidates[0].reason, /투간하지 않아/);
});

test("갑목 인월 건록·묘월 양인을 구분하며 음간 양인을 임의 확정하지 않는다", () => {
  const analyze = (day: string, month: string) => analyzeNatal(chartOf(["癸子", "丙" + month, day + "辰", "庚申"]));
  assert.equal(analyze("甲", "寅").pattern.candidates[0].name, "건록격 후보");
  assert.equal(analyze("甲", "卯").pattern.candidates[0].name, "양인격 후보");
  assert.equal(analyze("乙", "卯").pattern.candidates[0].name, "건록격 후보");
  assert.ok(!analyze("乙", "辰").pattern.candidates.some(candidate => candidate.name.includes("양인")));
});

test("조후 후보는 억부와 별도이며 겨울 화·여름 수를 최종 용신으로 단정하지 않는다", () => {
  for (const [month, element] of [["子", "화"], ["午", "수"]]) {
    const result = analyzeNatal(chartOf(["癸亥", "丙" + month, "甲辰", "庚申"]));
    assert.equal(result.useful.climate.element, element);
    assert.match(result.useful.climate.text, /최종 용신이라는 뜻은 아니/);
  }
  assert.equal(analyzeNatal(chartOf(["癸亥", "丙寅", "甲辰", "庚申"])).useful.climate.element, null);
});

test("계산 근거 ID는 중복 없이 제공하고 서비스 비교 규칙과 한계를 명시한다", () => {
  const result = analyzeNatal(dated("1994-12-01"));
  assert.equal(new Set(result.facts.map(fact => fact.id)).size, result.facts.length);
  assert.ok(result.facts.every(fact => fact.text.length > 0));
  assert.match(result.method, /전문가 감수 전/);
  assert.match(result.method, /공인 점수/);
  assert.match(result.pattern.note, /성격·파격.*확정하지/);
});
