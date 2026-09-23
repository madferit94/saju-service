import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FortunePanel from "../app/fortune-panel";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildFortuneReport } from "../lib/saju/fortune";
import type { GeminiSajuReading } from "../lib/saju/gemini-reading";

const birth: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };

test("월운은 기본 펼침이고 전문 근거만 선택해 열도록 둔다", () => {
  const report = buildFortuneReport(calculate(birth), calculateDaewoon(birth, 0, 2026), 2026);
  const html = renderToStaticMarkup(createElement(FortunePanel, { report, reading: null }));
  assert.match(html, /<details[^>]*class="month-card"[^>]*open/);
  assert.match(html, /<details[^>]*class="fortune-evidence"/);
  assert.doesNotMatch(html, /<details[^>]*class="fortune-evidence"[^>]*open/);
});

test("미성년 운은 AI의 성인 직업·돈·관계 문장을 섞지 않고 성인 카드는 로컬 풀이도 유지한다", () => {
  const report = buildFortuneReport(calculate(birth), calculateDaewoon(birth, 0, 2026), 2026);
  const minorBirth = { ...birth, date: "2020-12-01" };
  const minor = buildFortuneReport(calculate(minorBirth), calculateDaewoon(minorBirth, 0, 2026), 2026);
  const reading = { career: "AI 직업 풀이", money: "AI 재물 풀이", relationships: "AI 관계 풀이" } as GeminiSajuReading;
  const adultHtml = renderToStaticMarkup(createElement(FortunePanel, { report, reading }));
  const minorHtml = renderToStaticMarkup(createElement(FortunePanel, { report: minor, reading }));
  const adultDomains = adultHtml.slice(adultHtml.indexOf('id="fortune-domains"'));
  const minorDomains = minorHtml.slice(minorHtml.indexOf('id="fortune-domains"'));
  for (const domain of report.domains) {
    assert.ok(adultDomains.includes(domain.body), `${domain.title}: 로컬 풀이가 사라졌습니다`);
  }
  for (const domain of minor.domains) {
    assert.ok(minorDomains.includes(domain.body), `${domain.title}: 미성년 로컬 풀이가 사라졌습니다`);
  }
  assert.match(adultDomains, /직업운[\s\S]*AI 직업 풀이/);
  assert.match(adultDomains, /재물운[\s\S]*AI 재물 풀이/);
  const romanceCard = adultDomains.slice(adultDomains.indexOf("<h4>연애운</h4>"), adultDomains.indexOf("</article>", adultDomains.indexOf("<h4>연애운</h4>")));
  const partnerCard = adultDomains.slice(adultDomains.indexOf("<h4>배우자·동반자운</h4>"), adultDomains.indexOf("</article>", adultDomains.indexOf("<h4>배우자·동반자운</h4>")));
  assert.doesNotMatch(romanceCard, /AI 관계 풀이/);
  assert.match(partnerCard, /AI 관계 풀이/);
  assert.doesNotMatch(minorDomains, /AI 직업 풀이|AI 재물 풀이|AI 관계 풀이/);
});
