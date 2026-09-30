import type { GeminiReadingContext } from "./gemini-reading";
import { validateNoCertainPrediction } from "./reading-quality";

export type ReadingSummary = { synthesis: string; current: string; action: string; evidenceIds: string[] };
export function summaryFacts(context: GeminiReadingContext) {
  return [...context.analysis.facts, ...(context.stars ?? []).filter(s=>s.status==="matched").map(s=>({id:s.id,text:`${s.name}: ${s.interpretation} ${s.action}`})), ...context.fortune.annual.combination.facts.map(f => ({ ...f, id: `annual_${f.id}` }))];
}
export function createSummaryPrompt(context: GeminiReadingContext) {
  const first = context.timeline.periods[0];
  const age = first ? context.fortune.year - first.startYear + first.startAge : null;
  const currentPeriod = context.timeline.periods.find(p => p.startYear <= context.fortune.year && p.endYear >= context.fortune.year);
  return [
    "계산된 사주를 쉬운 한국어로 요약하세요. 생년월일이나 간지를 다시 계산하지 마세요.",
    "synthesis(타고난 강점과 부담), current(올해의 활용점), action(지금 할 생활 실천)을 각 2문장, 80~180자로 쓰세요. 첫 문장부터 구체적인 생활말을 쓰고 한자·명리 용어는 쓰지 마세요.",
    "길흉·성공·질병·수명을 단정하지 마세요. 미성년은 학습·생활 중심으로, 후반기는 경험의 활용과 생활 조정 중심으로 읽으세요. 돈·직장 조언을 모든 연령에 복사하지 마세요.",
    "evidenceIds에는 실제로 사용한 아래 facts의 id를 2~6개 넣으세요. 지어낸 근거는 허용하지 않습니다. 숫자는 성공 확률이 아닙니다. 형식에 맞는 JSON만 출력하세요.",
    JSON.stringify({ year: context.fortune.year, age, currentPeriod, facts: summaryFacts(context), interpretationPlan: context.fortune.interpretationPlan, annual: { opportunity: context.fortune.annual.opportunity, risk: context.fortune.annual.risk, action: context.fortune.annual.action } }),
  ].join("\n");
}
export function createSummarySchema() {
  return { type: "object", additionalProperties: false, required: ["synthesis", "current", "action", "evidenceIds"], properties: {
    synthesis: {type:"string"}, current:{type:"string"}, action:{type:"string"},
    evidenceIds:{type:"array",items:{type:"string"},minItems:2,maxItems:6},
  }};
}
export function validateReadingSummary(value: unknown, allowedIds?: string[]): ReadingSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("핵심 풀이 형식을 확인하지 못했습니다.");
  const v = value as Record<string, unknown>;
  for (const key of ["synthesis", "current", "action"]) {
    if (typeof v[key] !== "string" || (v[key] as string).trim().length < 20 || (v[key] as string).length > 500) throw new Error("핵심 풀이 내용이 누락되었습니다.");
    validateNoCertainPrediction(v[key] as string);
  }
  if (!Array.isArray(v.evidenceIds) || v.evidenceIds.length < 2 || v.evidenceIds.length > 6 || new Set(v.evidenceIds).size !== v.evidenceIds.length || v.evidenceIds.some(id => typeof id !== "string" || !/^[a-z_]+$/.test(id) || (allowedIds && !allowedIds.includes(id)))) throw new Error("핵심 풀이의 계산 근거를 확인하지 못했습니다.");
  return { synthesis: (v.synthesis as string).trim(), current: (v.current as string).trim(), action: (v.action as string).trim(), evidenceIds: v.evidenceIds as string[] };
}
