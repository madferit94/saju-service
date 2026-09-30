import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuChart } from "../lib/saju/chart";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { calculateStars, validateStarReading } from "../lib/saju/stars";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { createGeminiReadingContext, createGeminiResponseSchema } from "../lib/saju/gemini-reading";
import { consultationFacts } from "../lib/saju/consultation";

const seed = calculate({ date: "2000-06-15", time: "12:00", calendar: "solar", topic: "general" });
const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
const stemElements = [..."木木火火土土金金水水"].map((v) => ({木:"목",火:"화",土:"토",金:"금",水:"수"})[v]!);
const branchElements = ["수","토","목","목","토","화","화","토","금","금","토","수"];

// Synthetic pillars deliberately isolate table rules; they are not claimed as a birth timestamp.
function fixture(dayStem = "甲", bs = ["子", "子", "子", "子"], ss = ["甲", "甲", dayStem, "甲"]): SajuChart {
  const pillars = seed.pillars.map((p, i) => ({...p, stem:ss[i], branch:bs[i], text:ss[i]+bs[i],
    stemElement:stemElements[stems.indexOf(ss[i])], branchElement:branchElements[branches.indexOf(bs[i])]}));
  const elements: SajuChart["elements"] = {목:0,화:0,토:0,금:0,수:0};
  for (const p of pillars) {
    elements[p.stemElement as keyof typeof elements]++;
    elements[p.branchElement as keyof typeof elements]++;
  }
  return {...seed, pillars, elements, dayMaster:{...seed.dayMaster, character:dayStem, element:pillars[2].stemElement}};
}
function star(chart: SajuChart, id: string) {
  const result = calculateStars(chart).find((s) => s.id === id);
  assert.ok(result, id);
  return result;
}

test("10종의 안정적인 ID와 상세 문구를 제공하고 기존 네 귀인 판정을 보존한다", () => {
  for (const stem of stems) {
    const chart = fixture(stem, ["寅", "子", "午", "未"]);
    const result = calculateStars(chart);
    assert.equal(result.length, 10);
    assert.equal(new Set(result.map(s => s.id)).size, 10);
    assert.deepEqual(result.map(s => s.id), ["star_tianyi","star_taiji","star_wenchang","star_yuede","star_tiande","star_yima","star_taohua","star_huagai","star_yangren","star_jianlu"]);
    calculateBenefactors(chart).forEach((old, i) => {
      assert.equal(result[i].name, old.name);
      assert.deepEqual(result[i].targets, old.targets);
      assert.deepEqual(result[i].matches.map(m => m.pillar), old.matchedPillars);
    });
    for (const s of result) {
      for (const field of [s.meaning,s.basis,s.interpretation,s.opportunity,s.caution,s.action]) assert.ok(field.trim());
      assert.equal(s.status === "matched", s.matches.length > 0);
    }
  }
});

test("천덕 12월 표는 천간과 지지를 구분하여 모든 해당 기둥을 찾는다", () => {
  const months = [..."寅卯辰巳午未申酉戌亥子丑"];
  const targets = [..."丁申壬辛亥甲癸寅丙乙巳庚"];
  months.forEach((month, i) => {
    const target = targets[i];
    const isStem = stems.includes(target);
    const chart = fixture("戊", [isStem?"子":target, month, "子", isStem?"子":target], [isStem?target:"戊", "戊", "戊", isStem?target:"戊"]);
    const result = star(chart,"star_tiande");
    assert.deepEqual(result.targets,[target],month);
    assert.deepEqual(result.matches.map(m=>m.pillar),["년주","시주"],month);
    assert.ok(result.matches.every(m=>m.character===target));
  });
});

test("역마·도화·화개는 12개 년·일지의 삼합 그룹별 표를 적용한다", () => {
  const groups = ["申子辰","寅午戌","巳酉丑","亥卯未"];
  const cases = {star_yima:[..."寅申亥巳"],star_taohua:[..."酉卯午子"],star_huagai:[..."辰戌丑未"]};
  for (const [id, targets] of Object.entries(cases)) groups.forEach((group,i)=>{
    for (const origin of group) {
      const result=star(fixture("甲",[origin,targets[i],origin,targets[i]]),id);
      assert.deepEqual(result.targets,[targets[i]],`${id}/${origin}`);
      for(const location of ["월주","시주"]) {
        const matches=result.matches.filter(m=>m.pillar===location);
        assert.equal(matches.length,1);
        assert.equal(matches[0].bases.length,2,"년지와 일지 기준을 합쳐 보존");
      }
    }
  });
});

test("년지·일지 기준이 다르면 서로 다른 표지를 보존하고 기준 자리 자체는 제외한다",()=>{
  const independent=star(fixture("甲",["子","寅","午","申"]),"star_yima");
  assert.deepEqual(new Set(independent.targets),new Set(["寅","申"]));
  assert.deepEqual(independent.matches.map(m=>m.pillar),["월주","시주"]);
  assert.ok(independent.matches.every(m=>m.bases.length===1));
  const selfOnly=star(fixture("甲",["辰","子","午","子"]),"star_huagai");
  assert.deepEqual(selfOnly.matches,[],"년지 辰 자기 자신을 화개로 세지 않음");
  assert.equal(selfOnly.status,"absent");
  const otherBase=star(fixture("甲",["辰","子","辰","子"]),"star_huagai");
  assert.deepEqual(otherBase.matches.map(m=>m.pillar),["년주","일주"]);
  assert.ok(otherBase.matches.every(m=>m.bases.length===1),"서로 상대 기준으로만 일치");
});

test("양인은 양간 다섯 종류만 판정하고 음간은 미해당과 구별한다",()=>{
  const mapping:Record<string,string>={甲:"卯",丙:"午",戊:"午",庚:"酉",壬:"子"};
  for(const stem of stems) {
    const target=mapping[stem];
    const result=star(fixture(stem,["辰","辰","辰",target??"卯"]),"star_yangren");
    if(target) {
      assert.deepEqual(result.targets,[target]);
      assert.equal(result.status,"matched");
      assert.deepEqual(result.matches.map(m=>m.pillar),["시주"]);
      assert.equal(star(fixture(stem,["辰","辰","辰","辰"]),"star_yangren").status,"absent");
    } else {
      assert.equal(result.status,"not-applicable");
      assert.deepEqual(result.matches,[]);
      assert.deepEqual(result.targets,[]);
    }
  }
});

test("건록은 십간 전체 표를 사용하되 월지 건록격 확정으로 표현하지 않는다",()=>{
  [..."寅卯巳午巳午申酉亥子"].forEach((target,i)=>{
    const result=star(fixture(stems[i],["辰","辰","辰",target]),"star_jianlu");
    assert.deepEqual(result.targets,[target]);
    assert.deepEqual(result.matches.map(m=>m.pillar),["시주"]);
    assert.doesNotMatch(result.interpretation,/건록격(?:입니다|으로 확정)/);
  });
});

test("운에서만 나타난 표지는 원국 보유 상태를 바꾸지 않고 출생 기준을 고정한다",()=>{
  const chart=fixture("甲",["子","子","午","子"]);
  const natal=star(chart,"star_yima");
  const result=calculateStars(chart,[{label:"대운",ganji:"甲寅"},{label:"세운",ganji:"戊申"},{label:"월운",ganji:"庚辰"}]).find(s=>s.id==="star_yima")!;
  assert.equal(natal.status,"absent");
  assert.equal(result.status,"absent");
  assert.deepEqual(result.matches,natal.matches);
  assert.deepEqual(result.flowMatches.map(m=>[m.label,m.ganji]),[["대운","甲寅"],["세운","戊申"]]);
  assert.ok(result.flowMatches.every(m=>m.bases.length===1));
});

test("천덕 운 일치는 월지 원국의 천간/지지 기준을 유지하고 잘못된 간지는 제외한다",()=>{
  for(const [month,hit,miss] of [["寅","丁卯","甲申"],["卯","甲申","丁卯"]]) {
    const chart=fixture("甲",["子",month,"子","子"]);
    const snapshot=JSON.stringify(chart);
    const result=calculateStars(chart,[{label:"대운",ganji:hit},{label:"세운",ganji:miss},{label:"오류",ganji:hit+"년"},{label:"오류",ganji:""}]).find(s=>s.id==="star_tiande")!;
    assert.deepEqual(result.flowMatches.map(m=>m.ganji),[hit]);
    assert.equal(result.status,"absent");
    assert.equal(JSON.stringify(chart),snapshot,"계산이 저장된 원국을 변경하지 않음");
  }
});

test("종합 응답은 실제 원국 일치 ID를 모두 요구하고 누락·중복·가짜·운 전용 ID를 거절한다",()=>{
  const result=calculateStars(fixture("甲",["子","子","午","子"]),[{label:"세운",ganji:"甲寅"}]);
  const ids=result.filter(s=>s.status==="matched").map(s=>s.id);
  const valid={starReading:"원국과 운의 흐름을 먼저 살피고, 배움과 협업에 참고할 수 있습니다.",starEvidenceIds:ids};
  assert.doesNotThrow(()=>validateStarReading(valid,result));
  assert.throws(()=>validateStarReading({},result));
  assert.throws(()=>validateStarReading({...valid,starReading:""},result));
  assert.throws(()=>validateStarReading({...valid,starEvidenceIds:ids.slice(1)},result));
  assert.throws(()=>validateStarReading({...valid,starEvidenceIds:[...ids,ids[0]]},result));
  assert.throws(()=>validateStarReading({...valid,starEvidenceIds:[...ids,"star_fake"]},result));
  assert.throws(()=>validateStarReading({...valid,starEvidenceIds:[...ids,"star_yima"]},result));
  assert.throws(()=>validateStarReading({...valid,starReading:"역마살이 있어 이동이 유리합니다."},result));
});

test("종합 응답은 확정 예언을 거절하고 일치 표지가 없는 경우 빈 ID를 허용한다",()=>{
  const result=calculateStars(seed);
  const ids=result.filter(s=>s.status==="matched").map(s=>s.id);
  assert.throws(()=>validateStarReading({starReading:"반드시 부자가 됩니다.",starEvidenceIds:ids},result));
  const empty=result.map(s=>({...s,status:"absent" as const,matches:[]}));
  assert.doesNotThrow(()=>validateStarReading({starReading:"원국의 계절과 균형을 중심으로 읽습니다.",starEvidenceIds:[]},empty));
});

test("전체 해석과 상담은 같은 원국 표지를 받고 선택 연도의 운을 구분한다",()=>{
  const input={date:"2000-06-15",time:"12:00",calendar:"solar",topic:"general"} as const;
  const timeline=calculateDaewoon(input,1,2026);
  const context=createGeminiReadingContext(seed,timeline,calculateBenefactors(seed),2036);
  const natal=calculateStars(seed);
  assert.deepEqual(context.stars.map(s=>s.matches),natal.map(s=>s.matches));
  assert.ok(context.stars.flatMap(s=>s.flowMatches).every(f=>f.label.includes("2036")));
  const facts=consultationFacts(context).filter(f=>f.id.startsWith("star_"));
  assert.deepEqual(facts.map(f=>f.id),natal.filter(s=>s.status==="matched").map(s=>s.id));
  assert.ok(facts.every(f=>f.text.includes("실천:")));
  const schema=createGeminiResponseSchema(timeline.periods.map(p=>p.index),context.fortune.interpretationPlan);
  assert.ok(schema.required.includes("starReading"));
  assert.ok(schema.required.includes("starEvidenceIds"));
});
