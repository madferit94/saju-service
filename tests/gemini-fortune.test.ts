import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext, createGeminiReadingPrompt, createGeminiResponseSchema, validateGeminiSajuReading, validateReadingGrounding } from "../lib/saju/gemini-reading";
import { koreanGanji } from "../lib/saju/fortune";

const sentence = "계산된 간지와 십성의 관계를 실제 경험 및 선택 조건과 연결합니다.";
const latest = {
  readingVersion: 2 as const,
  fortuneYear: 2026,
  synthesis: sentence,
  lifetime: sentence,
  annual: sentence,
  monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, reading: sentence })),
  overview: sentence, elements: sentence, benefactors: sentence,
  career: sentence, relationships: sentence, money: sentence, caution: sentence,
  periodReadings: [{ index: 0, theme: sentence, strengths: sentence, cautions: sentence, advice: sentence, reflection: sentence }],
};

test("새 AI 응답은 선택 연도와 평생·세운·12월운을 모두 포함해야 한다", () => {
  assert.deepEqual(validateGeminiSajuReading(latest, [0], 2026), latest);
  for (const key of ["readingVersion", "fortuneYear", "synthesis", "lifetime", "annual", "monthly"] as const) {
    assert.throws(() => validateGeminiSajuReading({ ...latest, [key]: undefined }, [0], 2026));
  }
  assert.throws(() => validateGeminiSajuReading(latest, [0], 2027));
  for (const key of ["synthesis", "lifetime", "annual"] as const) {
    assert.throws(() => validateGeminiSajuReading({ ...latest, [key]: "   " }, [0], 2026));
  }
});

function groundedFixture() {
  const input: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };
  const chart = calculate(input);
  const context = createGeminiReadingContext(chart, calculateDaewoon(input, 0, 2026), calculateBenefactors(chart));
  return {
    context,
    reading: {
      ...latest,
      lifetime: "초년은 배움의 환경, 청년은 선택과 독립, 중년은 역할 조정, 후반은 경험 활용을 각 대운의 계산 근거와 함께 비교합니다.",
      monthly: context.fortune.months.map((month) => ({
        month: month.month,
        reading: `${month.daewoonGanji}(${koreanGanji(month.daewoonGanji)}) 대운, ${koreanGanji(month.annualGanji)}(${month.annualGanji}) 세운, ${month.ganji} 월운을 함께 읽습니다.`,
      })),
    },
  };
}

test("월별 간지의 대운·세운·월운 이름이 계산 자료와 일치하면 허용한다", () => {
  const { context, reading } = groundedFixture();
  assert.equal(context.fortune.months[0].annualGanji, "乙巳");
  assert.equal(context.fortune.months[1].annualGanji, "丙午");
  assert.doesNotThrow(() => validateReadingGrounding(reading, context));
});

test("AI가 월운 간지를 대운이라고 부르거나 입춘 전 세운을 올해 간지로 쓰면 거부한다", () => {
  const { context, reading } = groundedFixture();
  assert.notEqual(context.fortune.months[0].daewoonGanji, "己丑");
  for (const invalid of [
    "기축 대운의 영향을 살펴봅니다.",
    "己丑(기축) 대운의 영향을 살펴봅니다.",
    "기축(己丑) 대운의 영향을 살펴봅니다.",
    "병오 세운과 기축 월운을 함께 봅니다.",
    "丙午(병오) 세운과 기축 월운을 함께 봅니다.",
    "경인 월운의 영향을 살펴봅니다.",
  ]) {
    assert.throws(() => validateReadingGrounding({
      ...reading, monthly: [{ month: 1, reading: invalid }, ...reading.monthly.slice(1)],
    }, context), invalid);
  }
});

test("평생 해석이 후반을 생략하면 완성된 응답으로 통과시키지 않는다", () => {
  const { context, reading } = groundedFixture();
  assert.throws(() => validateReadingGrounding({
    ...reading, lifetime: "초년과 청년, 중년의 실제 대운 흐름을 비교합니다.",
  }, context));
});

test("응답 형식의 대운 개수·인덱스는 계산 결과에 맞추고 대운 시작 전 0번도 보존한다", () => {
  for (const indexes of [[0, 1, 2], [1, 2, 3, 4]]) {
    const schema = createGeminiResponseSchema(indexes);
    const periods = schema.properties.periodReadings;
    assert.equal(periods.minItems, indexes.length);
    assert.equal(periods.maxItems, indexes.length);
    assert.deepEqual(periods.items.properties.index.enum, indexes);
  }
});

test("새 월운 응답의 누락·중복·순서 오류와 빈 해석을 거부한다", () => {
  const invalid = [
    latest.monthly.slice(1),
    [...latest.monthly].reverse(),
    [...latest.monthly.slice(0, 11), { month: 11, reading: sentence }],
    [...latest.monthly.slice(0, 11), { month: 12, reading: "" }],
  ];
  for (const monthly of invalid) {
    assert.throws(() => validateGeminiSajuReading({ ...latest, monthly }, [0], 2026));
  }
});

test("옛 저장 응답은 계속 열 수 있어도 새 생성의 완성된 종합 해석으로 통과하지 않는다", () => {
  const { readingVersion, fortuneYear, synthesis, lifetime, annual, monthly, ...legacy } = latest;
  assert.deepEqual(validateGeminiSajuReading(legacy, [0]), legacy);
  assert.throws(() => validateGeminiSajuReading(legacy, [0], 2026));
});

test("AI 계산 자료는 선택 연도·지장간·합충을 포함하고 원래 출생 날짜·질문은 포함하지 않는다", () => {
  const input: SajuInput = {
    date: "1994-12-01", time: "08:37", calendar: "lunar", leapMonth: "regular", topic: "general", question: "전송하지 않을 개인 질문",
    birthplace: { countryCode: "US", countryName: "미국", city: "로스앤젤레스", province: "캘리포니아", timezone: "America/Los_Angeles", longitude: -118.2437 },
  };
  const chart = calculate(input);
  assert.ok(chart.method.includes(input.date));
  assert.ok(chart.method.includes(input.birthplace!.city));
  const context = createGeminiReadingContext(chart, calculateDaewoon(input, 0, 2026), calculateBenefactors(chart), 2027);
  assert.equal(context.fortune.year, 2027);
  assert.equal(context.fortune.annual.ganji, "丁未");
  assert.equal(context.fortune.months.length, 12);
  assert.ok(context.fortune.natal.hiddenStems.length > 0);
  assert.ok(context.fortune.natal.contacts.length > 0);
  const serialized = JSON.stringify(context);
  assert.ok(!serialized.includes(input.date));
  assert.ok(!serialized.includes(input.time));
  assert.ok(!serialized.includes(input.question!));
  assert.ok(!serialized.includes(chart.method));
  assert.ok(!serialized.includes(input.birthplace!.city));
  assert.ok(!serialized.includes(input.birthplace!.timezone));
  assert.ok(!serialized.includes(String(input.birthplace!.longitude)));
  const prompt = createGeminiReadingPrompt(context);
  assert.match(prompt, /한글 독음/);
  assert.match(prompt, /최소 두 근거/);
  assert.match(prompt, /다른 사주에도 그대로 적용될 문장/);
  assert.match(prompt, /실제 인간 경력을 사칭하지/);
});
