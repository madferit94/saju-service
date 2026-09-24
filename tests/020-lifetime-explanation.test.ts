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

function view(input = birth, reading: GeminiSajuReading | null = null) {
  const chart = calculate(input);
  const report = buildFortuneReport(chart, calculateDaewoon(input, 0, 2026), 2026);
  const html = renderToStaticMarkup(createElement(FortunePanel, { report, reading }));
  const start = html.indexOf('id="fortune-lifetime"');
  const end = html.indexOf('id="fortune-annual"', start);
  assert.ok(start >= 0 && end > start, "평생운 영역을 찾지 못했습니다");
  return { chart, report, lifetime: html.slice(start, end) };
}

test("평생운은 전문 용어의 쉬운 뜻과 계산 근거를 저장된 긴 풀이보다 먼저 보여준다", () => {
  const saved = "저장된 개인 평생 해석 문장";
  const { lifetime } = view(birth, { lifetime: saved } as GeminiSajuReading);
  const savedAt = lifetime.indexOf(saved);
  assert.ok(savedAt > 0, "저장된 AI 풀이가 화면에서 사라졌습니다");

  const explanation = lifetime.slice(0, savedAt);
  assert.match(explanation, /풀이에 나오는 말의 뜻|용어|읽기 전에/, "풀이보다 먼저 용어를 설명하는 영역이 필요합니다");
  assert.match(explanation, /편인[\s\S]{0,150}(탐구|새로운|독자|다른 방식)/, "편인의 뜻을 쉬운 말로 설명해야 합니다");
  assert.match(explanation, /편재[\s\S]{0,150}(기회|자원|돈|사람)/, "편재의 뜻을 쉬운 말로 설명해야 합니다");
  assert.match(explanation, /일간/);
  assert.match(explanation, /천간/);
  assert.match(explanation, /지장간/);
});

test("각 대운에서는 실제 일간·천간 십성·중심 지장간 근거가 해석보다 먼저 나온다", () => {
  const { chart, report, lifetime } = view();
  const periods = report.lifetime.flatMap((stage) => stage.periods).filter((period) => period.ganji);
  assert.ok(periods.length >= 3);

  for (const period of periods.slice(0, 3)) {
    const stemGod = period.stemGod;
    const primary = period.hiddenStems?.[0];
    assert.ok(stemGod && primary, `${period.korean}: 계산된 십성 정보가 필요합니다`);
    const heading = `${period.startYear}–${period.endYear} · ${period.startAge}–${period.endAge}세`;
    const headingAt = lifetime.indexOf(heading);
    const summaryAt = lifetime.indexOf(period.summary, headingAt);
    assert.ok(headingAt >= 0 && summaryAt > headingAt, `${period.korean}: 시기 제목과 해석이 필요합니다`);
    const grounds = lifetime.slice(headingAt, summaryAt);
    assert.ok(grounds.includes(chart.dayMaster.character), `${period.korean}: 판단 기준인 일간이 필요합니다`);
    assert.ok(grounds.includes(period.ganji[0]), `${period.korean}: 대운 천간이 필요합니다`);
    assert.ok(grounds.includes(stemGod), `${period.korean}: 천간과 일간의 십성 관계가 필요합니다`);
    assert.ok(grounds.includes(primary.stem), `${period.korean}: 중심 지장간이 필요합니다`);
    assert.ok(grounds.includes(primary.god), `${period.korean}: 중심 지장간의 십성 관계가 필요합니다`);
    assert.match(grounds, /일간/);
    assert.match(grounds, /지장간|아랫글자[^<]*속 중심 글자/);
  }
});

test("대운 시작 전 구간에는 없는 간지나 십성 관계를 만들어 붙이지 않는다", () => {
  const { report, lifetime } = view();
  const first = report.lifetime[0].periods[0];
  assert.equal(first.ganji, "");
  const beforeAt = lifetime.indexOf("대운 시작 전");
  const firstActual = report.lifetime.flatMap((stage) => stage.periods).find((period) => period.ganji);
  assert.ok(firstActual);
  const nextAt = lifetime.indexOf(`${firstActual.startYear}–${firstActual.endYear} · ${firstActual.startAge}–${firstActual.endAge}세`, beforeAt);
  assert.ok(beforeAt >= 0 && nextAt > beforeAt);
  const beforePeriod = lifetime.slice(beforeAt, nextAt);
  assert.ok(beforePeriod.includes(first.summary), "대운 시작 전 해설은 유지해야 합니다");
  assert.doesNotMatch(beforePeriod, /대운 천간|중심 지장간|천간의 십성/);
});
