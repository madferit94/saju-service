import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { analyzeFlow, buildFortuneReport, tenGod } from "../lib/saju/fortune";

const birth: SajuInput = {
  date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general",
};

function reportFor(input = birth, year = 2026) {
  return buildFortuneReport(calculate(input), calculateDaewoon(input, 0, year), year);
}

test("십성은 오행의 생극과 음양을 함께 구분한다", () => {
  const stems = [..."甲乙丙丁戊己庚辛壬癸"];
  assert.deepEqual(stems.map((stem) => tenGod("甲", stem)), [
    "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인",
  ]);
  assert.deepEqual(stems.map((stem) => tenGod("乙", stem)), [
    "겁재", "비견", "상관", "식신", "정재", "편재", "정관", "편관", "정인", "편인",
  ]);
  // 금 일간은 수를 생하고 목을 극하며 화에게 극을 받는다.
  assert.equal(tenGod("辛", "壬"), "상관");
  assert.equal(tenGod("辛", "乙"), "편재");
  assert.equal(tenGod("辛", "丙"), "정관");
});

test("지장간을 대표 오행 하나로 축약하지 않고 독음과 십성까지 연결한다", () => {
  const chart = calculate(birth);
  assert.equal(chart.dayMaster.character, "辛");
  const flow = analyzeFlow(chart, "甲辰", "검증할 운");
  assert.equal(flow.korean, "갑진");
  assert.equal(flow.stemGod, "정재");
  assert.deepEqual(
    flow.hiddenStems.map(({ stem, korean, god }) => ({ stem, korean, god })).sort((a, b) => a.stem.localeCompare(b.stem)),
    [
      { stem: "戊", korean: "무", god: "정인" },
      { stem: "乙", korean: "을", god: "편재" },
      { stem: "癸", korean: "계", god: "식신" },
    ].sort((a, b) => a.stem.localeCompare(b.stem)),
  );
});

test("같은 세운도 서로 다른 일간과 원국에서는 기회·부담·행동이 달라진다", () => {
  const first = analyzeFlow(calculate(birth), "丙午", "2026년");
  const other = analyzeFlow(calculate({ ...birth, date: "1994-12-15" }), "丙午", "2026년");
  assert.notEqual(first.stemGod, other.stemGod);
  assert.notEqual(first.opportunity, other.opportunity);
  assert.notEqual(first.risk, other.risk);
  assert.notEqual(first.action, other.action);
  assert.ok(first.evidence.length > 0);
  assert.ok(first.question.length > 10);
});

test("월운은 추가된 세운·대운의 합충을 이름과 함께 근거로 남긴다", () => {
  const flow = analyzeFlow(calculate(birth), "己丑", "월운", [
    { label: "검증 세운", ganji: "甲子" },
    { label: "검증 대운", ganji: "癸未" },
  ]);
  assert.ok(flow.evidence.some((line) => line.includes("검증 세운") && line.includes("천간합")));
  assert.ok(flow.evidence.some((line) => line.includes("검증 세운") && line.includes("지지육합")));
  assert.ok(flow.evidence.some((line) => line.includes("검증 대운") && line.includes("지지충")));
});

test("2026 세운은 병오이며 입춘의 정확한 시각부터 다음 입춘까지다", () => {
  const report = reportFor();
  assert.equal(report.version, 2);
  assert.equal(report.year, 2026);
  assert.equal(report.annual.ganji, "丙午");
  assert.equal(report.annual.korean, "병오");
  assert.equal(Date.parse(report.annual.startAt), Date.parse("2026-02-04T04:02:08+08:00"));
  assert.equal(Date.parse(report.annual.endAt), Date.parse("2027-02-04T09:46:18+08:00"));
  assert.ok(report.annual.daewoon.length > 0);
});

test("선택 연도가 바뀌면 세운·월운·종합 해석이 함께 바뀐다", () => {
  const first = reportFor(birth, 2025);
  const next = reportFor(birth, 2027);
  assert.equal(first.annual.ganji, "乙巳");
  assert.equal(next.annual.ganji, "丁未");
  assert.notEqual(first.synthesis, next.synthesis);
  assert.notEqual(first.months[0].ganji, next.months[0].ganji);
  assert.equal(Date.parse(first.months[11].endAt), Date.parse(reportFor().months[0].startAt));
});

test("월운은 소한부터 12개 절기 구간이며 1월을 전년도 연운에 맞춰 계산한다", () => {
  const report = reportFor();
  assert.deepEqual(report.months.map(({ month }) => month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(report.months.map(({ ganji }) => ganji), [
    "己丑", "庚寅", "辛卯", "壬辰", "癸巳", "甲午", "乙未", "丙申", "丁酉", "戊戌", "己亥", "庚子",
  ]);
  assert.equal(Date.parse(report.months[0].startAt), Date.parse("2026-01-05T16:23:10+08:00"));
  assert.equal(Date.parse(report.months[0].endAt), Date.parse(report.annual.startAt));
  assert.equal(Date.parse(report.months[11].endAt), Date.parse("2027-01-05T22:09:58+08:00"));
  for (const [index, month] of report.months.entries()) {
    assert.ok(Date.parse(month.startAt) < Date.parse(month.endAt));
    if (index > 0) assert.equal(month.startAt, report.months[index - 1].endAt);
    assert.ok(month.evidence.length > 0);
    assert.ok(month.action.length > 10);
  }
});

test("평생운은 실제 대운과 각 생애 구간의 교집합만 표시하고 100세까지 빠짐없이 잇는다", () => {
  const timeline = calculateDaewoon(birth, 0, 2026);
  const report = buildFortuneReport(calculate(birth), timeline);
  const boundaries = [[1, 19], [20, 39], [40, 59], [60, 100]];
  assert.equal(report.lifetime.length, boundaries.length);
  const allAges: number[] = [];
  for (const [index, stage] of report.lifetime.entries()) {
    const [minAge, maxAge] = boundaries[index];
    const expected = timeline.periods.filter((period) => period.endAge >= minAge && period.startAge <= maxAge);
    assert.equal(stage.periods.length, expected.length);
    for (const [periodIndex, period] of stage.periods.entries()) {
      const source = expected[periodIndex];
      assert.equal(period.startAge, Math.max(minAge, source.startAge));
      assert.equal(period.endAge, Math.min(maxAge, source.endAge));
      assert.equal(period.startYear, 1994 + period.startAge - 1);
      assert.equal(period.endYear, 1994 + period.endAge - 1);
      assert.ok(period.summary.length > 10);
      for (let age = period.startAge; age <= period.endAge; age++) allAges.push(age);
    }
  }
  assert.deepEqual(allAges, Array.from({ length: 100 }, (_, index) => index + 1));
});

test("종합 해석은 원국의 충·합과 여러 생활 주제를 포함한다", () => {
  const report = reportFor();
  const natal = JSON.stringify(report.natal);
  // 이 생일의 원국: 갑술·을해·신유·임진. 진술충과 진유합이 공존한다.
  assert.match(natal, /충/);
  assert.match(natal, /합/);
  assert.ok(report.natal.contacts.some((line) => line.includes("甲戌") && line.includes("壬辰") && line.includes("지지충")));
  assert.ok(report.natal.contacts.some((line) => line.includes("辛酉") && line.includes("壬辰") && line.includes("지지육합")));
  assert.ok(report.natal.hiddenStems.length >= 4);
  assert.ok(report.domains.length >= 3);
  assert.ok(report.domains.every((domain) => domain.title.length > 0 && domain.body.length > 30));
  assert.notEqual(report.synthesis, reportFor({ ...birth, date: "1994-12-15" }).synthesis);
  assert.deepEqual(reportFor(), report);
  assert.doesNotMatch(JSON.stringify(report), /undefined|NaN/);
});

test("어린이의 세운·월운 행동은 보호·배움 환경에 맞추고 성인의 일·투자 조언을 붙이지 않는다", () => {
  const report = reportFor({ ...birth, date: "2020-12-01" });
  for (const flow of [report.annual, ...report.months]) {
    assert.match(flow.action, /보호자|놀이|배움/);
    assert.doesNotMatch(flow.action, /보상|고객|납기|수익|공동 지출|업무/);
  }
  for (const period of report.lifetime[0].periods) {
    if (period.action) {
      assert.match(period.action, /공부|배우|보호자|놀이/);
      assert.doesNotMatch(period.action, /보상|고객|납기|수익|공동 지출|업무/);
    }
  }
});
