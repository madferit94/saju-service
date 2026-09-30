import type { SajuChart } from "./chart";
import { analyzeNatal, type Element } from "./deep-analysis";
import { selectContextualRule } from "./contextual-rules";
import { tenGod } from "./ten-gods";

export const FLOW_RULE_VERSION = 3;
const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const elements: Element[] = ["목", "화", "토", "금", "수"];
export const FLOW_HIDDEN: Record<string, string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"],
  辰: ["戊", "乙", "癸"], 巳: ["丙", "庚", "戊"], 午: ["丁", "己"], 未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};
const monthElements: Record<string, Element> = {寅:"목",卯:"목",辰:"토",巳:"화",午:"화",未:"토",申:"금",酉:"금",戌:"토",亥:"수",子:"수",丑:"토"};
export const stemElement = (stem: string): Element => {
  const index = stems.indexOf(stem);
  if (index < 0) throw new Error("운의 천간을 확인해 주세요.");
  return elements[Math.floor(index / 2)];
};
export function flowParts(dayStem: string, ganji: string) {
  const hidden = FLOW_HIDDEN[ganji[1]];
  if (ganji.length !== 2 || !hidden) throw new Error("운의 간지를 확인해 주세요.");
  const shares = hidden.length === 1 ? [1] : hidden.length === 2 ? [.7, .3] : [.6, .3, .1];
  return [{stem:ganji[0], weight:10}, ...hidden.map((stem,i)=>({stem,weight:15*shares[i]}))]
    .map(p=>({...p,element:stemElement(p.stem),god:tenGod(dayStem,p.stem)}));
}

/** 공개한 원국 가중 규칙에 운을 추가한 비교. 사건 확률이나 명리의 공인 점수가 아니다. */
export function combineFlow(chart: SajuChart, ganji: string) {
  const natal = analyzeNatal(chart);
  const self = stemElement(chart.dayMaster.character);
  const resource = elements[(elements.indexOf(self)+4)%5];
  const seasonIndex = elements.indexOf(monthElements[chart.pillars[1].branch]);
  const factor = (e: Element) => [1.5,1.2,.6,.8,1][(elements.indexOf(e)-seasonIndex+5)%5];
  const parts = flowParts(chart.dayMaster.character,ganji);
  const total = natal.strength.contributions.reduce((sum,p)=>sum+p.base*p.seasonalFactor,0);
  const support = natal.strength.contributions.filter(p=>p.supports).reduce((sum,p)=>sum+p.base*p.seasonalFactor,0);
  const incomingTotal = parts.reduce((sum,p)=>sum+p.weight*factor(p.element),0);
  const incomingSupport = parts.filter(p=>[self,resource].includes(p.element)).reduce((sum,p)=>sum+p.weight*factor(p.element),0);
  const before = support/total*100;
  const after = (support+incomingSupport)/(total+incomingTotal)*100;
  const balanceGain = Math.abs(before-50)-Math.abs(after-50);
  const improves = balanceGain > .5;
  const hasRoot = natal.strength.roots.length > 0;
  const hasClimate = natal.useful.climate.element && parts.some(p=>p.element===natal.useful.climate.element);
  const exposed = parts.filter(p=>chart.pillars.some(n=>n.stem===p.stem)).map(p=>p.stem);
  const rule = selectContextualRule(natal, parts);
  const { opportunity, risk, action } = rule;
  const facts = [
    {id:"natal_season",text:`원국 월주 ${chart.pillars[1].text}, 일간 ${chart.dayMaster.character}. 월령을 반영한 생조 비중 ${before.toFixed(1)}%.`},
    {id:"natal_roots",text:`일간과 같은 오행의 뿌리: ${hasRoot?natal.strength.roots.map(p=>`${p.label} ${p.branch}`).join(", "):"없음"}.`},
    {id:"flow_parts",text:`${ganji}: ${parts.map(p=>`${p.stem} ${p.god} (${p.weight})`).join(", ")}.`},
    {id:"flow_balance",text:`같은 월령 가중 규칙으로 운을 더한 생조 비중 ${after.toFixed(1)}%, 균형 거리 변화 ${balanceGain.toFixed(2)}.`},
    {id:"flow_exposed",text:`운의 글자 중 원국 천간에 드러난 글자: ${[...new Set(exposed)].join("·")||"없음"}.`},
    {id:"flow_climate",text:natal.useful.climate.text+` 해당 운에 보완 오행 ${hasClimate?"있음":"없음"}.`},
  ];
  const reason = `${chart.pillars[1].korean} 월주의 계절과 ${chart.dayMaster.korean}${self}의 뿌리를 함께 보면, ${hasRoot?"자기 기운을 받쳐 주는 자리가 있고":"자기 기운의 뿌리를 보충할 조건을 살펴야 하며"} ${ganji} 운은 ${improves?"원국의 치우침을 덜어 주는":"원래 강조되던 역할을 다시 조정하는"} 방향으로 읽힙니다.${hasClimate?` 계절의 ${natal.useful.climate.element} 보완도 함께 살필 수 있습니다.`:""}${exposed.length?" 원국에 드러난 글자가 운에서도 이어져 익숙한 방식의 활용을 살핍니다.":""}`;
  return {version:FLOW_RULE_VERSION,parts,before,after,balanceGain,comparable:!natal.strength.sensitive&&!natal.strength.exceptional,
    rule,improves,hasRoot,hasClimate,exposed:[...new Set(exposed)],opportunity,risk,action,reason,facts};
}
export type FlowCombination = ReturnType<typeof combineFlow>;
