import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext, createGeminiReadingPrompt } from "../lib/saju/gemini-reading";
import { consultationPrompt } from "../lib/saju/consultation";
import { SAJU_READING_FOUNDATION } from "../lib/saju/reading-prompt";

const virtualInput: SajuInput = {
  date: "1994-06-14",
  time: "03:27",
  calendar: "solar",
  topic: "general",
  question: "가상 질문-외부전송금지-7741",
  birthplace: {
    countryCode: "KR",
    countryName: "대한민국",
    city: "가상도시-외부전송금지-5829",
    province: "가상도",
    timezone: "America/Los_Angeles",
    longitude: 127.123456,
  },
};

function prompts() {
  const chart = calculate(virtualInput);
  const timeline = calculateDaewoon(virtualInput, 0, 2026);
  const context = createGeminiReadingContext(chart, timeline, calculateBenefactors(chart), 2026);
  return [
    createGeminiReadingPrompt(context),
    consultationPrompt(context, "natal"),
  ];
}

test("공유 기본 프롬프트는 CO-STAR 여섯 항목과 개인별 해석 원칙을 담는다", () => {
  for (const label of ["맥락 Context", "목표 Objective", "문체 Style", "말투 Tone", "독자 Audience", "응답 Response"]) {
    assert.ok(SAJU_READING_FOUNDATION.includes(label), `공유 기준에 ${label} 항목이 있어야 함`);
  }

  for (const phrase of [
    "개인별 근거",
    "최소 두 근거",
    "강점과 부담",
    "달라질 조건",
    "생활에서 어떤 선택",
    "쉬운 뜻",
    "한글 독음",
    "설명 방식만 보여",
    "그대로",
    "실제 인간 경력을 사칭하지",
  ]) {
    assert.ok(SAJU_READING_FOUNDATION.includes(phrase), `공유 기준에 '${phrase}' 원칙이 있어야 함`);
  }
});

test("종합 해석과 장별 상담은 같은 기본 기준을 포함하고 출생 입력·질문은 보내지 않는다", () => {
  const outputPrompts = prompts();
  const required = [
    "[맥락 Context]",
    "[목표 Objective]",
    "[문체 Style]",
    "[말투 Tone]",
    "[독자 Audience]",
    "[응답 Response]",
    "최소 두 근거",
    "강점과 부담",
    "달라질 조건",
    "한글 독음",
    "실제 인간 경력을 사칭하지",
    "예시는 설명 방식만 보여 줍니다",
    "그대로 복사하지",
  ];

  for (const prompt of outputPrompts) {
    for (const phrase of required) {
      assert.ok(prompt.includes(phrase), `생성 프롬프트에 '${phrase}'가 있어야 함`);
    }
    for (const privateValue of [
      virtualInput.date,
      virtualInput.time,
      virtualInput.question!,
      virtualInput.birthplace!.city,
      virtualInput.birthplace!.province,
      virtualInput.birthplace!.timezone,
      String(virtualInput.birthplace!.longitude),
    ]) {
      assert.ok(!prompt.includes(privateValue), `생성 프롬프트에 가상 입력 '${privateValue}'를 포함하면 안 됨`);
    }
  }
});
