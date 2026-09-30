import { calculateBenefactors } from "./benefactors";
import type { SajuChart } from "./chart";
import { analyzeNatal } from "./deep-analysis";
import { validateNoCertainPrediction } from "./reading-quality";

export type SajuStar = {
  id: string; name: string; category: "귀인" | "신살" | "참고 표지";
  meaning: string; basis: string; targets: string[];
  status: "matched" | "absent" | "not-applicable";
  matches: {pillar:string;character:string;bases:string[]}[];
  flowMatches: {label:string;ganji:string;bases:string[]}[];
  interpretation: string; opportunity:string; caution:string; action:string;
};
type Rule = {id:string;name:string;category:SajuStar["category"];meaning:string;basis:string;
  conditions:{target:string;part:"stem"|"branch";base:string;exclude?:number}[];
  opportunity:string;caution:string;action:string};
const virtues = [..."丁申壬辛亥甲癸寅丙乙巳庚"];
const months = [..."寅卯辰巳午未申酉戌亥子丑"];
const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const blades: Record<string,string> = {甲:"卯",丙:"午",戊:"午",庚:"酉",壬:"子"};
const roots = [..."寅卯巳午巳午申酉亥子"];
const trines = ["申子辰","寅午戌","巳酉丑","亥卯未"];
const practices = [
  ["도움을 주고받는 관계를 살펴볼 수 있습니다.","도움이 저절로 온다고 기다리거나 상대에게 판단을 맡기지 마세요.","막힌 과제 하나를 정리해 믿을 만한 사람에게 구체적인 피드백을 요청해 보세요."],
  ["배운 내용을 깊이 이해하고 자기 언어로 정리하는 데 활용할 수 있습니다.","생각을 정리하는 시간이 실행을 계속 미루는 이유가 되는지 살펴보세요.","관심 있는 주제를 짧게 기록한 뒤 실제로 시험할 행동 하나를 정해 보세요."],
  ["배움과 표현을 연결하는 연습에 활용할 수 있습니다.","잘 설명하는 것과 실제로 해낼 수 있는 것을 구별하세요.","배운 내용을 다른 사람에게 설명하고 이해하기 어려웠던 부분을 수정해 보세요."],
  ["관계에서 서로의 입장을 조율하는 방식을 살펴볼 수 있습니다.","갈등을 덮어 두거나 자신의 몫까지 양보하는지 확인하세요.","의견이 다른 사람과 원하는 것과 맡을 일을 각각 적어 보세요."],
];

/** Spec043: 원국 기준을 운에도 고정한다. 별 개수를 길흉 점수로 쓰지 않는다. */
export function calculateStars(chart:SajuChart, flows:{label:string;ganji:string}[] = []):SajuStar[] {
  const natal = analyzeNatal(chart);
  const day = chart.pillars[2].stem, month = chart.pillars[1].branch;
  const legacy = calculateBenefactors(chart);
  const rules:Rule[] = legacy.map((b,i)=>({
    id:["star_tianyi","star_taiji","star_wenchang","star_yuede"][i], name:b.name,category:"귀인",meaning:b.description,basis:b.basis,
    conditions:b.targets.map(target=>({target,part:i===3?"stem":"branch",base:b.basis})),
    opportunity:practices[i][0],caution:practices[i][1],action:practices[i][2],
  }));
  const virtue = virtues[months.indexOf(month)];
  rules.push({id:"star_tiande",name:"천덕귀인",category:"귀인",meaning:"갈등을 완충하고 도움을 연결하는 가능성을 살피는 전통 표지입니다.",
    basis:`월지 ${month} 기준 · ${stems.includes(virtue)?"천간":"지지"} ${virtue}. 사중월은 연해자평의 申·亥·寅·巳 해석을 사용하며 판본에 따라 다릅니다.`,
    conditions:[{target:virtue,part:stems.includes(virtue)?"stem":"branch",base:`월지 ${month}`}],
    opportunity:"문제가 커지기 전에 조언과 중재를 구하는 데 활용할 수 있습니다.",caution:"어려움이 자동으로 사라지거나 보호받는다는 뜻은 아닙니다.",action:"혼자 결론 내리기 어려운 일은 믿을 만한 사람에게 상황과 선택지를 함께 설명해 보세요."});
  const branchRules = [
    {id:"star_yima",name:"역마살",targets:[..."寅申亥巳"],meaning:"이동·환경 변화·새로운 접점을 살피는 표지입니다.",opportunity:"새로운 환경을 경험하며 선택의 폭을 넓히는 데 활용할 수 있습니다.",caution:"이동 자체가 성과를 보장하지 않으며 변화가 잦으면 마무리가 어려울 수 있습니다.",action:"환경을 크게 바꾸기 전에 짧은 체험으로 적응 조건을 확인해 보세요."},
    {id:"star_taohua",name:"도화살",targets:[..."酉卯午子"],meaning:"함지라고도 하며 표현·주목·사회적 접점을 살피는 표지입니다.",opportunity:"생각을 드러내고 사람과 연결되는 방식을 연습할 수 있습니다.",caution:"인기·연애·혼인 결과나 성품을 확정하는 표지가 아닙니다.",action:"표현하고 싶은 것과 공개하지 않을 경계를 먼저 정한 뒤 작은 모임에서 의견을 나눠 보세요."},
    {id:"star_huagai",name:"화개살",targets:[..."辰戌丑未"],meaning:"몰입·성찰·자기만의 관심사를 살피는 표지입니다.",opportunity:"한 주제를 꾸준히 탐구하고 완성하는 데 활용할 수 있습니다.",caution:"혼자 몰입하는 것이 관계 단절이나 특별한 재능을 뜻하지는 않습니다.",action:"혼자 정리하는 시간 뒤에 결과를 한 사람과 공유하는 시간을 붙여 보세요."},
  ];
  for (const r of branchRules) rules.push({...r,category:"신살",basis:"년지 기준을 주로, 일지 기준을 보조로 대조합니다. 각 기준 자리 자체는 제외합니다.",
    conditions:[0,2].map(index=>({target:r.targets[trines.findIndex(group=>group.includes(chart.pillars[index].branch))],part:"branch",base:`${index===0?"년지 주기준":"일지 보조기준"} ${chart.pillars[index].branch}`,exclude:index}))});
  rules.push({id:"star_yangren",name:"양인살",category:"신살",meaning:"자기 주도성과 힘을 조절하는 조건을 살피는 표지입니다.",basis:`일간 ${day} 기준. 양간 甲·丙·戊·庚·壬만 판정하는 자평 규칙입니다.`,
    conditions:blades[day]?[{target:blades[day],part:"branch",base:`일간 ${day}`}]:[],opportunity:"스스로 방향을 정하고 밀고 나가는 방식을 살펴볼 수 있습니다.",caution:"추진력이 충돌로 이어지는 조건을 확인해야 하며 사고·폭력·질병을 예언하지 않습니다.",action:"중요한 결정을 실행하기 전에 다른 사람의 의견을 한 번 듣고 수정할 조건을 정해 보세요."});
  rules.push({id:"star_jianlu",name:"건록",category:"참고 표지",meaning:"독립적으로 맡은 일을 꾸준히 해내는 기반을 살피는 표지입니다. 건록이 있다고 건록격을 확정하지 않습니다.",basis:`일간 ${day} 기준 · 지지 ${roots[stems.indexOf(day)]}. 월지 건록격 판단과 구별합니다.`,
    conditions:[{target:roots[stems.indexOf(day)],part:"branch",base:`일간 ${day}`}],opportunity:"자신의 역할과 반복 습관을 세우는 데 활용할 수 있습니다.",caution:"독립성을 혼자 모든 일을 해야 한다는 뜻으로 받아들이지 마세요.",action:"스스로 맡을 일과 도움을 구할 일을 나누고 반복할 수 있는 작은 일정을 정해 보세요."});
  const condition = natal.strength.sensitive || natal.strength.exceptional
    ? "강약 판정이 달라질 수 있는 원국이므로 독립과 협업 중 하나를 정답으로 정하지 않고 실제 경험을 비교합니다."
    : natal.strength.baseLabel === "신약 경향" ? "도움과 준비가 필요한 쪽으로 읽히므로 역할을 늘리기 전에 함께할 사람과 익힐 시간을 확보하는 조건을 우선합니다."
    : natal.strength.baseLabel === "신강 경향" ? "자기 힘을 표현하고 조율하는 쪽을 검토하므로 혼자 결정하기보다 결과를 나누고 피드백을 받는 조건을 우선합니다."
    : "생조와 소모가 비교적 균형을 이루므로 어느 한쪽을 더하기보다 현재 맡은 역할과 부담을 함께 확인합니다.";
  return rules.map(r=>{
    const matches = chart.pillars.flatMap((p,index)=>{
      const hits = r.conditions.filter(c=>c.exclude!==index && p[c.part]===c.target);
      return hits.length?[{pillar:p.label,character:[...new Set(hits.map(h=>h.target))].join("·"),bases:hits.map(h=>h.base)}]:[];
    });
    const flowMatches = flows.flatMap(f=>{
      if (!/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(f.ganji)) return [];
      const hits = r.conditions.filter(c=>f.ganji[c.part==="stem"?0:1]===c.target);
      return hits.length?[{...f,bases:hits.map(h=>h.base)}]:[];
    });
    const status = !r.conditions.length?"not-applicable":matches.length?"matched":"absent";
    return {id:r.id,name:r.name,category:r.category,meaning:r.meaning,basis:r.basis,targets:[...new Set(r.conditions.map(c=>c.target))],status,matches,flowMatches,
      interpretation:status==="matched"?`${matches.map(m=>`${m.pillar} ${m.character}`).join("·")}에서 확인됩니다. 태어난 달 ${month}와 지장간의 뿌리를 함께 비교한 결과, ${condition}`:status==="not-applicable"?"선택한 규칙의 판정 대상이 아닙니다. 다른 학파의 음간 양인 규칙과 구별합니다.":"이 규칙에서 원국에 일치하는 자리는 없습니다. 이 표지가 없다는 이유로 해당 능력이나 기회가 없다고 읽지 않습니다.",
      opportunity:r.opportunity,caution:r.caution,action:r.action};
  });
}

export function validateStarReading(reading:{starReading?:string;starEvidenceIds?:string[]}, stars:SajuStar[]) {
  const expected = stars.filter(s=>s.status==="matched").map(s=>s.id);
  const ids = reading.starEvidenceIds;
  if (typeof reading.starReading!=="string" || reading.starReading.trim().length<8 || reading.starReading.length>2400 || !Array.isArray(ids) || new Set(ids).size!==ids.length || ids.length!==expected.length || ids.some(id=>!expected.includes(id))) {
    throw new Error(`귀인·신살 종합 해석과 실제 원국 표지 ID만 필요합니다: ${expected.join(",") || "빈 배열"}`);
  }
  // This field discusses natal possession only; absent stars and flow-only stars have separate UI details.
  if (stars.some(s=>s.status!=="matched" && reading.starReading!.includes(s.name))) throw new Error("신살 종합 항목에는 원국에 실제 일치한 표지만 언급하세요.");
  validateNoCertainPrediction(reading.starReading);
}
