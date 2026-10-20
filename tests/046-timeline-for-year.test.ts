import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SajuInput } from "../lib/saju/chart";
import {
  calculateDaewoon,
  periodStatus,
  timelineForYear,
  type DaewoonTimeline,
  type PeriodStatus,
  type YunGender,
} from "../lib/saju/daewoon";

// origin/main(c8bd559, Spec 046 이전)의 calculateDaewoon으로 미리 계산해 둔 결과.
// 새 코드가 아니라 이전 코드에서 나온 값이므로 "계산 결과가 바뀌지 않았다"는 비교 기준이 된다.
type Fixture = {
  source: string;
  years: number[];
  cases: { name: string; input: SajuInput; gender: YunGender; timelines: Record<string, DaewoonTimeline> }[];
};
const fixture = JSON.parse(readFileSync(new URL("./fixtures/046-daewoon-main.json", import.meta.url), "utf8")) as Fixture;

// origin/main의 calculateDaewoon 안에 있던 판정식을 그대로 옮겨 적은 것.
function oldInlineStatus(startYear: number, endYear: number, currentYear: number): PeriodStatus {
  return endYear < currentYear
    ? "past"
    : startYear > currentYear
      ? "future"
      : "current";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test("calculateDaewoon 결과가 Spec 046 이전(main)과 같다", () => {
  assert.ok(fixture.cases.length >= 5);
  for (const item of fixture.cases) {
    for (const year of fixture.years) {
      assert.deepEqual(calculateDaewoon(item.input, item.gender, year), item.timelines[year], `${item.name} / ${year}년`);
    }
  }
});

test("periodStatus는 main의 인라인 판정식과 모든 경우에 같다", () => {
  for (let start = 1990; start <= 2030; start++) {
    for (let end = start - 1; end <= start + 12; end++) {
      for (let current = 1985; current <= 2045; current++) {
        assert.equal(periodStatus(start, end, current), oldInlineStatus(start, end, current), `${start}-${end} / ${current}`);
      }
    }
  }
  assert.equal(periodStatus(2010, 2019, 2010), "current", "시작 연도는 현재");
  assert.equal(periodStatus(2010, 2019, 2019), "current", "끝 연도는 현재");
  assert.equal(periodStatus(2010, 2019, 2009), "future");
  assert.equal(periodStatus(2010, 2019, 2020), "past");
});

test("예전 해에 계산한 대운표를 다른 해로 맞추면 그 해에 새로 계산한 것과 같다", () => {
  for (const item of fixture.cases) {
    for (const savedYear of fixture.years) {
      for (const targetYear of fixture.years) {
        const saved = structuredClone(item.timelines[savedYear]);
        assert.deepEqual(timelineForYear(saved, targetYear), item.timelines[targetYear], `${item.name}: ${savedYear} → ${targetYear}`);
      }
    }
  }
});

test("대운의 시작·끝 해와 그 앞뒤 해에서도 새 계산과 같고 현재 대운이 정확히 하나다", () => {
  for (const item of fixture.cases) {
    const saved = calculateDaewoon(item.input, item.gender, 2015);
    const years = new Set<number>();
    for (const period of saved.periods) {
      for (const year of [period.startYear - 1, period.startYear, period.endYear, period.endYear + 1]) years.add(year);
    }
    for (const year of years) {
      const shown = timelineForYear(saved, year);
      assert.deepEqual(shown, calculateDaewoon(item.input, item.gender, year), `${item.name}: ${year}년`);
      const last = saved.periods.at(-1)!;
      const inside = saved.periods[0].startYear <= year && year <= last.endYear;
      const current = shown.periods.filter((period) => period.status === "current");
      assert.equal(current.length, inside ? 1 : 0, `${item.name}: ${year}년의 현재 대운 수`);
      if (current[0]) assert.ok(current[0].startYear <= year && year <= current[0].endYear);
      assert.equal(shown.currentYear, year);
    }
    for (const period of saved.periods) {
      assert.equal(timelineForYear(saved, period.startYear).periods.find((p) => p.index === period.index)!.status, "current", `${item.name}: ${period.startYear}년 시작 해`);
      assert.equal(timelineForYear(saved, period.endYear).periods.find((p) => p.index === period.index)!.status, "current", `${item.name}: ${period.endYear}년 끝 해`);
      assert.equal(timelineForYear(saved, period.startYear - 1).periods.find((p) => p.index === period.index)!.status, "future");
      assert.equal(timelineForYear(saved, period.endYear + 1).periods.find((p) => p.index === period.index)!.status, "past");
    }
  }
});

test("첫 대운 시작 전 구간(index 0)에서는 대운 시작 전이 현재이고 나머지는 앞으로다", () => {
  const input: SajuInput = { date: "2000-02-04", time: "08:37", calendar: "solar", topic: "general" };
  const saved = calculateDaewoon(input, 1, 2045);
  assert.equal(saved.periods[0].index, 0, "이 입력은 대운 시작 전 구간이 있어야 합니다");
  const birthYear = saved.periods[0].startYear;
  for (const year of [birthYear, saved.periods[0].endYear]) {
    const shown = timelineForYear(saved, year);
    assert.deepEqual(shown, calculateDaewoon(input, 1, year));
    assert.deepEqual(shown.periods.map((period) => period.status), ["current", ...Array(shown.periods.length - 1).fill("future")]);
  }
  // 출생 전 연도에는 모두 앞으로, 마지막 대운이 끝난 뒤에는 모두 지나온 흐름이다.
  assert.ok(timelineForYear(saved, birthYear - 1).periods.every((period) => period.status === "future"));
  assert.ok(timelineForYear(saved, saved.periods.at(-1)!.endYear + 1).periods.every((period) => period.status === "past"));
});

test("입력 대운표를 고치지 않고 기간 정보는 그대로 둔다", () => {
  const item = fixture.cases[0];
  const saved = deepFreeze(structuredClone(item.timelines[2015]));
  const before = JSON.stringify(saved);
  const shown = timelineForYear(saved, 2031); // 얼린 객체를 고치려 하면 strict mode에서 예외가 난다.
  assert.equal(JSON.stringify(saved), before);
  assert.equal(saved.currentYear, 2015);
  assert.notEqual(shown, saved);
  assert.equal(shown.currentYear, 2031);
  const strip = (timeline: DaewoonTimeline) => ({ ...timeline, currentYear: 0, periods: timeline.periods.map(({ status: _status, ...rest }) => rest) });
  assert.deepEqual(strip(shown), strip(saved), "간지·연도·나이·방향·첫 대운 시작일은 바뀌지 않는다");
});

test("같은 해를 넣으면 같은 객체를 돌려주고 다른 해면 새 객체를 돌려준다", () => {
  for (const item of fixture.cases) {
    const saved = structuredClone(item.timelines[2026]);
    assert.equal(timelineForYear(saved, 2026), saved);
    assert.notEqual(timelineForYear(saved, 2027), saved);
  }
  // 기준 연도만 같고 구분이 어긋난 저장본은 고쳐서 새 객체로 돌려준다.
  const tampered = structuredClone(fixture.cases[0].timelines[2026]);
  tampered.periods.forEach((period) => { period.status = "future"; });
  const fixed = timelineForYear(tampered, 2026);
  assert.notEqual(fixed, tampered);
  assert.deepEqual(fixed, fixture.cases[0].timelines[2026]);
  assert.ok(tampered.periods.every((period) => period.status === "future"), "원래 객체는 그대로");
});

test("기준 연도를 생략하면 기기의 올해를 사용한다", () => {
  const year = new Date().getFullYear();
  const saved = structuredClone(fixture.cases[0].timelines[2010]);
  assert.deepEqual(timelineForYear(saved), calculateDaewoon(fixture.cases[0].input, fixture.cases[0].gender, year));
});
