import test from "node:test";
import assert from "node:assert/strict";
import { validateGeminiSajuReading } from "../lib/saju/gemini-reading";

const validReading = {
  overview: "사주 구성과 오행의 균형을 함께 살펴본 전체 해석입니다.",
  elements: "다섯 오행의 분포와 서로의 관계를 참고해 설명합니다.",
  benefactors: "확인된 귀인과 그 근거를 함께 읽되 결과를 단정하지 않습니다.",
  career: "진로에서는 강점과 감당할 부담을 함께 점검할 수 있습니다.",
  relationships: "관계에서는 실제 경험과 상대와의 대화를 함께 살펴보세요.",
  money: "금전 결과를 예언하지 않고 수입과 지출을 현실적으로 점검합니다.",
  caution: "이 해석은 참고 자료이며 미래 사건을 확정하지 않습니다.",
  periodReadings: [
    {
      index: 0,
      theme: "기반을 다지는 시기",
      strengths: "꾸준히 익힌 기술이 도움이 될 수 있습니다.",
      cautions: "책임을 혼자 떠안지 않는지 살펴보세요.",
      advice: "할 일을 작은 단위로 나누어 우선순위를 정하세요.",
      reflection: "이 시기에 실제로 맡았던 역할은 무엇이었나요?",
    },
    {
      index: 1,
      theme: "방향을 조정하는 시기",
      strengths: "새로운 선택지를 탐색하기 좋습니다.",
      cautions: "기대만으로 큰 결정을 서두르지 마세요.",
      advice: "가능성을 비교하고 준비 계획을 세워보세요.",
      reflection: "어떤 준비가 다음 선택에 도움이 될까요?",
    },
  ],
};

test("유효한 해석을 필수 항목과 함께 반환한다", () => {
  const result = validateGeminiSajuReading(validReading, [0, 1]);

  assert.deepEqual(result, validReading);
  for (const key of [
    "overview", "elements", "benefactors", "career", "relationships", "money", "caution",
  ] as const) {
    assert.equal(typeof result[key], "string");
    assert.ok(result[key].trim().length > 0);
  }
});

test("대운 인덱스가 기대한 순서와 다르면 거부한다", () => {
  const reordered = {
    ...validReading,
    periodReadings: [...validReading.periodReadings].reverse(),
  };

  assert.throws(() => validateGeminiSajuReading(reordered, [0, 1]));
});

test("대운 해석의 누락·중복·추가 인덱스를 거부한다", () => {
  const missing = { ...validReading, periodReadings: validReading.periodReadings.slice(0, 1) };
  const duplicate = {
    ...validReading,
    periodReadings: [validReading.periodReadings[0], { ...validReading.periodReadings[1], index: 0 }],
  };
  const extra = {
    ...validReading,
    periodReadings: [...validReading.periodReadings, { ...validReading.periodReadings[1], index: 2 }],
  };

  assert.throws(() => validateGeminiSajuReading(missing, [0, 1]));
  assert.throws(() => validateGeminiSajuReading(duplicate, [0, 1]));
  assert.throws(() => validateGeminiSajuReading(extra, [0, 1]));
});

test("객체가 아니거나 필수 문구와 대운 필드가 잘못되면 거부한다", () => {
  assert.throws(() => validateGeminiSajuReading(null, [0, 1]));
  assert.throws(() => validateGeminiSajuReading({ ...validReading, overview: "   " }, [0, 1]));
  assert.throws(() => validateGeminiSajuReading({ ...validReading, money: 12 }, [0, 1]));
  assert.throws(() => validateGeminiSajuReading({ ...validReading, periodReadings: [{ index: 0 }] }, [0]));
});
