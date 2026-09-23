import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { buildLocalReading } from "../lib/saju/reading";

const input: SajuInput = {
  date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general",
};

test("로컬 해석은 계산된 일간·월지·오행·대운·귀인을 근거로 여덟 주제를 채운다", () => {
  const chart = calculate(input);
  const timeline = calculateDaewoon(input, 0, 2026);
  const benefactors = calculateBenefactors(chart);
  const result = buildLocalReading(chart, timeline, benefactors);

  assert.deepEqual(Object.keys(result).sort(), [
    "overview", "pillarReadings", "past", "current", "future", "career", "relationships", "money", "caution", "periodReadings",
  ].sort());
  for (const value of Object.values(result)) {
    if (typeof value === "string") assert.ok(value.length > 30);
  }
  assert.ok(result.overview.includes(chart.dayMaster.korean + chart.dayMaster.element));
  assert.ok(result.overview.includes(chart.pillars[1].branch));
  assert.ok(result.overview.includes(String(chart.elements.금)));
  assert.equal(result.pillarReadings.length, chart.pillars.length);
  for (const [index, pillar] of chart.pillars.entries()) {
    const reading = result.pillarReadings[index];
    assert.equal(reading.label, pillar.label);
    assert.equal(reading.hanja, pillar.text);
    assert.equal(reading.korean, pillar.korean);
    assert.ok(reading.characterGloss.includes(pillar.stemElement));
    assert.ok(reading.characterGloss.includes(pillar.branchElement));
    assert.match(reading.interpretation, /일간과의 관계/);
  }
  const currentPeriod = timeline.periods.find((period) => period.status === "current");
  assert.ok(currentPeriod);
  assert.ok(result.current.includes(currentPeriod.korean));
  assert.ok(result.current.includes(String(currentPeriod.startYear)));
  assert.ok(result.relationships.includes("월덕귀인"));
  assert.equal(result.periodReadings.length, timeline.periods.length);
  assert.equal(result.periodReadings[0].index, timeline.periods[0].index);
  const currentReading = result.periodReadings.find((item) => item.index === currentPeriod?.index);
  assert.ok(currentReading?.theme.includes(String(currentPeriod?.startYear)));
  assert.deepEqual(buildLocalReading(chart, timeline, benefactors), result);
  assert.ok(!JSON.stringify(result).includes(input.date));
  assert.ok(!JSON.stringify(result).includes(input.time));
});

test("과거·현재·미래 해석은 해당 대운의 활용점·부담·행동에 연결된다", () => {
  const chart = calculate(input);
  const timeline = calculateDaewoon(input, 0, 2026);
  const result = buildLocalReading(chart, timeline, calculateBenefactors(chart));
  const periods = {
    past: timeline.periods.filter((period) => period.status === "past").at(-1),
    current: timeline.periods.find((period) => period.status === "current"),
    future: timeline.periods.find((period) => period.status === "future"),
  };
  for (const key of ["past", "current", "future"] as const) {
    const period = periods[key];
    assert.ok(period);
    const detail = result.periodReadings.find((item) => item.index === period.index);
    assert.ok(detail);
    assert.ok(result[key].includes(`${period.startYear}–${period.endYear}년`));
    assert.ok(result[key].includes(detail.strengths));
    assert.ok(result[key].includes(detail.cautions));
    assert.ok(result[key].includes(detail.advice));
  }
  assert.match(result.relationships, /월덕귀인/);
  assert.match(result.caution, /강약·용신/);
  assert.doesNotMatch(result.caution, /지장간·계절 가중치·합충·용신 등은 반영하지 않아/);
});

test("다른 사주와 대운에서는 근거와 시기 설명이 달라진다", () => {
  const firstChart = calculate(input);
  const first = buildLocalReading(firstChart, calculateDaewoon(input, 0, 2026), calculateBenefactors(firstChart));
  const otherInput = { ...input, date: "1999-06-07", time: "09:11" };
  const otherChart = calculate(otherInput);
  const other = buildLocalReading(otherChart, calculateDaewoon(otherInput, 0, 2026), calculateBenefactors(otherChart));
  assert.notEqual(first.overview, other.overview);
  assert.notEqual(first.current, other.current);
  assert.notEqual(first.relationships, other.relationships);
});

test("현재 대운이 성인기까지 이어져도 미성년 이용자의 지금 조언은 현재 나이에 맞춘다", () => {
  const teenInput = { ...input, date: "2009-12-01" };
  const chart = calculate(teenInput);
  const timeline = calculateDaewoon(teenInput, 0, 2026);
  const current = timeline.periods.find((period) => period.status === "current");
  assert.ok(current && current.endAge >= 20);
  const reading = buildLocalReading(chart, timeline, calculateBenefactors(chart));
  assert.match(reading.current, /학교|배움|또래|공부/);
  assert.doesNotMatch(reading.current, /보상 기준|고객|납기|수익|공동 지출|업무/);
});

test("각 대운 해석 문구는 같은 인덱스의 기간·간지·상태에 연결된다", () => {
  const chart = calculate(input);
  const timeline = calculateDaewoon(input, 0, 2026);
  const readings = buildLocalReading(chart, timeline, calculateBenefactors(chart)).periodReadings;

  assert.equal(readings.length, timeline.periods.length);
  for (const [index, period] of timeline.periods.entries()) {
    const reading = readings[index];
    assert.equal(reading.index, period.index);
    assert.ok(reading.theme.includes(`${period.startYear}–${period.endYear}년`));
    if (period.index === 0) {
      assert.ok(reading.theme.includes("대운 시작 전"));
    } else {
      assert.ok(reading.theme.includes(`${period.korean}(${period.ganji}) 대운`));
      assert.ok(reading.theme.includes(period.ganji));
      assert.match(reading.theme, /지장간/);
    }
    for (const field of ["strengths", "cautions", "advice", "reflection"] as const) {
      assert.ok(reading[field].length > 15);
    }
    assert.match(reading.reflection, /\?/);
  }
  const adult = readings.filter((_, index) => timeline.periods[index].startAge >= 20);
  assert.ok(new Set(adult.map((reading) => reading.advice)).size >= 4,
    "성인 대운마다 같은 일반 조언을 반복하지 않아야 합니다.");
});

test("기둥별 해석은 네 간지의 독음·천간/지지 오행·일간 관계·자리 근거를 정확히 잇는다", () => {
  const chart = calculate(input);
  const result = buildLocalReading(
    chart,
    calculateDaewoon(input, 0, 2026),
    calculateBenefactors(chart),
  );
  const expected = [
    {
      label: "년주", hanja: "乙酉", korean: "을유", stem: "乙", stemKorean: "을", stemElement: "목",
      branch: "酉", branchKorean: "유", branchElement: "금",
      stemRelation: "성과와 관리에 눈이 갈 수 있으나 통제하려는 마음이 부담이 될 수 있습니다",
      branchRelation: "비슷한 방식의 힘을 보태거나 경쟁이 심해질 수 있습니다",
      role: "전통적으로 초년의 바탕과 집안·바깥 환경을 돌아보는 자리",
    },
    {
      label: "월주", hanja: "戊子", korean: "무자", stem: "戊", stemKorean: "무", stemElement: "토",
      branch: "子", branchKorean: "자", branchElement: "수",
      stemRelation: "도움과 배움이 들어올 수 있으나 의존이 커지지 않게 살펴야 합니다",
      branchRelation: "표현과 결과물을 내기 좋지만 에너지 소모를 함께 살펴야 합니다",
      role: "성장 환경과 사회에서 맡는 역할, 계절 기운을 살펴보는 자리",
    },
    {
      label: "일주", hanja: "辛巳", korean: "신사", stem: "辛", stemKorean: "신", stemElement: "금",
      branch: "巳", branchKorean: "사", branchElement: "화",
      stemRelation: "비슷한 방식의 힘을 보태거나 경쟁이 심해질 수 있습니다",
      branchRelation: "규칙과 책임이 성장을 밀어줄 수 있으나 압박도 커질 수 있습니다",
      role: "나 자신을 중심에 두고 가까운 관계를 함께 돌아보는 자리",
    },
    {
      label: "시주", hanja: "壬辰", korean: "임진", stem: "壬", stemKorean: "임", stemElement: "수",
      branch: "辰", branchKorean: "진", branchElement: "토",
      stemRelation: "표현과 결과물을 내기 좋지만 에너지 소모를 함께 살펴야 합니다",
      branchRelation: "도움과 배움이 들어올 수 있으나 의존이 커지지 않게 살펴야 합니다",
      role: "앞으로 기르고 싶은 일과 장기 계획을 비춰보는 자리",
    },
  ];

  assert.equal(result.pillarReadings.length, expected.length);
  for (const [index, item] of expected.entries()) {
    const actual = result.pillarReadings[index];
    assert.deepEqual(
      [actual.label, actual.hanja, actual.korean],
      [item.label, item.hanja, item.korean],
    );
    assert.equal(
      actual.characterGloss,
      `${item.stem}(${item.stemKorean}·${item.stemElement}) · ${item.branch}(${item.branchKorean}·${item.branchElement})`,
    );
    assert.ok(actual.interpretation.includes(item.role));
    assert.ok(actual.interpretation.includes(`천간 ${item.stem}(${item.stemKorean}, ${item.stemElement})`));
    assert.ok(actual.interpretation.includes(item.stemRelation));
    assert.ok(actual.interpretation.includes(`지지 ${item.branch}(${item.branchKorean}, ${item.branchElement})`));
    assert.ok(actual.interpretation.includes(item.branchRelation));
    assert.match(actual.interpretation, /실제 성격이나 사건을 확정하는 표가 아니라/);
  }
});
