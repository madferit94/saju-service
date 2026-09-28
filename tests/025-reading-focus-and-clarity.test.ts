import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { buildLifeSeasons } from "../lib/saju/life-seasons";
import { buildFortuneReport } from "../lib/saju/fortune";
import LifeSeasonsPanel from "../app/life-seasons-panel";
import FortunePanel from "../app/fortune-panel";

const birth: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };
const anotherBirth: SajuInput = { ...birth, date: "2005-12-23" };

function reports(input: SajuInput, year: number) {
  const chart = calculate(input);
  const timeline = calculateDaewoon(input, 0, year);
  return { chart, timeline, seasons: buildLifeSeasons(chart, timeline), fortune: buildFortuneReport(chart, timeline, year) };
}

test("현재 4계절은 실제 대운 근거와 생활 실천을 먼저 설명하고 다른 대운은 접어 둔다", () => {
  for (const [input, year] of [[birth, 2026], [anotherBirth, 2038]] as const) {
    const { seasons } = reports(input, year);
    const active = seasons.periods.find(period => period.index === seasons.current?.periodIndex);
    assert.ok(active, `${year}: 현재 대운이 필요합니다`);
    assert.ok(active.reason.includes(active.ganji), "현재 계절 이유에 실제 대운 간지가 있어야 합니다");
    assert.ok(active.reason.includes(active.stemGod) && active.reason.includes(active.branchGod), "대표·보조 계절의 십성 근거가 필요합니다");
    assert.ok(seasons.current?.action && seasons.current.action.length >= 20, "개운법에는 실행할 수 있는 구체적 내용이 필요합니다");
    assert.doesNotMatch(seasons.current.action, /행운의 (색|방향|물건)|반드시 성공|수익 보장|병이 낫/u);

    const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report: seasons }));
    const seasonSection = html.slice(html.indexOf('id="life-seasons"'));
    const current = seasonSection.slice(0, seasonSection.indexOf('class="life-periods"'));
    assert.ok(current.includes(active.reason), "현재 계절의 분류 이유를 카드 전에 보여줘야 합니다");
    assert.ok(current.includes(seasons.current.action), "현재 나이에 맞춘 개운법을 카드 전에 보여줘야 합니다");
    const openPeriods = [...seasonSection.matchAll(/<details(?=[^>]*class="life-period [^"]+")(?=[^>]*\bopen="")[^>]*>/g)];
    assert.equal(openPeriods.length, 0, "현재 요약이 이미 보이므로 대운별 상세는 모두 기본으로 접어 둡니다");
  }
});

test("같은 대운 안에서도 20세·60세 경계의 현재 카드는 해당 나이 조언만 보여준다", () => {
  for (const [input, beforeYear, afterYear, boundary, beforeWord, afterWord] of [
    [anotherBirth, 2023, 2024, 20, "공부", "공동 지출"],
    [birth, 2052, 2053, 60, "조사", "활동"],
  ] as const) {
    const before = reports(input, beforeYear).seasons;
    const after = reports(input, afterYear).seasons;
    assert.equal(before.current?.periodIndex, after.current?.periodIndex, `${boundary}세 경계가 같은 대운 안에 있어야 합니다`);
    assert.ok(before.current && after.current);
    assert.notEqual(before.current.action, after.current.action, "현재 나이에 따라 개운법이 바뀌어야 합니다");
    assert.match(before.current.action, new RegExp(beforeWord));
    assert.match(after.current.action, new RegExp(afterWord));
    for (const report of [before, after]) {
      const html = renderToStaticMarkup(createElement(LifeSeasonsPanel, { report }));
      const currentCard = html.slice(html.indexOf('class="season-current'), html.indexOf('class="season-legend'));
      for (const field of [report.current!.opportunity, report.current!.risk, report.current!.action]) {
        assert.ok(currentCard.includes(field), `${boundary}세 경계: 현재 카드에 실제 나이 조언이 필요합니다`);
      }
      assert.doesNotMatch(currentCard, new RegExp(`${boundary}세 전에는|${boundary}세 이후에는`),
        "현재 카드에 대운 전체의 이전·이후 조언을 함께 싣지 않습니다");
    }
  }
});

test("받침 없는 대운 이름 뒤에 잘못된 조사를 붙이지 않는다", () => {
  const input: SajuInput = { ...birth, date: "1990-06-15" };
  const { fortune } = reports(input, 2020);
  assert.match(fortune.annual.daewoon, /기묘$/);
  for (const domain of fortune.domains) {
    assert.match(domain.interpretation, /기묘 대운을 배경으로/);
    assert.doesNotMatch(domain.interpretation, /기묘을|기묘은/);
  }
});

test("생활 주제 풀이는 원국·현재 대운·선택 연도 세운에 연결되고 조사가 맞는다", () => {
  for (const [input, year] of [[birth, 2026], [birth, 2036], [anotherBirth, 2026]] as const) {
    const { fortune } = reports(input, year);
    for (const domain of fortune.domains) {
      const content = `${domain.body} ${domain.interpretation}`;
      assert.ok(content.includes(fortune.annual.ganji), `${year} ${domain.title}: 세운 간지가 필요합니다`);
      assert.ok(content.includes(fortune.annual.daewoon), `${year} ${domain.title}: 적용 중인 대운 연결이 필요합니다`);
      assert.doesNotMatch(content, /(?:겁재|편재|정재|무자|갑자|병자|경자)은/u, `${year} ${domain.title}: 받침 없는 말 뒤 조사 오류`);
      assert.doesNotMatch(content, /(?:비견|식신|상관|편관|정관|편인|정인)는/u, `${year} ${domain.title}: 받침 있는 말 뒤 조사 오류`);
    }
  }
});

test("고령 시기에는 현재 직업과 고객 일정이 있다고 전제하지 않는다", () => {
  for (const year of [2055, 2075]) {
    const { fortune, seasons } = reports(birth, year);
    const current = seasons.periods.find(period => period.index === seasons.current?.periodIndex);
    assert.ok(current);
    assert.ok(year - 1994 + 1 >= 60 && current.endAge >= 60);
    const advice = [current.opportunity, current.risk, current.action, ...fortune.domains.flatMap(domain => [domain.body, domain.interpretation])].join(" ");
    const assumption = advice.match(/고객|납기|직장에서 맡|직장 이동|일터에서 맡/u)?.[0];
    assert.equal(assumption, undefined, `${year}: 고령기에 '${assumption}' 활동을 기본 전제로 합니다`);
  }
});

test("평생운 상세는 한꺼번에 펼치지 않고 필요한 시기만 열어 읽는다", () => {
  const { fortune } = reports(birth, 2026);
  const html = renderToStaticMarkup(createElement(FortunePanel, { report: fortune, reading: null }));
  const section = html.slice(html.indexOf('id="fortune-lifetime"'), html.indexOf('id="fortune-annual"'));
  const totalPeriods = fortune.lifetime.reduce((sum, stage) => sum + stage.periods.length, 0);
  const openDetails = (section.match(/<details\b[^>]*\bopen=""/g) ?? []).length;
  assert.ok(totalPeriods > 4);
  assert.ok(openDetails < totalPeriods, `평생운 ${totalPeriods}구간이 모두 기본으로 열려 있습니다`);
});
