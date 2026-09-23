import test from "node:test";
import assert from "node:assert/strict";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculate, type SajuInput } from "../lib/saju/chart";

const birth: SajuInput = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "general",
};

test("같은 출생 정보라도 순행과 역행 대운의 시작일과 간지가 다르다", () => {
  const forward = calculateDaewoon(birth, 0, 2026);
  const backward = calculateDaewoon(birth, 1, 2026);

  assert.equal(forward.direction, "forward");
  assert.equal(forward.firstStartDate, "2010-06-23");
  assert.deepEqual(
    forward.periods.slice(1, 4).map(({ ganji, korean, startYear, endYear }) => ({
      ganji,
      korean,
      startYear,
      endYear,
    })),
    [
      { ganji: "己丑", korean: "기축", startYear: 2010, endYear: 2019 },
      { ganji: "庚寅", korean: "경인", startYear: 2020, endYear: 2029 },
      { ganji: "辛卯", korean: "신묘", startYear: 2030, endYear: 2039 },
    ],
  );
  assert.equal(backward.direction, "backward");
  assert.equal(backward.firstStartDate, "2011-04-23");
  assert.deepEqual(
    backward.periods.slice(1, 4).map(({ ganji, korean, startYear, endYear }) => ({
      ganji,
      korean,
      startYear,
      endYear,
    })),
    [
      { ganji: "丁亥", korean: "정해", startYear: 2011, endYear: 2020 },
      { ganji: "丙戌", korean: "병술", startYear: 2021, endYear: 2030 },
      { ganji: "乙酉", korean: "을유", startYear: 2031, endYear: 2040 },
    ],
  );
});

test("대운 구간의 시작 연도와 끝 연도를 현재로 포함한다", () => {
  const beforeBoundary = calculateDaewoon(birth, 0, 2019);
  assert.equal(beforeBoundary.periods[1].status, "current");
  assert.equal(beforeBoundary.periods[2].status, "future");

  const afterBoundary = calculateDaewoon(birth, 0, 2020);
  assert.equal(afterBoundary.periods[1].status, "past");
  assert.equal(afterBoundary.periods[2].status, "current");
  assert.equal(afterBoundary.periods[3].status, "future");
  assert.equal(afterBoundary.currentYear, 2020);

  const lastYear = calculateDaewoon(birth, 0, 2029);
  assert.equal(lastYear.periods[2].status, "current");
  assert.equal(lastYear.periods[3].status, "future");
});

test("대운 구간은 시간순이며 구간 사이 연도가 빠지지 않는다", () => {
  const timeline = calculateDaewoon(birth, 1, 2026);
  assert.ok(timeline.periods.length >= 10);
  for (let index = 1; index < timeline.periods.length; index++) {
    const previous = timeline.periods[index - 1];
    const period = timeline.periods[index];
    assert.equal(period.startYear, previous.endYear + 1);
    assert.equal(period.startAge, previous.endAge + 1);
    assert.ok(period.endYear >= period.startYear);
  }
  assert.equal(timeline.periods.filter((period) => period.status === "current").length, 1);
});

test("잘못된 출생 정보와 대운 계산 방식을 거부한다", () => {
  assert.throws(
    () => calculateDaewoon({ ...birth, date: "2005-02-29" }, 0, 2026),
    /존재하는 날짜/,
  );
  assert.throws(
    () => calculateDaewoon({ ...birth, time: "25:00" }, 0, 2026),
    /시각/,
  );
  assert.throws(
    () => calculateDaewoon(birth, 2 as 0 | 1, 2026),
    /계산 방식/,
  );
});

test("한국 시각 입춘 경계에서 사주 년주와 대운 방향 및 첫 간지가 함께 바뀐다", () => {
  const before = { ...birth, date: "2024-02-04", time: "17:26" };
  const after = { ...birth, date: "2024-02-04", time: "17:28" };

  assert.deepEqual(calculate(before).pillars.slice(0, 2).map((p) => p.text), ["癸卯", "乙丑"]);
  assert.deepEqual(calculate(after).pillars.slice(0, 2).map((p) => p.text), ["甲辰", "丙寅"]);

  const beforeTimeline = calculateDaewoon(before, 0, 2026);
  const afterTimeline = calculateDaewoon(after, 0, 2026);
  assert.equal(beforeTimeline.direction, "forward");
  assert.equal(afterTimeline.direction, "backward");
  assert.equal(beforeTimeline.periods.find((period) => period.index === 1)?.ganji, "丙寅");
  assert.equal(afterTimeline.periods.find((period) => period.index === 1)?.ganji, "乙丑");
});
