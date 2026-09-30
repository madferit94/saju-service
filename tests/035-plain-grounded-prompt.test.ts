import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext, createGeminiReadingPrompt } from "../lib/saju/gemini-reading";

const input: SajuInput = {
  date: "1994-06-14", time: "03:27", calendar: "solar", topic: "general",
  question: "가상 개인 질문 035",
  birthplace: {
    countryCode: "KR", countryName: "대한민국", city: "가상도시035", province: "가상도035",
    timezone: "America/Los_Angeles", longitude: 127.123456,
  },
};

function fixture() {
  const chart = calculate(input);
  const context = createGeminiReadingContext(chart, calculateDaewoon(input, 0, 2026), calculateBenefactors(chart), 2026);
  return { context, prompt: createGeminiReadingPrompt(context) };
}

test("쉬운 종합 해석은 글쓰기·시기·형식을 계산 자료와 분리해 지시한다", () => {
  const { context, prompt } = fixture();
  for (const tag of ["역할", "반드시 지킬 규칙", "글쓰기", "정확한 시기", "항목별 과제", "대운별 항목", "응답 형식", "계산 자료", "이번 과제"]) {
    assert.ok(prompt.includes(`<${tag}>`) && prompt.includes(`</${tag}>`), `${tag} 구획 필요`);
  }
  assert.ok(prompt.indexOf("<글쓰기>") < prompt.indexOf("<계산 자료>"));
  assert.ok(prompt.indexOf("</계산 자료>") < prompt.indexOf("<이번 과제>"));
  assert.ok(prompt.includes(JSON.stringify(context)));
  assert.match(prompt, /첫 두 문장에는 한자, 간지, 십성·지장간·용신 같은 사주 용어를 넣지 마세요/);
  assert.match(prompt, /생활에서 나타날 수 있는 모습을 쉬운 존댓말로 두 문장/);
  assert.match(prompt, /실제 계산 근거/);
  assert.match(prompt, /장점과 부담이 갈리는 조건/);
  assert.match(prompt, /같은 조언을 반복하지 마세요/);
});

test("생성 프롬프트는 원국·대운·세운·월운의 층위와 필수 응답을 지킨다", () => {
  const { context, prompt } = fixture();
  for (const phrase of [
    "원국은 타고난 바탕", "대운은 긴 시기", "세운은 선택한 해", "월운은 해당 달",
    "lifetime에는 '초년', '청년', '중년', '후반' 네 구간",
    "각 월의 ganji=월운, annualGanji=세운, daewoonGanji=대운",
    "1월 입춘 전에는 전년도 세운",
    "1~12월을 순서대로", "periodReadings", "readingVersion=2", "fortuneYear=fortune.year",
    "19세 이하에는 성인의 직장·투자·계약 조언을 쓰지 마세요",
  ]) {
    assert.ok(prompt.includes(phrase), `${phrase} 지시 필요`);
  }
  assert.ok(prompt.includes(JSON.stringify(context.timeline.periods.map((period) => period.index))));
  assert.ok(prompt.includes(`${context.timeline.periods.length}개 대운 항목`));
  assert.match(prompt, /JSON만 출력하세요/);
});

test("생성 프롬프트는 원래 출생 입력과 질문을 제외하고 예언을 제한한다", () => {
  const { prompt } = fixture();
  for (const privateValue of [input.date, input.time, input.question!, input.birthplace!.city, input.birthplace!.province, input.birthplace!.timezone, String(input.birthplace!.longitude)]) {
    assert.ok(!prompt.includes(privateValue), `${privateValue} 제외 필요`);
  }
  for (const phrase of ["새로 계산하거나 없는 개인 사건", "미래 결과를 만들지", "합을 무조건 좋은 일", "충을 사고·이별로 단정하지", "건강 진단", "혼인·임신·합격·수익을 예언하지"]) {
    assert.ok(prompt.includes(phrase), `${phrase} 제한 필요`);
  }
});
