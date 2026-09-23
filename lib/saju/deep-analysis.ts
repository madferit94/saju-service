import type { SajuChart } from "./chart";
import { tenGod } from "./fortune";

export const ANALYSIS_VERSION = 1 as const;
const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const ko = [..."갑을병정무기경신임계"];
const cycle = ["목", "화", "토", "금", "수"] as const;
export type Element = typeof cycle[number];
const hidden: Record<string, string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"], 辰: ["戊", "乙", "癸"], 巳: ["丙", "庚", "戊"],
  午: ["丁", "己"], 未: ["己", "丁", "乙"], 申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};
const season: Record<string, Element> = { 寅: "목", 卯: "목", 辰: "토", 巳: "화", 午: "화", 未: "토", 申: "금", 酉: "금", 戌: "토", 亥: "수", 子: "수", 丑: "토" };
const roots = ["寅", "卯", "巳", "午", "巳", "午", "申", "酉", "亥", "子"];
const blades: Record<string, string> = { 甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子" };
const elem = (stem: string) => cycle[Math.floor(stems.indexOf(stem) / 2)];
const gloss = (stem: string) => `${stem}(${ko[stems.indexOf(stem)]})`;
const round = (n: number) => Math.round(n * 10) / 10;
const classify = (n: number) => n < 40 ? "신약 경향" : n > 60 ? "신강 경향" : "중화 범위";

export function analyzeNatal(chart: SajuChart) {
  const dm = chart.dayMaster.character;
  const self = elem(dm), selfIndex = cycle.indexOf(self), resource = cycle[(selfIndex + 4) % 5];
  const month = chart.pillars[1];
  const seasonal = season[month.branch];
  if (!self || !seasonal || chart.pillars.length !== 4 || chart.pillars.some(p => !hidden[p.branch] || !stems.includes(p.stem))) throw new Error("심층 분석에 필요한 원국을 확인해 주세요.");
  const seasonIndex = cycle.indexOf(seasonal);
  const factor = (e: Element) => [1.5, 1.2, 0.6, 0.8, 1][(cycle.indexOf(e) - seasonIndex + 5) % 5];
  const contributions = chart.pillars.flatMap((p, index) => {
    const hiddenStems = hidden[p.branch];
    const shares = hiddenStems.length === 1 ? [1] : hiddenStems.length === 2 ? [.7, .3] : [.6, .3, .1];
    const parts = hiddenStems.map((stem, i) => ({ pillar: p.label, source: `${p.branch}(${p.korean[1]}) 속 ${gloss(stem)}`, element: elem(stem), base: [10, 30, 15, 10][index] * shares[i], monthly: index === 1, god: tenGod(dm, stem) }));
    if (index !== 2) parts.unshift({ pillar: p.label, source: `천간 ${gloss(p.stem)}`, element: elem(p.stem), base: 10, monthly: false, god: tenGod(dm, p.stem) });
    return parts.map(part => ({ ...part, seasonalFactor: factor(part.element), weight: round(part.base * factor(part.element)), supports: part.element === self || part.element === resource }));
  });
  const ratio = (monthScale: number, seasonalWeight: boolean) => {
    const sum = contributions.reduce((acc, p) => {
      const amount = p.base * (p.monthly ? monthScale : 1) * (seasonalWeight ? p.seasonalFactor : 1);
      return { all: acc.all + amount, support: acc.support + (p.supports ? amount : 0) };
    }, { all: 0, support: 0 });
    return round(100 * sum.support / sum.all);
  };
  const score = ratio(1, true), variants = [score, ratio(.8, true), ratio(1.2, true), ratio(1, false)];
  const baseLabel = classify(score);
  const sensitive = variants.some(value => classify(value) !== baseLabel);
  const exceptional = score < 15 || score > 85;
  const label = exceptional ? "일반 강약 판정 보류" : sensitive ? "강약 경계 · 기준에 따라 달라짐" : baseLabel;
  const rootDetails = chart.pillars.map(p => ({ label: p.label, branch: p.branch, matches: hidden[p.branch].filter(s => elem(s) === self).map(gloss) })).filter(p => p.matches.length);
  const supportive = contributions.filter(p => p.supports).sort((a,b) => b.weight-a.weight);
  const draining = contributions.filter(p => !p.supports).sort((a,b) => b.weight-a.weight);
  const facts: { id: string; text: string }[] = [
    { id: "strength_season", text: `월지 ${month.branch}(${month.korean[1]})는 비교 규칙에서 ${seasonal} 계절로 처리합니다. 일간은 ${gloss(dm)} ${self}, 생조 오행은 ${self}·${resource}입니다. 사계월 토는 계절 말의 단순화입니다.` },
    { id: "strength_ratio", text: `생조 가중 비율 ${score}%, 민감도 비교 범위 ${Math.min(...variants)}~${Math.max(...variants)}%. ${label}. 실제 확률이나 전통의 공인 점수가 아닌 서비스 비교 지표입니다.` },
    { id: "strength_roots", text: rootDetails.length ? `같은 오행의 뿌리: ${rootDetails.map(r => `${r.label} ${r.branch} 속 ${r.matches.join("·")}`).join(", ")}. 뿌리의 존재와 실제 힘의 크기는 같지 않습니다.` : `지장간에서 일간 ${self}와 같은 오행의 뿌리가 보이지 않습니다. 이것만으로 종격이나 무력함을 확정하지 않습니다.` },
    { id: "strength_support", text: "도움 쪽의 큰 근거: " + (supportive.slice(0,3).map(p => `${p.pillar} ${p.source} ${p.god}`).join(", ") || "비견·겁재·인성 항목 없음") },
    { id: "strength_pressure", text: "소모·통제 쪽의 큰 근거: " + (draining.slice(0,3).map(p => `${p.pillar} ${p.source} ${p.god}`).join(", ") || "식상·재성·관성 항목 없음") },
  ];
  const visible = chart.pillars.filter((_,i) => i !== 2);
  const monthlyStems = hidden[month.branch];
  const exposed = monthlyStems.filter(stem => visible.some(p => p.stem === stem));
  const selected = exposed.length ? exposed : [monthlyStems[0]];
  const special = roots[stems.indexOf(dm)] === month.branch ? "건록" : blades[dm] === month.branch ? "양인" : null;
  const candidates = special ? [{ name: `${special}격 후보`, stem: monthlyStems[0], god: tenGod(dm,monthlyStems[0]), reason: `일간 ${gloss(dm)}의 ${special} 조건에 월지 ${month.branch}(${month.korean[1]})가 해당합니다. 다른 글자와의 조합을 확인해야 합니다.` }] : selected.map(stem => ({
    name: ["비견", "겁재"].includes(tenGod(dm,stem)) ? "월겁 계열 검토" : `${tenGod(dm,stem)}격 후보`, stem, god: tenGod(dm,stem),
    reason: `${gloss(stem)}는 월지의 ${stem === monthlyStems[0] ? "본기" : "다른 지장간"}이며 ` + (exposed.includes(stem) ? `${visible.filter(p=>p.stem===stem).map(p=>p.label).join("·")} 천간에도 드러납니다(투간).` : "일간을 제외한 천간에 투간하지 않아 월지 본기 기준의 잠정 후보입니다."),
  }));
  const patternNote = "월령 중심의 격국 후보입니다. 합화·형파해와 특수격, 성격·파격의 성립은 확정하지 않습니다. 복수 투간이면 후보를 함께 비교합니다.";
  facts.push({ id:"pattern_month",text:candidates.map(c=>`${c.name}: ${c.reason}`).join(" ") });
  facts.push({ id:"pattern_limits",text:patternNote });
  const withheld = exceptional || sensitive || baseLabel === "중화 범위";
  const favorable: Element[] = withheld ? [] : baseLabel === "신약 경향" ? [resource,self] : [cycle[(selfIndex+1)%5],cycle[(selfIndex+2)%5],cycle[(selfIndex+3)%5]];
  const balancing = favorable.map(e => ({ element:e, reason: baseLabel === "신약 경향" ? `${e}는 ${e===self ? "같은 기운을 보태는 비겁" : "일간을 생하는 인성"} 관점의 후보입니다. 이미 과한 도움이나 다른 관계의 부담도 함께 확인합니다.` : `${e}는 ${e===cycle[(selfIndex+1)%5] ? "표현·생산으로 힘을 쓰는 식상" : e===cycle[(selfIndex+2)%5] ? "자원을 운용하는 재성" : "책임·규칙으로 힘을 조절하는 관성"} 관점의 후보입니다. 원국에서 실제로 작용할 조건을 비교해야 합니다.` }));
  const climate = ["亥","子","丑"].includes(month.branch) ? { element:"화",text:"겨울 월지이므로 온기를 살피는 조후 관점에서 화를 검토합니다. 화가 무조건 최종 용신이라는 뜻은 아니며 원국의 수·화와 건습 조건을 함께 봅니다." } : ["巳","午","未"].includes(month.branch) ? {element:"수",text:"여름 월지이므로 열기를 조절하는 조후 관점에서 수를 검토합니다. 수가 무조건 최종 용신이라는 뜻은 아니며 원국의 수·화와 건습 조건을 함께 봅니다."} : {element:null,text:"이번 간이 계절 규칙만으로 조후 오행을 한 가지로 정하지 않습니다. 천간별 상세 조후표와 건습은 별도 검토 대상입니다."};
  const reason = exceptional ? "기운이 한쪽에 몰려 종격·전왕격 등 별도 검토가 필요합니다. 일반적인 강약의 반대 오행을 자동 용신으로 지정하지 않습니다." : sensitive ? "월지 가중치나 계절 적용을 바꾸면 강약 범주가 달라져 용신을 하나로 정하지 않습니다." : baseLabel === "중화 범위" ? "생조와 소모·통제가 비교 규칙의 중간 범위에 있어 특정 오행을 자동 용신으로 정하지 않습니다." : "억부 관점의 후보를 제시합니다. 격국의 용신과 조후의 보완 방향은 별도 관점이며 자동으로 하나로 합치지 않습니다.";
  facts.push({id:"useful_balance",text:reason+" "+balancing.map(c=>`${c.element}: ${c.reason}`).join(" ")});
  facts.push({id:"useful_climate",text:climate.text});
  return {
    version: ANALYSIS_VERSION, strength: { label, baseLabel, score, range:[Math.min(...variants),Math.max(...variants)], sensitive, exceptional, roots:rootDetails, contributions },
    pattern:{candidates,note:patternNote}, useful:{status:withheld ? "판정 보류" : "조건부 후보",candidates:balancing,reason,climate}, facts,
    method:"서비스 비교 규칙 v1 · 천간 각10(일간 제외), 지지 년10/월30/일15/시10, 지장간 1개100%·2개70/30%·3개60/30/10%, 계절 왕상휴수사 1.5/1.2/1/0.8/0.6. 생조40% 미만/60% 초과를 신약/신강 경향으로 표시하며 민감도·특수격 후보는 보류합니다. 전문가 감수 전의 휴리스틱으로 전통의 공인 점수나 미래 정확도를 뜻하지 않습니다.",
  };
}

export type DeepAnalysis = ReturnType<typeof analyzeNatal>;
