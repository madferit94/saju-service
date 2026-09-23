import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext } from "../lib/saju/gemini-reading";
import { CHAPTERS, READING_STYLE_VERSION, consultationFacts, consultationPrompt, consultationSchema, validateChapter, validatePlainChapter, validateSeasonedChapter, validateConsultation, type ChapterId, type Consultation, type ConsultationChapter } from "../lib/saju/consultation";
import { isSavedSajuResult, readSavedSajuResult, writeSavedSajuResult, type SavedSajuResult } from "../lib/saju/persistence";
import { resultFingerprint, validateCloudPayload, type CloudPayload } from "../lib/account/results";
import { buildLifeSeasons } from "../lib/saju/life-seasons";

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
function plainChapter(id: ChapterId = "natal"): ConsultationChapter {
  const value = chapter(id);
  return { ...value, summary: "자신이 결정할 일과 다른 사람에게 도움받을 일을 나누면, 어떤 환경이 맞는지 비교하기 쉽습니다.", sections: value.sections.map(section => ({
    ...section,
    text: "다른 사람에게 도움을 받더라도 자신이 결정할 수 있는 일이 남아 있어야 편할 수 있습니다.\n\n" + section.text + "이 판단은 정해진 성격을 뜻하는 것이 아닙니다. 앞서 살펴본 서로 다른 조건을 실제로 경험한 사례와 나란히 적어보고, 어느 상황에서 자신의 권한과 지원이 충분했는지 구분해 보세요.",
  })) };
}
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

test("새 상담은 경력 사칭 없이 쉬운 생활말과 불편한 조건을 요청한다", () => {
  assert.equal(READING_STYLE_VERSION, 3);
  const prompt = consultationPrompt(context, "lifetime");
  for (const phrase of ["30년", "사칭", "쉬운", "반대", "부담", "실제 경험", "현재", "계절"]) {
    assert.ok(prompt.includes(phrase), phrase);
  }
  assert.ok(!prompt.includes(input.date));
  assert.ok(!prompt.includes(input.birthplace!.city));
});

test("평생 상담에는 개인 대운 4계절과 현재 지점을 동일한 계산으로 전달한다", () => {
  const report = buildLifeSeasons(chart, timeline);
  const prompt = consultationPrompt(context, "lifetime", report);
  assert.ok(report.current);
  assert.ok(prompt.includes(report.current.seasonLabel));
  assert.ok(prompt.includes(String(report.current.currentYear)));
  assert.ok(prompt.includes(String(report.current.periodIndex)));
  assert.ok(prompt.includes(report.periods.find(period => period.index === report.current!.periodIndex)!.ganji));
  assert.ok(!prompt.includes(input.date));
  assert.ok(!prompt.includes(input.birthplace!.city));
});

test("새 평생 상담은 현재 대운과 그 사람의 계절을 실제 본문에 짚어야 한다", () => {
  const seasons = buildLifeSeasons(chart, timeline);
  const active = seasons.periods.find(period => period.index === seasons.current!.periodIndex)!;
  const activePosition = seasons.periods.findIndex(period => period.index === active.index);
  const other = seasons.periods.slice(Math.max(0, activePosition - 1), activePosition + 2).find(period => period.seasonLabel !== active.seasonLabel);
  const base = plainChapter("lifetime");
  const grounded = {
    ...base,
    summary: `${active.startYear}년부터 ${active.endYear}년까지는 ${active.seasonLabel}의 주제가 앞에 옵니다. 익힌 방법을 실제 생활에 맞춰 보고 맡을 일의 범위를 확인해 보세요.`,
    sections: base.sections.map((section, index) => index === 0 ? {
      ...section,
      text: section.text + `\n\n현재 ${timeline.currentYear}년은 ${active.startYear}~${active.endYear}년 ${active.korean} 대운 안에 있습니다. 이 대운의 주제는 ${active.seasonLabel}이며, ${other ? `${other.seasonLabel}의 주제였던 이웃 대운과 비교해` : "실제 경험과 비교해"} 배움과 실행의 순서가 실제 생활에서 어떻게 달라지는지 확인합니다.`,
      evidenceIds: [...section.evidenceIds, `period_${active.index}`],
    } : section),
  };
  assert.equal(validateSeasonedChapter(grounded, "lifetime", validIds, seasons), grounded);
  assert.throws(() => validateSeasonedChapter(base, "lifetime", validIds, seasons), /계절|현재|대운/);
  assert.throws(() => validateSeasonedChapter({ ...grounded, summary: "이 장에서는 삶의 흐름과 현재 시기에 맞는 선택의 조건을 차분하게 살펴봅니다." }, "lifetime", validIds, seasons), /요약|구체|생활|계절/);
  const otherSeason = ["봄", "여름", "가을", "겨울"].find(label => label !== active.seasonLabel)!;
  const wrong = { ...grounded, summary: grounded.summary.replace(active.seasonLabel, otherSeason), sections: grounded.sections.map(section => ({ ...section, text: section.text.replaceAll(active.seasonLabel, otherSeason) })) };
  assert.throws(() => validateSeasonedChapter(wrong, "lifetime", validIds, seasons), /계절|현재|대운/);
  const contradictory = { ...grounded, sections: grounded.sections.map((section, index) => index === 0 ? { ...section, text: section.text + `\n\n현재 계절은 ${otherSeason}.` } : section) };
  assert.throws(() => validateSeasonedChapter(contradictory, "lifetime", validIds, seasons), /다르게|계절/);

  const storage = memory();
  const completeV3: Consultation = { ...consultation(), readingStyleVersion: 3, chapters: [grounded] };
  assert.equal(writeSavedSajuResult(saved({ consultation: completeV3 }), storage), true);
  assert.deepEqual(readSavedSajuResult(storage)?.consultation, completeV3);
  const missingSeasonV3: Consultation = { ...completeV3, chapters: [base] };
  assert.equal(writeSavedSajuResult(saved({ consultation: missingSeasonV3 }), storage), false);
  assert.deepEqual(readSavedSajuResult(storage)?.consultation, completeV3, "손상된 새 상담이 정상 저장본을 덮지 않는다");
});

test("기존 문체 2 평생 장은 새 계절 표기가 없어도 저장해 다시 읽을 수 있다", () => {
  const old: Consultation = { ...consultation(), readingStyleVersion: 2, chapters: [plainChapter("lifetime")] };
  assert.equal(validateConsultation(old, validIds), old);
  const value = saved({ consultation: old });
  const target = memory();
  assert.equal(writeSavedSajuResult(value, target), true);
  assert.deepEqual(readSavedSajuResult(target)?.consultation, old);
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

test("쉬운 상담 장은 충분한 요약과 기존 상세 근거를 모두 갖춰야 한다", () => {
  for (const length of [30, 180]) {
    const value = { ...plainChapter(), summary: "가".repeat(length) };
    assert.equal(validatePlainChapter(value, "natal", validIds), value);
  }
  for (const summary of [undefined, null, 42, "", " ".repeat(40), "가".repeat(29), "가".repeat(181)]) {
    assert.throws(() => validatePlainChapter({ ...plainChapter(), summary }, "natal", validIds));
  }
  const readable = plainChapter();
  assert.throws(() => validatePlainChapter({ ...readable, sections: [] }, "natal", validIds));
  assert.throws(() => validatePlainChapter({ ...readable, sections: [{ ...readable.sections[0], evidenceIds: ["invented_a", "invented_b"] }, ...readable.sections.slice(1)] }, "natal", validIds));
});

test("기존 1·2 문체와 새 3 문체를 모두 읽되 잘못된 문체를 거부한다", () => {
  const legacy = consultation([chapter(), chapter("strength")]);
  assert.equal(validateConsultation(legacy, validIds), legacy);
  const readableV2 = { ...legacy, readingStyleVersion: 2 as const, chapters: legacy.chapters.map(ch => plainChapter(ch.id)) };
  assert.equal(validateConsultation(readableV2, validIds), readableV2);
  const readableV3 = { ...readableV2, readingStyleVersion: 3 as const };
  assert.equal(validateConsultation(readableV3, validIds), readableV3);
  assert.throws(() => validateConsultation({ ...legacy, readingStyleVersion: 2 }, validIds));
  assert.throws(() => validateConsultation({ ...legacy, readingStyleVersion: 3 }, validIds));
  for (const readingStyleVersion of [0, 1, 4, "3", null]) assert.throws(() => validateConsultation({ ...readableV3, readingStyleVersion }, validIds));
});

test("새 상담의 요약과 버전은 로컬·계정 저장에서 보존하고 손상된 요약은 저장하지 않는다", async () => {
  const target = memory();
  const readable: Consultation = { ...consultation(), readingStyleVersion: 3, chapters: [plainChapter()] };
  const value = saved({ consultation: readable });
  assert.equal(writeSavedSajuResult(value, target), true);
  assert.deepEqual(readSavedSajuResult(target)?.consultation, readable);
  const cloud: CloudPayload = { version: 1, fortuneYear: 2026, result: value };
  assert.equal(validateCloudPayload(cloud), cloud);
  const legacy = { ...cloud, result: saved({ consultation: consultation() }) };
  assert.notEqual(await resultFingerprint(cloud, "가상 상담"), await resultFingerprint(legacy, "가상 상담"));
  const broken = saved({ consultation: { ...readable, chapters: [chapter()] } });
  assert.equal(isSavedSajuResult(broken), false);
  assert.equal(writeSavedSajuResult(broken, target), false);
  assert.deepEqual(readSavedSajuResult(target)?.consultation, readable);
});

test("쉬운 상담은 280자와 두 문단을 함께 요구하고 예전 160자 한 문단은 계속 복원한다", () => {
  const readable = plainChapter();
  const withText = (text: string) => ({ ...readable, sections: [{ ...readable.sections[0], text }, ...readable.sections.slice(1)] });
  assert.throws(() => validatePlainChapter(withText("가".repeat(138) + "\n\n" + "나".repeat(139)), "natal", validIds), "279자는 두 문단이어도 거부");
  assert.throws(() => validatePlainChapter(withText("가".repeat(400)), "natal", validIds), "충분히 길어도 한 문단이면 거부");
  assert.throws(() => validatePlainChapter(withText("가".repeat(280) + "\n\n   "), "natal", validIds), "빈 문단은 세지 않음");
  const boundary = withText("가".repeat(139) + "\n\n" + "나".repeat(139));
  assert.equal(validatePlainChapter(boundary, "natal", validIds), boundary);
  const legacy = withText("가".repeat(160));
  delete legacy.summary;
  assert.equal(validateChapter(legacy, "natal", validIds), legacy);
  const result = saved({ consultation: consultation([legacy]) });
  assert.equal(isSavedSajuResult(result), true);
  const storage = memory();
  assert.equal(writeSavedSajuResult(result, storage), true);
  assert.equal(readSavedSajuResult(storage)?.consultation?.chapters[0].sections[0].text.length, 160);
});

test("새 상담 요약과 첫 문장은 쉬운 생활말을 요구하되 이후 설명의 명리 근거와 이전 상담은 허용한다", () => {
  const value = plainChapter();
  for (const summary of [
    "일간과 월지를 바탕으로 자신에게 잘 맞는 환경을 정하고 주변 도움을 받을 기준을 세워보세요.",
    "甲과 木의 관계를 바탕으로 자신에게 잘 맞는 환경을 정하고 주변 도움을 받을 기준을 세워보세요.",
    "자신의 에너지가 약해지지 않도록 맡은 일을 나누고 다른 사람에게 도움받을 기준을 세워보세요.",
  ]) assert.throws(() => validatePlainChapter({ ...value, summary }, "natal", validIds), summary);
  for (const summary of [
    "도움을 받을 때도 결정할 권한이 남아 있어야 편할 수 있어, 누가 어떤 일을 맡는지 먼저 살펴봅니다.",
    "다른 사람에게 맡길 일과 직접 결정할 일을 나누면, 불필요한 책임이 늘어나는 일을 줄이며 부담을 다룹니다.",
    "함께 일할 때도 자신의 선택을 지지받는 조건이 중요해, 도움을 받았던 때와 혼자 맡았던 때를 비교합니다.",
    "책임을 나눌 때 결정할 권한까지 넘기면 답답할 수 있어, 역할을 정하기 전에 합의할 조건을 확인합니다.",
  ]) {
    const readable = { ...value, summary };
    assert.equal(validatePlainChapter(readable, "natal", validIds), readable, "생활 요약을 문장 끝 동사만으로 거부하지 않는다");
  }
  for (const opening of ["일간과 월지가 영향을 줍니다.", "용신을 고려해야 합니다.", "甲이 중심입니다."]) {
    const sections = [{ ...value.sections[0], text: opening + "\n\n" + value.sections[0].text }, ...value.sections.slice(1)];
    assert.throws(() => validatePlainChapter({ ...value, sections }, "natal", validIds), opening);
    const legacy = { ...chapter(), sections };
    assert.equal(validateChapter(legacy, "natal", validIds), legacy);
  }
  assert.ok(value.sections[0].text.includes("월지"), "전문 근거는 두 번째 문단에 유지");
  assert.equal(validatePlainChapter(value, "natal", validIds), value);
  const legacySummary = { ...chapter(), summary: "일간과 월지를 바탕으로 하는 에너지 흐름과 주변 도움의 조건을 살펴봅니다." };
  assert.equal(validateChapter(legacySummary, "natal", validIds), legacySummary);
  assert.equal(isSavedSajuResult(saved({ consultation: consultation([legacySummary]) })), true);
});
