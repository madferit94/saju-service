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
  "자녀·다음 세대운", "가족·부모운", "친구·협업운", "생활 균형운", "이동·주거운",
];

function reportFor(input: SajuInput, year = 2026) {
  return buildFortuneReport(calculate(input), calculateDaewoon(input, 0, year), year);
}

test("성인은 생활의 11개 운을 별도 카드로 읽고 카드마다 계산 근거와 사주 해석을 얻는다", () => {
  const report = reportFor(adult);
  const pillars = calculate(adult).pillars;
  const sourcePillar: Record<string, number> = { career: 1, study: 1, money: 1, business: 1, romance: 2, partner: 2, children: 3, family: 0, social: 1, health: 1, movement: 0 };
  assert.deepEqual(report.domains.map((domain) => domain.title), expectedAdultTitles);
  assert.equal(new Set(report.domains.map((domain) => domain.id)).size, expectedAdultTitles.length);
  for (const domain of report.domains) {
    assert.ok(domain.body.length > 60, `${domain.title}: 본문이 너무 짧습니다`);
    assert.ok(domain.evidence.length >= 2, `${domain.title}: 근거가 부족합니다`);
    assert.ok(domain.evidence.every((line) => line.length > 8), `${domain.title}: 빈 근거가 있습니다`);
    assert.ok(domain.interpretation.length > 70, `${domain.title}: 사주 해석이 너무 짧습니다`);
    assert.ok(domain.interpretation.includes(report.annual.ganji), `${domain.title}: 해석에 선택 연도 간지가 없습니다`);
    assert.ok(domain.interpretation.includes(report.annual.stemGod), `${domain.title}: 해석에 선택 연도 십성이 없습니다`);
    assert.ok(domain.interpretation.includes(pillars[sourcePillar[domain.id]].text), `${domain.title}: 원국의 해당 기둥이 해석에 없습니다`);
    assert.ok(domain.evidence.some((line) => line.includes(report.annual.ganji)), `${domain.title}: 선택 연도 흐름의 근거가 없습니다`);
    assert.doesNotMatch(domain.body + " " + domain.interpretation, /공인 점수|비교 지표|판정 보류|조건부 후보|판단할 수 없|예언하지|뜻하지|보장하지|확정할 수 없|표시는 아닙니다|근거는 아닙니다/, `${domain.title}: 중복 안내 문장`);
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
  assert.ok(base.domains.every((domain, index) => domain.interpretation !== nextYear.domains[index].interpretation), "선택 연도의 변화가 모든 주제 해석에 반영되어야 합니다");
  assert.ok(base.domains.some((domain, index) => domain.interpretation !== differentBirth.domains[index].interpretation), "다른 원국의 풀이가 같아서는 안 됩니다");
});

test("미성년 결과는 배움과 생활 관계에 맞추며 혼인·임신·투자·사업 예언을 피한다", () => {
  const childInput = { ...adult, date: "2020-12-01" };
  const report = reportFor(childInput);
  const pillars = calculate(childInput).pillars;
  const sourcePillar: Record<string, number> = { learning: 1, family: 0, peers: 2, balance: 3, adaptation: 1 };
  const titles = report.domains.map((domain) => domain.title);
  assert.equal(titles.length, 5);
  assert.ok(titles.some((title) => title.includes("배움")));
  assert.ok(titles.some((title) => title.includes("가족")));
  assert.ok(titles.some((title) => title.includes("또래")));
  assert.ok(titles.some((title) => title.includes("생활")));
  assert.ok(titles.some((title) => title.includes("적응")));
  assert.doesNotMatch(titles.join(" "), /연애|배우자|자녀|직업|사업|투자/);
  const guidance = report.domains.map((domain) => domain.body + " " + domain.interpretation).join(" ");
  assert.doesNotMatch(guidance, /결혼할|임신할|투자할|취업할|창업할|배우자를 만날|자녀를 낳을/);
  assert.doesNotMatch(guidance, /공인 점수|비교 지표|판정 보류|조건부 후보|판단할 수 없|예언하지|뜻하지|보장하지|확정할 수 없|근거는 아닙니다/);
  for (const domain of report.domains) {
    assert.ok(domain.interpretation.includes(report.annual.ganji), `${domain.title}: 선택 연도 간지가 없습니다`);
    assert.ok(domain.interpretation.includes(report.annual.stemGod), `${domain.title}: 선택 연도 십성이 없습니다`);
    assert.ok(domain.interpretation.includes(pillars[sourcePillar[domain.id]].text), `${domain.title}: 원국의 해당 기둥이 해석에 없습니다`);
  }
});

test("생활 운 카드의 사주 해석은 바로 보이고 계산 근거 접기 창은 표시하지 않는다", () => {
  const report = reportFor(adult);
  const html = renderToStaticMarkup(createElement(FortunePanel, { report, reading: null }));
  const domainsHtml = html.slice(html.indexOf('id="fortune-domains"'));
  for (const domain of report.domains) {
    assert.ok(domainsHtml.includes(`<h4>${domain.title}</h4>`), `${domain.title}: 화면에 제목이 없습니다`);
    assert.ok(domainsHtml.includes(domain.interpretation), `${domain.title}: 화면에 사주 해석이 없습니다`);
  }
  assert.doesNotMatch(domainsHtml, /이렇게 읽은 사주 근거|<details[^>]*class="fortune-evidence"/);
  assert.match(domainsHtml, /사주에서 읽히는 점/);
  assert.doesNotMatch(domainsHtml, /내 경험에 비춰보기|<[^>]*class="[^"]*domain-question/);
});
