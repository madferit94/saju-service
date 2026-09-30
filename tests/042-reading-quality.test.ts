import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext, createGeminiResponseSchema, validateGeminiSajuReading, type GeminiSajuReading } from "../lib/saju/gemini-reading";
import { validateInterpretationBasis, validateReadingQuality } from "../lib/saju/reading-quality";

const input = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" } as const;
const chart = calculate(input);
const context = createGeminiReadingContext(chart, calculateDaewoon(input, 0, 2026), calculateBenefactors(chart), 2026);
const plain = "익힌 일을 작게 실행하며 생활의 조건과 비교해 보세요.";
const basis = () => ({ synthesis: { ruleId: context.fortune.interpretationPlan.ruleId, evidenceIds: ["annual_flow_parts", "annual_natal_season"] }, annual: { ruleId: context.fortune.interpretationPlan.ruleId, evidenceIds: ["annual_flow_parts", "annual_natal_season"] } });
const reading = (): GeminiSajuReading => ({
  readingVersion: 2, fortuneYear: 2026, interpretationBasis: basis(),
  synthesis: plain, lifetime: "초년에는 배움, 청년에는 선택, 중년에는 역할, 후반에는 경험을 살펴보세요.", annual: plain,
  monthly: context.fortune.months.map(m => ({ month: m.month, reading: plain })),
  overview: plain, elements: plain, benefactors: plain, career: plain, money: plain, relationships: plain, caution: plain,
  periodReadings: context.timeline.periods.map(p => ({ index: p.index, theme: plain, strengths: plain, cautions: plain, advice: plain, reflection: plain })),
});

test("새 해석의 종합·연운은 공통 계획과 일치하는 규칙 및 원국·운 근거를 요구한다", () => {
  const plan = context.fortune.interpretationPlan;
  assert.doesNotThrow(() => validateInterpretationBasis(basis(), plan));
  for (const invalid of [undefined, {}, { ...basis(), annual: undefined }, { ...basis(), synthesis: { ruleId: "invented", evidenceIds: basis().synthesis.evidenceIds } }, { ...basis(), annual: { ruleId: plan.ruleId, evidenceIds: ["annual_flow_parts", "invented_fact"] } }, { ...basis(), annual: { ruleId: plan.ruleId, evidenceIds: ["annual_flow_parts", "annual_flow_parts"] } }]) {
    assert.throws(() => validateInterpretationBasis(invalid, plan));
  }
});

test("기존 저장 해석은 새 근거 선택 필드가 없어도 계속 읽는다", () => {
  const { interpretationBasis: unused, ...legacy } = reading();
  const restored = validateGeminiSajuReading(legacy, context.timeline.periods.map(p => p.index));
  assert.equal(restored.synthesis, plain);
});

test("정상 조건부 표현과 확정 예언을 부정하는 문장은 허용한다", () => {
  assert.doesNotThrow(() => validateReadingQuality(reading(), context));
  for (const safe of ["반드시 성공한다고 단정하지 않습니다. 실행할 범위를 작게 정해 보세요.", "무조건 부자가 되는 사주라고 볼 수 없습니다. 지출을 살펴보세요.", "이 시기에 결과가 좋아질 가능성을 생활 조건과 함께 검토해 보세요."]) {
    assert.doesNotThrow(() => validateReadingQuality({ ...reading(), money: safe }, context), safe);
  }
});

test("예언 부정은 허용하지만 반대 접속사의 확정 약속까지 면제하지 않는다", () => {
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), career: "반드시 성공하는 것은 아닙니다. 준비한 범위를 확인해 보세요." }, context));
  for (const text of ["성공을 보장하지 않습니다. 하지만 반드시 합격합니다.", "성공을 보장하지 않지만 그러나 반드시 합격합니다."]) {
    assert.throws(() => validateReadingQuality({ ...reading(), career: text }, context));
  }
});

test("모델 응답 스키마가 해당 계획의 규칙과 접두사 붙은 필수 근거만 제안한다", () => {
  const plan = context.fortune.interpretationPlan;
  const schema = createGeminiResponseSchema(context.timeline.periods.map(p => p.index), plan);
  for (const field of ["synthesis", "annual"]) {
    const item = schema.properties.interpretationBasis.properties[field] as unknown as { properties: { ruleId: { enum: string[] }; evidenceIds: { items: { enum: string[] }; maxItems: number } } };
    assert.deepEqual(item.properties.ruleId.enum, [plan.ruleId]);
    assert.deepEqual(new Set(item.properties.evidenceIds.items.enum), new Set(["annual_flow_parts", "annual_natal_season"]));
    assert.equal(item.properties.evidenceIds.maxItems, 2);
  }
  const bare = { ruleId: plan.ruleId, evidenceIds: ["flow_parts", "natal_season"] };
  assert.throws(() => validateInterpretationBasis({ synthesis: bare, annual: bare }, plan));
});

test("미성년의 현재 풀이는 직장·수입을 배움·생활 조언으로 바꾸고 성인 미래 구간은 유지한다", () => {
  const childInput = { ...input, date: "2018-03-12" };
  const childChart = calculate(childInput);
  const child = createGeminiReadingContext(childChart, calculateDaewoon(childInput, 0, 2026), calculateBenefactors(childChart), 2026);
  assert.equal(child.age, 9);
  for (const field of ["synthesis", "annual", "career", "money", "relationships"] as const) {
    assert.throws(() => validateReadingQuality({ ...reading(), [field]: "직장에서 수입을 늘리고 투자 조건을 점검해 보세요." }, child), field);
  }
  assert.throws(() => validateReadingQuality({ ...reading(), monthly: [{ month: 1, reading: "월급과 투자 범위를 살펴보세요." }] }, child));
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), money: "실제 투자를 권하지 않습니다. 용돈과 준비물을 함께 정리해 보세요." }, child));
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), career: "직장이 아닌 학교에서 배울 역할을 찾아보세요." }, child));
  for (const text of ["직장뿐 아니라 투자 수익도 늘려 보세요.", "직장이 아닌 학교에서 배우고 투자 수익도 늘려 보세요."]) {
    assert.throws(() => validateReadingQuality({ ...reading(), career: text }, child), text);
  }
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), lifetime: "성인이 되는 미래 구간에는 직장과 수입 관리를 살펴봅니다." }, child));
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), money: "수입과 투자 조건을 정리해 보세요." }, { ...child, age: 20 }));
});

test("대표적인 확정 예언은 여러 해석 필드에서 차단한다", () => {
  for (const field of ["money", "career", "annual"] as const) {
    assert.throws(() => validateReadingQuality({ ...reading(), [field]: "이 시기에는 반드시 성공합니다." }, context), field);
  }
});

test("기본 생조 판정과 반대인 단정을 차단하되 강약에 대한 부정문은 허용한다", () => {
  const strongContext = { ...context, analysis: { ...context.analysis, strength: { ...context.analysis.strength, score: 70, baseLabel: "신강 경향", sensitive: false, exceptional: false } } };
  assert.throws(() => validateReadingQuality({ ...reading(), overview: "당신은 신약한 사주입니다. 도움을 찾으세요." }, strongContext));
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), overview: "신약한 사주라고 단정하지 않습니다. 여러 조건을 함께 살펴보세요." }, strongContext));
});

test("연운과 대운 설명에서도 다른 시기의 간지를 붙이면 거부한다", () => {
  assert.throws(() => validateReadingQuality({ ...reading(), annual: "甲子 세운은 활동을 정리할 흐름입니다." }, context));
  assert.throws(() => validateReadingQuality({ ...reading(), annual: "세운은 甲子로 활동을 정리할 흐름입니다." }, context));
  assert.throws(() => validateReadingQuality({ ...reading(), annual: "세운: 갑자는 활동을 정리할 흐름입니다." }, context));
  assert.doesNotThrow(() => validateReadingQuality({ ...reading(), annual: "세운은 丙午로 작은 활동부터 확인해 보세요." }, context));
  const good = reading();
  const target = good.periodReadings.find(p => context.timeline.periods.find(t => t.index === p.index)?.ganji && context.timeline.periods.find(t => t.index === p.index)?.ganji !== "甲子")!;
  assert.ok(target);
  assert.throws(() => validateReadingQuality({ ...good, periodReadings: good.periodReadings.map(p => p.index === target.index ? { ...p, theme: "甲子 대운은 활동을 정리할 흐름입니다." } : p) }, context));
});
