import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuChart } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { koreanGanji } from "../lib/saju/fortune";
import { buildLifeGraph } from "../lib/saju/life-graph";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { buildLifeSeasons } from "../lib/saju/life-seasons";

const birth = { date: "1994-12-01", time: "12:00", calendar: "solar", topic: "general" } as const;
const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const elements = ["목", "화", "토", "금", "수"];
const branches: Record<string, string> = { 子:"수",丑:"토",寅:"목",卯:"목",辰:"토",巳:"화",午:"화",未:"토",申:"금",酉:"금",戌:"토",亥:"수" };
// Synthetic pillars intentionally isolate the comparison rules, not a historical birth.
function fixture(texts: [string, string, string, string]): SajuChart {
  const chart = calculate(birth);
  chart.pillars = texts.map((text, i) => ({ label: ["년주", "월주", "일주", "시주"][i], text, korean: koreanGanji(text), stem: text[0], branch: text[1], stemElement: elements[Math.floor(stems.indexOf(text[0]) / 2)], branchElement: branches[text[1]] }));
  chart.dayMaster = { character: texts[2][0], korean: koreanGanji(texts[2])[0], element: chart.pillars[2].stemElement };
  return chart;
}
const timeline = calculateDaewoon(birth, 0, 2026);

test("민감하거나 한쪽으로 편중된 원국은 확정적인 전성기 후보를 만들지 않는다", () => {
  for (const chart of [calculate({ ...birth, date: "1994-01-15" }), fixture(["甲卯", "甲卯", "甲卯", "甲卯"]), fixture(["庚酉", "庚酉", "甲酉", "庚酉"])]) {
    const strength = analyzeNatal(chart).strength;
    assert.ok(strength.sensitive || strength.exceptional);
    const result = buildLifeGraph(chart, timeline);
    assert.deepEqual(result.featured, []);
    assert.notEqual(result.mode, "peak-candidate");
    assert.ok(result.periods.every(p => Number.isFinite(p.level)));
  }
});

test("모든 시기 조건이 같으면 동점을 숨겨 임의의 전성기를 고르지 않는다", () => {
  const repeated = { ...timeline, periods: timeline.periods.map(p => ({ ...p, ganji: p.ganji ? "庚申" : "", korean: p.ganji ? "경신" : "" })) };
  const result = buildLifeGraph(calculate(birth), repeated);
  assert.equal(new Set(result.periods.map(p => p.level)).size, 1);
  assert.deepEqual(result.featured, []);
});

test("생조 비중이 다른 원국에서 같은 운의 균형 보완 방향이 달라진다", () => {
  const strong = fixture(["甲卯", "壬寅", "甲辰", "癸亥"]);
  const weak = fixture(["庚酉", "丙午", "甲辰", "辛申"]);
  const custom = { ...timeline, periods: timeline.periods.filter(p => p.ganji).slice(0, 2).map((p, i) => ({ ...p, ganji: i ? "甲子" : "庚申", korean: i ? "갑자" : "경신" })) };
  const strongResult = buildLifeGraph(strong, custom), weakResult = buildLifeGraph(weak, custom);
  assert.ok(analyzeNatal(strong).strength.score > 60);
  assert.ok(analyzeNatal(weak).strength.score < 40);
  assert.ok(strongResult.periods[0].level > strongResult.periods[1].level, "신강 원국은 더 많은 생조보다 소모 방향이 균형을 보완한다");
  assert.ok(weakResult.periods[0].level < weakResult.periods[1].level, "신약 원국은 소모 방향보다 생조 방향이 균형을 보완한다");
});

test("계절은 지장간의 합산으로 앞글자와 다른 주제가 대표가 될 수 있다", () => {
  const chart = fixture(["癸亥", "丙寅", "甲辰", "庚申"]);
  const custom = { ...timeline, periods: timeline.periods.filter(p => p.ganji).slice(0, 1).map(p => ({ ...p, ganji: "庚子", korean: "경자" })) };
  const period = buildLifeSeasons(chart, custom).periods[0];
  // 甲 sees 庚 as 편관 (winter 10), 子's 癸 as 정인 (spring 15).
  assert.equal(period.stemGod, "편관");
  assert.equal(period.season, "spring");
  assert.equal(period.secondarySeason, "winter");
});

test("같은 오행 비중에서 천간합 하나가 늘어도 그래프에 가산하지 않는다", () => {
  const withContact = fixture(["癸亥", "丙寅", "甲辰", "庚申"]);
  const withoutContact = fixture(["壬亥", "丙寅", "甲辰", "庚申"]);
  const custom = { ...timeline, periods: timeline.periods.filter(p => p.ganji).slice(0, 1).map(p => ({ ...p, ganji: "戊子", korean: "무자" })) };
  const a = buildLifeGraph(withContact, custom).periods[0];
  const b = buildLifeGraph(withoutContact, custom).periods[0];
  assert.equal(a.connections.length, b.connections.length + 1, "戊癸 천간합만 추가된 사례");
  assert.equal(a.level, b.level);
});

test("같은 대운 안에서 연도가 바뀌면 세운 설명은 바뀌고 대운 계절은 유지된다", () => {
  const chart = calculate(birth);
  const first = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2026));
  const next = buildLifeSeasons(chart, calculateDaewoon(birth, 0, 2027));
  assert.equal(first.current!.periodIndex, next.current!.periodIndex);
  assert.equal(first.current!.season, next.current!.season);
  assert.equal(first.current!.annualGanji, "丙午");
  assert.equal(next.current!.annualGanji, "丁未");
  assert.notEqual(first.current!.annualTheme, next.current!.annualTheme);
  assert.ok(first.current!.annualAction.length > 20);
});
