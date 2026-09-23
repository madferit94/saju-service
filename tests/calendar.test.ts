import test from "node:test";
import assert from "node:assert/strict";
import { getCalendarCandidates, resolveSolarDate } from "../lib/saju/calendar";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";

const base: SajuInput = {
  date: "2020-04-01",
  time: "12:00",
  calendar: "lunar",
  leapMonth: "unknown",
  topic: "general",
};

test("음력 평달과 윤달을 각각 양력 날짜로 변환한다", () => {
  const candidates = getCalendarCandidates(base);
  assert.deepEqual(candidates.map(({ label, solarDate }) => [label, solarDate]), [
    ["평달", "2020-04-23"],
    ["윤달", "2020-05-23"],
  ]);
});

test("윤달 여부 모름은 같은 달에 윤달이 있을 때 두 후보를 제공한다", () => {
  const candidates = getCalendarCandidates(base);
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates.map(({ input }) => input.leapMonth), ["regular", "leap"]);
  assert.throws(() => resolveSolarDate(base), /윤달 여부를 확인할 수 없습니다/);
});

test("해당 연도에 그 달 윤달이 없으면 평달만 사용한다고 알린다", () => {
  const candidates = getCalendarCandidates({ ...base, date: "2020-05-01" });
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].label, /윤달 없음/);
  assert.equal(candidates[0].solarDate, "2020-06-21");
});

test("없는 윤달을 명시하면 계산 전에 안내한다", () => {
  assert.throws(
    () => getCalendarCandidates({ ...base, date: "2020-05-01", leapMonth: "leap" }),
    /윤달이 없습니다/,
  );
});

test("음력 후보는 변환된 양력 날짜의 원국과 대운을 사용한다", () => {
  const lunarCandidate = getCalendarCandidates(base)[0].input;
  const solarInput: SajuInput = { ...base, date: "2020-04-23", calendar: "solar", leapMonth: undefined };
  assert.deepEqual(calculate(lunarCandidate).pillars, calculate(solarInput).pillars);
  assert.deepEqual(
    calculateDaewoon(lunarCandidate, 0).periods,
    calculateDaewoon(solarInput, 0).periods,
  );
});
