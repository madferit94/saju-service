import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MansePanel from "../app/manse-panel";
import DeepAnalysisPanel from "../app/deep-analysis-panel";
import LifeSeasonsPanel from "../app/life-seasons-panel";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { buildLifeSeasons } from "../lib/saju/life-seasons";

const input: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };

test("만세력과 균형 분석은 주요 정보를 남기고 근거 접기 창을 표시하지 않는다", () => {
  const chart = calculate(input);
  const manse = renderToStaticMarkup(createElement(MansePanel, { chart, benefactors: calculateBenefactors(chart) }));
  const analysis = analyzeNatal(chart);
  const deep = renderToStaticMarkup(createElement(DeepAnalysisPanel, { analysis }));

  assert.match(manse, /태어난 시·일·월·년으로 보는 네 기둥/);
  assert.match(manse, /오행과 십성을 한눈에/);
  assert.doesNotMatch(manse, /표의 용어와 계산 기준 알아보기/);
  assert.match(deep, /사주의 균형과 도움이 되는 방향/);
  assert.match(deep, new RegExp(analysis.strength.label));
  assert.match(deep, new RegExp(analysis.useful.status));
  assert.doesNotMatch(deep, /<details\b|수치와 판단 근거 보기|판정 기준과 계산 내역/);
});

test("인생 4계절은 현재 이유와 실천 및 대운 접기를 유지하고 별도 근거 접기는 제거한다", () => {
  const chart = calculate(input);
  const report = buildLifeSeasons(chart, calculateDaewoon(input, 0, 2026));
  const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report }));
  assert.ok(report.current);
  assert.match(html, /이 계절인 이유/);
  assert.ok(html.includes(report.current.action));
  assert.match(html, /<details[^>]*class="life-period /);
  assert.doesNotMatch(html, /<details[^>]*class="fortune-evidence"|네 기둥과 비교한 계산 근거|4계절을 나눈 기준과 한계/);
});
