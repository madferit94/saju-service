import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FortunePanel from "../app/fortune-panel";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildFortuneReport } from "../lib/saju/fortune";

const adult: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };
const expectedAdultTitles = [
  "직업운", "학업·시험운", "재물운", "사업·활동운", "연애운", "배우자·동반자운",
  "자녀·다음 세대운", "가족·부모운", "친구·협업운", "건강·생활 균형운", "이동·주거운",
];

function reportFor(input: SajuInput, year = 2026) {
  return buildFortuneReport(calculate(input), calculateDaewoon(input, 0, year), year);
}

test("성인은 생활의 11개 운을 별도 카드로 읽고 카드마다 계산 근거와 점검 질문을 얻는다", () => {
  const report = reportFor(adult);
  assert.deepEqual(report.domains.map((domain) => domain.title), expectedAdultTitles);
  assert.equal(new Set(report.domains.map((domain) => domain.id)).size, expectedAdultTitles.length);
  for (const domain of report.domains) {
    assert.ok(domain.body.length > 60, `${domain.title}: 본문이 너무 짧습니다`);
    assert.ok(domain.evidence.length >= 2, `${domain.title}: 근거가 부족합니다`);
    assert.ok(domain.evidence.every((line) => line.length > 8), `${domain.title}: 빈 근거가 있습니다`);
    assert.ok(domain.question.length > 15, `${domain.title}: 실제 경험 점검 질문이 없습니다`);
    assert.ok(domain.evidence.some((line) => line.includes(report.annual.ganji)), `${domain.title}: 선택 연도 흐름의 근거가 없습니다`);
  }
});

test("연도와 원국이 바뀌면 생활 운의 근거와 풀이가 실제로 달라진다", () => {
  const base = reportFor(adult, 2026);
  const nextYear = reportFor(adult, 2027);
  const differentBirth = reportFor({ ...adult, date: "1994-12-15" }, 2026);
  assert.notEqual(base.annual.ganji, nextYear.annual.ganji);
  assert.ok(base.domains.filter((domain, index) =>
    domain.body !== nextYear.domains[index].body ||
    domain.evidence.join("|") !== nextYear.domains[index].evidence.join("|"),
  ).length >= 8);
  assert.ok(base.domains.filter((domain, index) =>
    domain.body !== differentBirth.domains[index].body ||
    domain.evidence.join("|") !== differentBirth.domains[index].evidence.join("|"),
  ).length >= 8);
});

test("미성년 결과는 배움과 생활 관계에 맞추며 혼인·임신·투자·사업 예언을 피한다", () => {
  const report = reportFor({ ...adult, date: "2020-12-01" });
  const titles = report.domains.map((domain) => domain.title);
  assert.equal(titles.length, 5);
  assert.ok(titles.some((title) => title.includes("배움")));
  assert.ok(titles.some((title) => title.includes("가족")));
  assert.ok(titles.some((title) => title.includes("또래")));
  assert.ok(titles.some((title) => title.includes("생활")));
  assert.ok(titles.some((title) => title.includes("적응")));
  assert.doesNotMatch(titles.join(" "), /연애|배우자|자녀|직업|사업|투자/);
  const guidance = report.domains.map((domain) => domain.body + " " + domain.question).join(" ");
  assert.doesNotMatch(guidance, /결혼할|임신할|투자할|취업할|창업할|배우자를 만날|자녀를 낳을/);
});

test("생활 운 카드와 질문은 결과 화면에 바로 보이고 계산 근거는 선택해 읽는다", () => {
  const report = reportFor(adult);
  const html = renderToStaticMarkup(createElement(FortunePanel, { report, reading: null }));
  const domainsHtml = html.slice(html.indexOf('id="fortune-domains"'));
  for (const domain of report.domains) {
    assert.ok(domainsHtml.includes(`<h4>${domain.title}</h4>`), `${domain.title}: 화면에 제목이 없습니다`);
    assert.ok(domainsHtml.includes(domain.question), `${domain.title}: 화면에 점검 질문이 없습니다`);
    assert.ok(domainsHtml.includes(domain.evidence[0]), `${domain.title}: 화면에 계산 근거가 없습니다`);
  }
  assert.match(domainsHtml, /<details[^>]*class="fortune-evidence"/);
});
