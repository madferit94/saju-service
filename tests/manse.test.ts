import test from "node:test";
import assert from "node:assert/strict";
import lunar from "lunar-javascript";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { annualPillars, buildManse, calendarDays, twelveStage } from "../lib/saju/manse";

const birth: SajuInput = { date: "1998-06-15", time: "08:00", calendar: "solar", topic: "general" };
const godKo: Record<string, string> = { 比肩: "비견", 劫财: "겁재", 食神: "식신", 伤官: "상관", 偏财: "편재", 正财: "정재", 七杀: "편관", 正官: "정관", 偏印: "편인", 正印: "정인", 日主: "비견" };
const stageKo: Record<string, string> = { 长生: "장생", 沐浴: "목욕", 冠带: "관대", 临官: "건록", 帝旺: "제왕", 衰: "쇠", 病: "병", 死: "사", 墓: "묘", 绝: "절", 胎: "태", 养: "양" };
type LibraryChart = Record<string, () => string | string[]>;
function library(year: number, month: number, day: number, hour = 8) {
  const value = lunar.Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar().getEightChar();
  value.setSect(1);
  return value as unknown as LibraryChart;
}

test("만세력 표는 계산 원국을 바꾸지 않고 시주·일주·월주·년주 순서로 표시한다", () => {
  const chart = calculate(birth);
  const before = JSON.stringify(chart);
  const table = buildManse(chart);
  assert.deepEqual(table.pillars.map(p => p.label), ["시주", "일주", "월주", "년주"]);
  assert.deepEqual(table.pillars.map(p => p.text), [...chart.pillars].reverse().map(p => p.text));
  for (const pillar of table.pillars) {
    const original = chart.pillars.find(p => p.label === pillar.label)!;
    for (const key of ["stem", "branch", "korean", "stemElement", "branchElement"] as const) assert.equal(pillar[key], original[key]);
  }
  assert.equal(JSON.stringify(chart), before);
});

test("천간·본기 십성과 지장간은 라이브러리의 네 기둥 값과 일치한다", () => {
  for (let day = 1; day <= 10; day++) {
    const table = buildManse(calculate({ ...birth, date: `1998-06-${String(day).padStart(2, "0")}` }));
    const reference = library(1998, 6, day);
    for (const [i, prefix] of ["Time", "Day", "Month", "Year"].entries()) {
      const pillar = table.pillars[i];
      assert.equal(pillar.stemGod, godKo[reference[`get${prefix}ShiShenGan`]() as string]);
      assert.equal(pillar.branchGod, godKo[(reference[`get${prefix}ShiShenZhi`]() as string[])[0]]);
      assert.deepEqual(pillar.hiddenStems.map(s => s.stem).sort(), [...reference[`get${prefix}HideGan`]() as string[]].sort());
      assert.equal(pillar.stage, stageKo[reference[`get${prefix}DiShi`]() as string]);
    }
  }
});

test("오행·십성 분포는 일간을 포함한 여덟 글자만 세며 각각 정확히 100%다", () => {
  for (let month = 1; month <= 12; month++) {
    const chart = calculate({ ...birth, date: `2000-${String(month).padStart(2, "0")}-15` });
    const table = buildManse(chart);
    assert.equal(table.elements.length, 5);
    assert.equal(table.gods.length, 10);
    for (const distribution of [table.elements, table.gods]) {
      assert.equal(new Set(distribution.map(x => x.name)).size, distribution.length);
      assert.equal(distribution.reduce((sum, x) => sum + x.count, 0), 8);
      assert.equal(distribution.reduce((sum, x) => sum + x.percent, 0), 100);
      for (const value of distribution) assert.equal(value.percent, value.count * 12.5);
    }
    for (const element of table.elements) {
      assert.equal(element.count, chart.pillars.flatMap(p => [p.stemElement, p.branchElement]).filter(e => e === element.name).length);
    }
    assert.ok(table.gods.find(g => g.name === "비견")!.count >= 1, "일간이 자기 자신에게 비견으로 포함된다");
  }
});

test("12운성은 10개 일간과 12개 지지의 음양 순행·역행 모두 라이브러리와 맞는다", () => {
  const compared = new Set<string>();
  for (let day = 1; day <= 10; day++) for (let hour = 0; hour < 24; hour += 2) {
    const reference = library(2000, 1, day, hour);
    const stem = (reference.getDay() as string)[0];
    const branch = (reference.getTime() as string)[1];
    assert.equal(twelveStage(stem, branch), stageKo[reference.getTimeDiShi() as string], `${stem}${branch}`);
    compared.add(stem + branch);
  }
  assert.equal(compared.size, 120);
});

test("일진 달력은 윤년·평년·월 경계의 날짜와 요일을 빠짐없이 제공한다", () => {
  for (const [year, month, length] of [[2024, 2, 29], [2025, 2, 28], [2100, 2, 28], [2000, 2, 29], [2026, 4, 30], [2026, 12, 31]]) {
    const days = calendarDays(year, month);
    assert.equal(days.length, length);
    assert.deepEqual(days.map(d => d.day), Array.from({ length }, (_, i) => i + 1));
    for (const day of days) {
      assert.equal(day.weekday, new Date(Date.UTC(year, month - 1, day.day)).getUTCDay());
      assert.equal(day.ganji, lunar.Solar.fromYmdHms(year, month, day.day, 12, 0, 0).getLunar().getEightChar().getDay());
      assert.match(day.korean, /^[가-힣]{2}$/);
    }
  }
});

test("연운은 선택 연도를 중심으로 앞뒤 4년을 보여주며 지원 연도 경계를 지킨다", () => {
  assert.deepEqual(annualPillars(2026).map(p => p.year), [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]);
  assert.deepEqual(annualPillars(1990).map(p => p.year), [1990, 1991, 1992, 1993, 1994]);
  assert.deepEqual(annualPillars(2100).map(p => p.year), [2096, 2097, 2098, 2099, 2100]);
  assert.deepEqual(annualPillars(2026).find(p => p.year === 2026), { year: 2026, ganji: "丙午", korean: "병오" });
});

test("달력에 존재하지 않는 월이나 지원하지 않는 연도를 조용히 다른 날짜로 바꾸지 않는다", () => {
  for (const [year, month] of [[2026, 0], [2026, 13], [2026, 1.5], [1989, 12], [2101, 1], [2026.5, 1], [NaN, 1]]) {
    assert.throws(() => calendarDays(year, month));
  }
});
