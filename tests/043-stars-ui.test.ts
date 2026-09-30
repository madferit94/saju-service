import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import MansePanel from "../app/manse-panel";
import { calculate } from "../lib/saju/chart";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { calculateStars } from "../lib/saju/stars";

const input={date:"2005-12-23",time:"08:37",calendar:"solar",topic:"general"} as const;
const chart=calculate(input); // 辛 일간: 양인 판정 대상 아님을 포함하는 공개 기준 fixture.
function markup(mode:"chart"|"elements"="chart") {
  return renderToStaticMarkup(createElement(MansePanel,{chart,benefactors:calculateBenefactors(chart),mode}));
}

test("귀인·신살 10개 카드는 native button이고 미해당과 규칙 대상 아님을 구별한다",()=>{
  const html=markup();
  const cards=[...html.matchAll(/<button\b([^>]*class="star-chip[^>]*)>([\s\S]*?)<\/button>/g)];
  assert.equal(cards.length,10);
  for(const star of calculateStars(chart)) {
    const card=cards.find(c=>c[2].includes(`<strong>${star.name}</strong>`));
    assert.ok(card,star.name);
    assert.match(card[1],/type="button"/);
    assert.match(card[1],/aria-pressed="false"/);
    if(star.status==="absent") assert.match(card[2],/원국 해당 없음/);
    else if(star.status==="not-applicable") assert.match(card[2],/선택 규칙 대상 아님/);
    else for(const match of star.matches) assert.ok(card[2].includes(match.pillar));
  }
  assert.match(html,/선택 규칙 대상 아님/);
  assert.match(html,/원국 해당 없음/);
});

test("만세력 표는 원국에 실제 일치한 자리별 설명 버튼만 제공한다",()=>{
  const html=markup();
  const buttons=[...html.matchAll(/<button\b[^>]*aria-label="([^"]+ 설명)"[^>]*>([^<]+)<\/button>/g)];
  const expected=calculateStars(chart).flatMap(s=>s.matches.map(m=>({label:`${m.pillar} ${s.name} 설명`,name:s.name})));
  assert.equal(buttons.length,expected.length);
  for(const item of expected) assert.ok(buttons.some(b=>b[1]===item.label&&b[2]===item.name),item.label);
  assert.match(html,/귀인·신살<\/th>/);
});

test("처음에는 상세 본문을 펼치지 않고 근거 접기나 별도 오행 화면에 카드 목록을 추가하지 않는다",()=>{
  const html=markup();
  assert.doesNotMatch(html,/<details\b|계산 근거|id="star-detail"/);
  assert.doesNotMatch(markup("elements"),/class="star-chip|내 사주의 귀인과 신살/);
  assert.match(markup("elements"),/오행과 십성을 한눈에/);
});

test("이전 저장 풀이를 유지하며 사용자가 확장 해석을 다시 요청할 경로를 제공한다",()=>{
  // The form restores storage after hydration; its browser behavior is checked separately.
  const source=readFileSync(new URL("../app/saju-form.tsx",import.meta.url),"utf8");
  assert.match(source,/visibleReading\s*&&\s*!visibleReading\.starReading\s*&&\s*!isGenerating/);
  assert.match(source,/<button type="button" onClick=\{\(\) => void requestGeminiReading\(\)\}>귀인·신살을 반영해 다시 풀이<\/button>/);
  assert.match(source,/visibleReading\.starReading\s*\|\|\s*visibleReading\.benefactors/);
});
