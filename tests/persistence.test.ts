import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import {
  clearSavedSajuResult,
  readSavedSajuResult,
  writeSavedSajuResult,
  type SavedSajuResult,
} from "../lib/saju/persistence";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  get rawValues(): string[] {
    return [...this.values.values()];
  }

  replaceStoredValue(value: string): void {
    const key = this.values.keys().next().value ?? "test-key";
    this.values.set(key, value);
  }
}

const storage = (): Storage => new MemoryStorage() as unknown as Storage;
const input: SajuInput = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "general",
};

function makeResult(reading?: SavedSajuResult["reading"]): SavedSajuResult {
  const chart = calculate(input);
  const timeline = calculateDaewoon(input, 0, 2026);
  const benefactors = calculateBenefactors(chart);
  const periodReadings = timeline.periods.map((period) => ({
    index: period.index,
    theme: `대운 ${period.index}의 흐름`,
    strengths: "강점을 살펴봅니다.",
    cautions: "부담도 함께 확인합니다.",
    advice: "현실적인 계획을 세워보세요.",
    reflection: "실제 경험과 비교해보세요.",
  }));
  const completeReading = reading === undefined ? {
    overview: "사주와 오행의 균형을 함께 살펴본 전체 해석입니다.",
    elements: "오행의 구성과 관계를 설명합니다.",
    benefactors: "확인된 귀인과 판단 근거를 함께 설명합니다.",
    career: "진로의 강점과 부담을 현실적으로 살펴봅니다.",
    relationships: "관계의 가능성과 어려움을 함께 살펴봅니다.",
    money: "금전 결과를 단정하지 않고 현실적 점검을 권합니다.",
    caution: "미래 사건을 확정적으로 예언하지 않습니다.",
    periodReadings,
  } : reading;

  return {
    version: 1,
    savedAt: "2026-09-23T05:00:00.000Z",
    input,
    yunGender: 0,
    chart,
    timeline,
    benefactors,
    reading: completeReading,
  };
}

test("계산 결과와 해석을 버전 포함 저장하고 다시 읽는다", () => {
  const target = storage();
  const value = makeResult();

  assert.equal(writeSavedSajuResult(value, target), true);
  assert.deepEqual(readSavedSajuResult(target), JSON.parse(JSON.stringify(value)));
  assert.ok(target.rawValues.length > 0);
  assert.equal(JSON.parse(target.rawValues[0]).version, 1);
});

test("해석 생성 전에는 계산 결과를 reading null로 저장하고 복원한다", () => {
  const target = storage();
  const value = makeResult(null);

  assert.equal(writeSavedSajuResult(value, target), true);
  assert.equal(readSavedSajuResult(target)?.reading, null);
  assert.deepEqual(readSavedSajuResult(target)?.input, input);
});

test("저장 항목이 없거나 손상된 JSON이면 앱을 중단하지 않고 null을 돌려준다", () => {
  const target = storage();
  assert.equal(readSavedSajuResult(target), null);
  assert.equal(writeSavedSajuResult(makeResult(), target), true);
  const key = target.rawValues[0];
  const parsed = JSON.parse(key);
  (target as unknown as MemoryStorage).replaceStoredValue("{");
  assert.equal(readSavedSajuResult(target), null);
  (target as unknown as MemoryStorage).replaceStoredValue(JSON.stringify({ ...parsed, version: 999 }));
  assert.equal(readSavedSajuResult(target), null);
});

test("저장 결과의 필수 계산 자료와 대운 인덱스에 맞지 않는 해석을 거부한다", () => {
  const target = storage();
  const value = makeResult();
  assert.equal(writeSavedSajuResult(value, target), true);
  const raw = target.rawValues[0];
  const parsed = JSON.parse(raw);
  parsed.chart = null;
  (target as unknown as MemoryStorage).replaceStoredValue(JSON.stringify(parsed));
  assert.equal(readSavedSajuResult(target), null);

  const withMismatchedReading = makeResult();
  const encoded = JSON.stringify({
    ...withMismatchedReading,
    reading: {
      ...withMismatchedReading.reading,
      periodReadings: withMismatchedReading.reading!.periodReadings.slice(1),
    },
  });
  (target as unknown as MemoryStorage).replaceStoredValue(encoded);
  assert.equal(readSavedSajuResult(target), null);
});

test("사용자가 저장 결과를 삭제할 수 있다", () => {
  const target = storage();
  assert.equal(writeSavedSajuResult(makeResult(), target), true);
  assert.equal(clearSavedSajuResult(target), true);
  assert.equal(readSavedSajuResult(target), null);
});

test("저장소 예외를 호출부로 전파하지 않고 작업 실패로 돌려준다", () => {
  const broken = {
    getItem() { throw new Error("unavailable"); },
    setItem() { throw new Error("quota exceeded"); },
    removeItem() { throw new Error("unavailable"); },
  } as unknown as Storage;

  assert.equal(readSavedSajuResult(broken), null);
  assert.equal(writeSavedSajuResult(makeResult(), broken), false);
  assert.equal(clearSavedSajuResult(broken), false);
});

test("출생 연도 안에 대운이 시작되어 0번 구간이 없는 정상 결과도 복원한다", () => {
  const target = storage();
  const birth: SajuInput = { date: "2000-02-04", time: "08:37", calendar: "solar", topic: "general" };
  const chart = calculate(birth);
  const result: SavedSajuResult = {
    version: 1,
    savedAt: "2026-09-23T05:00:00.000Z",
    input: birth,
    yunGender: 0,
    chart,
    timeline: calculateDaewoon(birth, 0, 2026),
    benefactors: calculateBenefactors(chart),
    reading: null,
  };
  assert.equal(result.timeline.periods[0].index, 1);
  assert.equal(writeSavedSajuResult(result, target), true);
  assert.deepEqual(readSavedSajuResult(target), JSON.parse(JSON.stringify(result)));
});
