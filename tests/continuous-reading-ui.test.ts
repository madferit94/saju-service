import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConsultationPanel from "../app/consultation-panel";
import FortunePanel from "../app/fortune-panel";
import { CHAPTERS, type Consultation, type ConsultationChapter } from "../lib/saju/consultation";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildFortuneReport } from "../lib/saju/fortune";
import type { GeminiSajuReading } from "../lib/saju/gemini-reading";

const birth: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };

function chapter(index: number): ConsultationChapter {
  const def = CHAPTERS[index];
  return { id: def.id, title: def.title, summary: `주제 ${index + 1} 요약`, sections: [{
    heading: `주제 ${index + 1}의 실제 이야기`, text: `첫 문단 ${index + 1}\n\n둘째 문단 ${index + 1}`,
    evidenceIds: ["sample"], counterpoint: "다른 가능성", example: "생활 예시", question: "돌아볼 질문", action: "해볼 일",
  }] };
}

test("완성된 상담 주제는 시작 버튼이나 접힌 장 없이 연속 본문으로 보인다", () => {
  const consultation: Consultation = { version: 1, analysisVersion: 1, readingStyleVersion: 3, year: 2026, chapters: [chapter(0), chapter(1)] };
  const html = renderToStaticMarkup(createElement(ConsultationPanel, { consultation, facts: [{ id: "sample", text: "계산 근거" }] }));
  assert.match(html, /2\/8개 주제가 작성됐습니다/);
  assert.match(html, /href="#consultation-natal"/);
  assert.match(html, /href="#consultation-strength"/);
  assert.ok(html.indexOf('id="consultation-natal"') < html.indexOf('id="consultation-strength"'));
  assert.match(html, /첫 문단 1/);
  assert.match(html, /둘째 문단 1/);
  assert.match(html, /주제 2의 실제 이야기/);
  assert.doesNotMatch(html, /8장 상담 시작하기|<button|<details[^>]*class="consultation-chapter"/);
});

test("월운은 기본 펼침이고 전문 근거만 선택해 열도록 둔다", () => {
  const report = buildFortuneReport(calculate(birth), calculateDaewoon(birth, 0, 2026), 2026);
  const html = renderToStaticMarkup(createElement(FortunePanel, { report, reading: null }));
  assert.match(html, /<details[^>]*class="month-card"[^>]*open/);
  assert.match(html, /<details[^>]*class="fortune-evidence"/);
  assert.doesNotMatch(html, /<details[^>]*class="fortune-evidence"[^>]*open/);
});

test("미성년 영역은 자체 풀이를 유지하고 성인 일·재물·관계만 대응 AI 문장을 쓴다", () => {
  const original = buildFortuneReport(calculate(birth), calculateDaewoon(birth, 0, 2026), 2026);
  const report = { ...original, domains: [
    { title: "어린 시절 운", body: "학교와 또래 사이에서 적응하는 자체 풀이" },
    ...original.domains,
  ] };
  const reading = { career: "AI 직업 풀이", money: "AI 재물 풀이", relationships: "AI 관계 풀이" } as GeminiSajuReading;
  const html = renderToStaticMarkup(createElement(FortunePanel, { report, reading }));
  const domains = html.slice(html.indexOf('id="fortune-domains"'));
  assert.match(domains, /어린 시절 운<\/h3><p>학교와 또래 사이에서 적응하는 자체 풀이<\/p>/);
  assert.match(domains, /일·학업운<\/h3><p>AI 직업 풀이<\/p>/);
  assert.match(domains, /재물운<\/h3><p>AI 재물 풀이<\/p>/);
  assert.match(domains, /관계·인연운<\/h3><p>AI 관계 풀이<\/p>/);
});
