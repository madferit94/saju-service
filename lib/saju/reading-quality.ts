import type { GeminiReadingContext, GeminiSajuReading } from "./gemini-reading";
import type { FortuneReport } from "./fortune";
import { koreanGanji } from "./fortune";

export type InterpretationBasis = Record<"synthesis" | "annual", {ruleId:string;evidenceIds:string[]}>;
export const interpretationBasisSchema = {
  type:"object", additionalProperties:false, required:["synthesis","annual"],
  properties:Object.fromEntries(["synthesis","annual"].map(field => [field, {
    type:"object", additionalProperties:false, required:["ruleId","evidenceIds"],
    properties:{ruleId:{type:"string"},evidenceIds:{type:"array",items:{type:"string"},minItems:2,maxItems:7}},
  }])),
};
export function validateInterpretationBasis(value:unknown, plan:FortuneReport["interpretationPlan"]): asserts value is InterpretationBasis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("interpretationBasis에 종합·연운의 규칙과 근거를 넣으세요.");
  for (const field of ["synthesis","annual"] as const) {
    const entry = (value as Partial<InterpretationBasis>)[field];
    if (!entry || entry.ruleId !== plan.ruleId || !Array.isArray(entry.evidenceIds) || entry.evidenceIds.length < 2 || entry.evidenceIds.length > 7 ||
        new Set(entry.evidenceIds).size !== entry.evidenceIds.length || entry.evidenceIds.some(id=>!plan.facts.some(f=>f.id===id)) || !plan.evidenceIds.every(id=>entry.evidenceIds.includes(id))) {
      throw new Error(`interpretationBasis.${field}: ruleId=${plan.ruleId}, 필수 evidenceIds=${plan.evidenceIds.join(",")}를 사용하고 본문도 해당 계획에 맞추세요.`);
    }
  }
}

// These are narrow rejection rules, not a semantic proof that every generated claim is correct.
export function validateNoCertainPrediction(text:string) {
  for (const sentence of text.split(/[.!?。\n]|하지만|그러나/)) {
    if (/(단정|보장|확정|예언).{0,8}(않|없|못|아니)|(?:성공|합격|수익|부자|결혼|이혼|질병|사망).{0,18}(아닙니다|보장되지|보장할 수 없|볼 수 없)/.test(sentence)) continue;
    if (/(반드시|무조건|100\s*%).{0,18}(성공|합격|수익|부자|결혼|이혼|병에|사망)|(?:수익|합격|성공)(?:을|이|은)?\s*(?:확실|보장)|\d+\s*세에\s*(?:사망|죽)|(?:암|질병)이\s*(?:생깁니다|발생합니다)/.test(sentence)) throw new Error("확정적인 사건·수익·건강 예언을 조건부 생활 조언으로 바꾸세요.");
  }
}

function validateLayerMentions(text:string, expected:Record<string,string>, field:string) {
  const pair = "([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|[갑을병정무기경신임계][자축인묘진사오미신유술해])";
  const check = (ganji:string, level:string) => {
    if (!(level in expected)) return;
    const correct = expected[level];
    if (!correct || (ganji !== correct && ganji !== koreanGanji(correct))) throw new Error(`${field}의 ${level} 간지가 계산과 다릅니다. ${level}=${correct || "시작 전/해당 없음"}을 사용하세요.`);
  };
  for (const m of text.matchAll(new RegExp(pair + "(?:\\([^)]*\\))?\\s*(대운|세운|월운)","g"))) check(m[1],m[2]);
  for (const m of text.matchAll(new RegExp("(대운|세운|월운)(?:은|는|이|의)?\\s*[:：]?\\s*" + pair,"g"))) check(m[2],m[1]);
}

export function validateReadingQuality(reading:GeminiSajuReading, context:GeminiReadingContext) {
  const texts = [reading.starReading,reading.synthesis,reading.overview,reading.annual,reading.lifetime,reading.elements,reading.benefactors,reading.career,reading.relationships,reading.money,reading.caution,
    ...(reading.monthly??[]).map(p=>p.reading), ...reading.periodReadings.flatMap(p=>[p.theme,p.strengths,p.cautions,p.advice,p.reflection])].filter((s):s is string=>typeof s === "string");
  for (const text of texts) validateNoCertainPrediction(text);
  if (context.age < 20) {
    const currentTexts = [reading.starReading,reading.synthesis,reading.annual,reading.career,reading.money,reading.relationships,...(reading.monthly??[]).map(m=>m.reading)];
    for (const text of currentTexts) {
      for (const sentence of (text??"").split(/[.!?。\n]/)) {
        for (const mention of sentence.matchAll(/직장|취업|이직|투자|계약|수익|월급|수입/g)) {
          const tail = sentence.slice(mention.index! + mention[0].length);
          if (!/^(?:[은는이가을를]|으로|로)?\s*(?:아닌|아니라|뜻하지|의미하지|해석하지|권하지)/.test(tail)) {
            throw new Error("현재 미성년의 풀이에 성인의 직장·수입·투자 조언이 있습니다. 학교·배움·또래·용돈·생활 준비로 다시 쓰세요.");
          }
        }
      }
    }
  }
  const s = context.analysis.strength;
  const actual = s.sensitive || s.exceptional ? null : s.baseLabel;
  // Only reject an assertion about this natal chart; comparisons and explicit negations stay valid.
  for (const text of [reading.synthesis,reading.overview,reading.elements,reading.annual]) {
    for (const m of (text??"").matchAll(/(?:당신|본인|이 사주|원국)(?:은|는)?\s*(신강|신약)한\s*(?:사주|구조)(?:입니다|로 확정됩니다)/g)) {
      if (!actual || !actual.includes(m[1])) throw new Error("본문의 원국 강약 단정이 계산 조건과 다릅니다. interpretationPlan의 조건부 해석을 사용하세요.");
    }
    for (const m of (text??"").matchAll(/(?:이 사주|타고난 사주|원국|일간)(?:은|는|이|의 힘은)?\s*(?:분명한 |확실한 )?(신강|신약)(?:입니다|합니다|한 편입니다|으로 확정됩니다)/g)) {
      if (!actual || !actual.includes(m[1])) throw new Error("본문의 원국 강약 단정이 계산 조건과 다릅니다. interpretationPlan의 조건부 해석을 사용하세요.");
    }
  }
  const major = context.fortune.annual.hierarchy.layers.find(p=>p.label.includes("대운"))?.ganji ?? "";
  validateLayerMentions(reading.annual??"",{대운:major,세운:context.fortune.annual.ganji},"annual");
  for (const month of reading.monthly??[]) {
    const expected = context.fortune.months.find(p=>p.month===month.month);
    if (expected) validateLayerMentions(month.reading,{대운:expected.daewoonGanji,세운:expected.annualGanji,월운:expected.ganji},`monthly ${month.month}`);
  }
  for (const period of reading.periodReadings) {
    const expected = context.timeline.periods.find(p=>p.index===period.index);
    if (expected) validateLayerMentions([period.theme,period.strengths,period.cautions,period.advice,period.reflection].join(" "),{대운:expected.ganji},`periodReadings ${period.index}`);
  }
}
