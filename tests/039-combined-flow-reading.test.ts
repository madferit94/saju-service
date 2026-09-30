import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuChart } from "../lib/saju/chart";
import { combineFlow, flowParts } from "../lib/saju/flow-combination";
import { analyzeFlow, koreanGanji, forLifeStage } from "../lib/saju/fortune";

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const elements = ["목", "화", "토", "금", "수"];
const branches: Record<string, string> = { 子:"수",丑:"토",寅:"목",卯:"목",辰:"토",巳:"화",午:"화",未:"토",申:"금",酉:"금",戌:"토",亥:"수" };
function fixture(texts: [string, string, string, string]): SajuChart {
  const chart = calculate({ date: "1994-12-01", time: "12:00", calendar: "solar", topic: "general" });
  chart.pillars = texts.map((text, i) => ({ label: ["년주", "월주", "일주", "시주"][i], text, korean: koreanGanji(text), stem: text[0], branch: text[1], stemElement: elements[Math.floor(stems.indexOf(text[0]) / 2)], branchElement: branches[text[1]] }));
  chart.dayMaster = { character: texts[2][0], korean: koreanGanji(texts[2])[0], element: chart.pillars[2].stemElement };
  return chart;
}

test("운의 지장간은 본기뿐 아니라 중기·여기까지 25의 총 가중으로 전달한다", () => {
  assert.deepEqual(flowParts("甲", "庚申").map(p => [p.stem, p.weight, p.god]), [["庚",10,"편관"],["庚",9,"편관"],["壬",4.5,"편인"],["戊",1.5,"편재"]]);
  assert.deepEqual(flowParts("甲", "壬午").map(p => p.weight), [10,10.5,4.5]);
  assert.deepEqual(flowParts("甲", "甲子").map(p => p.weight), [10,15]);
  for (const invalid of ["", "甲", "甲X", "X子", "甲子甲"]) assert.throws(() => flowParts("甲", invalid));
});

test("균형 개선은 월령의 같은 계수로 원국과 모든 운 지장간을 비교한다", () => {
  const result = combineFlow(fixture(["癸亥", "丙寅", "甲辰", "庚申"]), "庚申");
  // Independently hand-calculated spring fixture: natal support59.75 / total103.15.
  // Incoming 庚10*.8 + 庚9*.8 + 壬4.5*1 + 戊1.5*.6 =20.6; support4.5.
  const before = 59.75 / 103.15 * 100;
  const after = 64.25 / 123.75 * 100;
  assert.ok(Math.abs(result.before - before) < 1e-10);
  assert.ok(Math.abs(result.after - after) < 1e-10);
  assert.ok(Math.abs(result.balanceGain - (Math.abs(before - 50) - Math.abs(after - 50))) < 1e-10);
});

test("같은 일간·십성·운도 원국 생조 배치에 따라 기회와 부담이 달라진다", () => {
  const strong = fixture(["甲卯", "壬寅", "甲辰", "癸亥"]), weak = fixture(["庚酉", "丙午", "甲辰", "辛申"]);
  const a = analyzeFlow(strong, "庚申", "가상 대운"), b = analyzeFlow(weak, "庚申", "가상 대운");
  assert.equal(a.stemGod, b.stemGod);
  assert.notEqual(a.opportunity, b.opportunity);
  assert.notEqual(a.risk, b.risk);
  assert.notEqual(a.action, b.action);
});

test("조합 근거는 실제 원국의 자리와 운 글자를 가리키며 ID가 중복되지 않는다", () => {
  const chart = fixture(["癸亥", "丙寅", "甲辰", "庚申"]);
  const result = combineFlow(chart, "庚申");
  assert.equal(new Set(result.facts.map(f => f.id)).size, result.facts.length);
  assert.match(result.facts.find(f => f.id === "natal_season")!.text, /월주 丙寅.*일간 甲/);
  assert.match(result.facts.find(f => f.id === "natal_roots")!.text, /년주 亥.*월주 寅.*일주 辰/);
  assert.doesNotMatch(result.facts.find(f => f.id === "natal_roots")!.text, /시주 申/);
  assert.deepEqual(result.exposed, ["庚"]);
  assert.match(result.facts.find(f => f.id === "flow_parts")!.text, /庚申.*壬 편인.*戊 편재/);
});

test("조합 해석을 적용해도 미성년과 후반기 생활 조언은 보호한다", () => {
  const flow = analyzeFlow(fixture(["庚酉", "丙午", "甲辰", "辛申"]), "戊辰", "가상 대운");
  const child = forLifeStage(flow, 12), later = forLifeStage(flow, 75);
  assert.match(child.opportunity, /학교|배움|또래/);
  assert.doesNotMatch(child.action, /직장|투자|거래|수익/);
  assert.match(later.opportunity, /생활|경험|활동|모임/);
  assert.doesNotMatch(later.action, /취업|승진|직장/);
});
