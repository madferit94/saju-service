import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext } from "../lib/saju/gemini-reading";
import { CHAPTERS, consultationFacts, consultationPrompt, consultationSchema, validateChapter, validateConsultation, type ChapterId, type Consultation, type ConsultationChapter } from "../lib/saju/consultation";
import { isSavedSajuResult, readSavedSajuResult, writeSavedSajuResult, type SavedSajuResult } from "../lib/saju/persistence";
import { resultFingerprint, validateCloudPayload, type CloudPayload } from "../lib/account/results";

const input: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general", question: "외부 전송하지 않을 내 개인 질문", birthplace: { countryCode: "KR", countryName: "대한민국", city: "비공개 도시명", province: "수도권", timezone: "Asia/Seoul", longitude: 126.978 } };
const chart = calculate(input);
const timeline = calculateDaewoon(input, 0, 2026);
const benefactors = calculateBenefactors(chart);
const context = createGeminiReadingContext(chart, timeline, benefactors, 2026);
const validIds = consultationFacts(context).map(fact => fact.id);
function chapter(id: ChapterId = "natal"): ConsultationChapter {
  return {
    id, title: CHAPTERS.find(def => def.id === id)!.title,
    sections: Array.from({ length: 3 }, (_, i) => ({
      heading: `구체적인 근거 ${i + 1}`,
      text: `${i + 1}번째 주제에서는 계산된 월지와 일간의 관계를 살피고, 도움을 받는 조건과 부담이 커지는 상황을 함께 비교합니다. `.repeat(4),
      evidenceIds: ["strength_season", "strength_ratio"],
      counterpoint: "같은 계산에서도 월지의 비중을 달리하면 강약의 경계가 달라질 수 있으므로 실제 환경을 함께 확인합니다.",
      example: "예를 들어 함께 맡은 일의 책임을 나누는 상황이라면 본인이 결정할 수 있는 범위를 먼저 확인할 수 있습니다.",
      question: "도움을 받는 상황과 혼자 책임지는 상황에서 어떤 차이를 경험하셨나요?",
      action: "다음 한 주 동안 맡은 일과 결정 권한을 기록하고, 부담이 반복되는 지점을 구체적으로 비교해 보세요.",
    })),
  };
}
function consultation(chapters: ConsultationChapter[] = [chapter()]): Consultation { return { version: 1, analysisVersion: 1, year: 2026, chapters }; }
function saved(extra: Partial<SavedSajuResult> = {}): SavedSajuResult {
  return { version: 1, savedAt: "2026-09-23T05:00:00Z", input, yunGender: 0, chart, timeline, benefactors, reading: null, ...extra };
}
function memory(): Storage {
  const items = new Map<string, string>();
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => { items.set(key, value); }, removeItem: key => { items.delete(key); } } as Storage;
}

test("상담 한 장은 세부 설명·반대 조건·예시·질문·실천과 실제 근거 두 개를 함께 가진다", () => {
  const value = chapter();
  assert.equal(validateChapter(value, "natal", validIds), value);
  const four = { ...value, sections: [...value.sections, { ...value.sections[0], text: value.sections[0].text + "추가된 별도 관점입니다." }] };
  assert.equal(validateChapter(four, "natal", validIds), four);
  assert.equal(CHAPTERS.length, 8);
  assert.equal(new Set(CHAPTERS.map(def => def.id)).size, 8);
});

test("짧거나 빈 본문·필수항목 누락·중복 문단·잘못된 장 제목은 차단한다", () => {
  const value = chapter();
  for (const key of ["heading", "text", "counterpoint", "example", "question", "action"] as const) {
    const sections = structuredClone(value.sections);
    sections[0][key] = " ";
    assert.throws(() => validateChapter({ ...value, sections }, "natal", validIds), key);
  }
  for (const count of [0, 1, 2, 5]) assert.throws(() => validateChapter({ ...value, sections: Array.from({ length: count }, (_, i) => ({ ...value.sections[0], text: value.sections[0].text + i })) }, "natal", validIds));
  assert.throws(() => validateChapter({ ...value, sections: [value.sections[0], value.sections[0], value.sections[1]] }, "natal", validIds));
  assert.throws(() => validateChapter({ ...value, title: "임의 제목" }, "natal", validIds));
  assert.throws(() => validateChapter(value, "money", validIds));
  assert.throws(() => validateChapter({ ...value, sections: [null, ...value.sections.slice(1)] }, "natal", validIds));
  assert.throws(() => validateChapter({ ...value, sections: [{ ...value.sections[0], text: "긴".repeat(2201) }, ...value.sections.slice(1)] }, "natal", validIds));
});

test("그럴듯한 가짜 근거·중복 근거·한 개 근거·너무 많은 근거를 거부한다", () => {
  const value = chapter();
  for (const evidenceIds of [[], ["strength_season"], ["strength_season", "strength_season"], ["strength_season", "invented_yongsin"], ["strength_season", "__proto__"], validIds.slice(0, 7), ["strength_season", 10]]) {
    assert.throws(() => validateChapter({ ...value, sections: [{ ...value.sections[0], evidenceIds }, ...value.sections.slice(1)] }, "natal", validIds));
  }
});

test("부분 상담과 완성된 여덟 장을 보존하며 중복·역순·미지 장·잘못된 버전은 차단한다", () => {
  for (const chapters of [[], [chapter()], [chapter("natal"), chapter("money")], CHAPTERS.map(def => chapter(def.id))]) {
    const value = consultation(chapters);
    assert.equal(validateConsultation(value, validIds), value);
  }
  for (const chapters of [[chapter(), chapter()], [chapter("money"), chapter()], [{ ...chapter(), id: "unknown" }], Array.from({ length: 9 }, () => chapter())]) {
    assert.throws(() => validateConsultation({ ...consultation(), chapters }, validIds));
  }
  for (const invalid of [{ version: 2 }, { analysisVersion: 2 }, { year: 1989 }, { year: 2101 }, { year: 2026.5 }, { year: "2026" }, { chapters: null }]) assert.throws(() => validateConsultation({ ...consultation(), ...invalid }, validIds));
});

test("인용 자료는 심층 판정·원국·귀인·대운·세운·열두 월을 고유 ID로 제공한다", () => {
  assert.equal(new Set(validIds).size, validIds.length);
  for (const id of ["strength_ratio", "pattern_month", "useful_balance", "useful_climate", "pillar_0", "pillar_3", "benefactor_0", "annual", "month_1", "month_12"]) assert.ok(validIds.includes(id), id);
  for (const period of timeline.periods) assert.ok(validIds.includes(`period_${period.index}`));
  assert.equal(consultationFacts(context).filter(fact => fact.id.startsWith("month_")).length, 12);
});

test("상담 프롬프트는 개인 입력을 보내지 않고 판정 보류·독음·미성년·가정예시 기준을 전달한다", () => {
  for (const def of CHAPTERS) {
    const prompt = consultationPrompt(context, def.id);
    assert.ok(prompt.includes(def.focus));
    for (const secret of [input.date, input.time, input.question!, input.birthplace!.city, input.birthplace!.timezone, String(input.birthplace!.longitude)]) assert.ok(!prompt.includes(secret), secret);
    for (const phrase of ["사칭하지", "판정 보류", "한글 독음", "미성년", "가정 장면", "성공확률이 아닙니다"]) assert.ok(prompt.includes(phrase), phrase);
    const schema = consultationSchema(def.id);
    assert.deepEqual(schema.properties.id.enum, [def.id]);
    assert.deepEqual(schema.properties.title.enum, [def.title]);
    assert.deepEqual(schema.properties.sections.items.required, ["heading", "text", "evidenceIds", "counterpoint", "example", "question", "action"]);
  }
});

test("과거 저장본을 유지하고 부분 상담을 로컬·계정 형식에 손실 없이 보존한다", async () => {
  const target = memory();
  const legacy = saved();
  assert.equal(writeSavedSajuResult(legacy, target), true);
  assert.equal(readSavedSajuResult(target)?.consultation, undefined);
  const enriched = saved({ consultation: consultation([chapter(), chapter("strength")]) });
  assert.equal(writeSavedSajuResult(enriched, target), true);
  assert.deepEqual(readSavedSajuResult(target), JSON.parse(JSON.stringify(enriched)));
  const payload: CloudPayload = { version: 1, fortuneYear: 2027, result: enriched };
  assert.equal(validateCloudPayload(payload), payload); // A selected year may differ from saved interpretation year.
  const hash = await resultFingerprint(payload, "상담 기록");
  assert.notEqual(hash, await resultFingerprint({ ...payload, result: legacy }, "상담 기록"));
});

test("기존 reading이 null이어도 손상된 상담은 로컬 저장 검증에서 빠져나가지 않는다", () => {
  const value = saved({ consultation: consultation() });
  const invalid = [
    { ...value, consultation: { ...value.consultation, analysisVersion: 999 } },
    { ...value, consultation: { ...value.consultation, chapters: [chapter(), chapter()] } },
    { ...value, consultation: { ...value.consultation, chapters: [{ ...chapter(), sections: [] }] } },
  ];
  for (const entry of invalid) {
    assert.equal(isSavedSajuResult(entry), false);
    assert.equal(writeSavedSajuResult(entry as SavedSajuResult, memory()), false);
  }
});
