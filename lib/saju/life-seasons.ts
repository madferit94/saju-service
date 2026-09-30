import lunar from "lunar-javascript";
import { flowParts } from "./flow-combination";
import type { SajuChart } from "./chart";
import type { DaewoonTimeline } from "./daewoon";
import { analyzeFlow, forLifeStage } from "./fortune";

export type LifeSeason = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Record<LifeSeason,{label:string;theme:string;description:string}> = {
  spring:{label:"봄",theme:"배움과 기반",description:"내 기준을 세우고 배우거나 도움을 모으는 주제가 앞에 옵니다."},
  summer:{label:"여름",theme:"표현과 실행",description:"익힌 것을 밖으로 보여 주고 결과물을 만들어 보는 주제가 앞에 옵니다."},
  autumn:{label:"가을",theme:"자원과 결실",description:"들어온 기회와 돈·시간 같은 자원을 나누고 지키는 주제가 앞에 옵니다."},
  winter:{label:"겨울",theme:"책임과 재정비",description:"규칙과 책임을 점검하고 오래 가는 방식을 다시 세우는 주제가 앞에 옵니다."},
};
const godSeason: Record<string,LifeSeason> = {
  비견:"spring",겁재:"spring",편인:"spring",정인:"spring",
  식신:"summer",상관:"summer",
  편재:"autumn",정재:"autumn",
  편관:"winter",정관:"winter",
};
const godPlain: Record<string,string> = {
  비견:"스스로 기준을 세우는 관계",겁재:"동료와 자원을 나누거나 경쟁하는 관계",
  편인:"새로운 방식을 배우고 탐구하는 관계",정인:"도움받고 기반을 쌓는 관계",
  식신:"익힌 것을 꾸준히 만들어 내는 관계",상관:"생각을 표현하고 기존 방식을 바꾸려는 관계",
  편재:"새로운 기회와 자원을 다루는 관계",정재:"꾸준한 수입과 생활 자원을 관리하는 관계",
  편관:"압박 속에서 어려운 책임을 맡는 관계",정관:"규칙·평가·공적 책임과 관계",
};
export function seasonForGod(god:string):LifeSeason {
  const season=godSeason[god];
  if(!season) throw new Error("대운의 십성을 4계절로 분류할 수 없습니다.");
  return season;
}

export function buildLifeSeasons(chart:SajuChart,timeline:DaewoonTimeline) {
  const periods=timeline.periods.filter(p=>p.ganji).map(p=>{
    const flow=analyzeFlow(chart,p.ganji,`${p.korean} 대운`);
    const branchGod=flow.hiddenStems[0]?.god;
    if(!branchGod) throw new Error("대운의 아래 글자에 담긴 관계를 확인할 수 없습니다.");
    const weights = {spring:0,summer:0,autumn:0,winter:0};
    for (const part of flowParts(chart.dayMaster.character,p.ganji)) weights[seasonForGod(part.god)] += part.weight;
    const ranked = (Object.keys(weights) as LifeSeason[]).sort((a,b)=>weights[b]-weights[a]);
    const season=ranked[0],branchSeason=ranked[1];
    const secondarySeason=weights[branchSeason]>0 ? branchSeason : undefined;
    const reason=`${p.korean}(${p.ganji}) 대운의 ${flow.stemGod}(${godPlain[flow.stemGod]})와 지장간의 ${flow.hiddenStems.map(h=>h.god).join("·")}을 함께 보면 ${SEASONS[season].theme}의 비중이 큽니다.${secondarySeason?` ${SEASONS[secondarySeason].theme}의 주제도 함께 있습니다.`:""} ${flow.combination.reason}`;
    const childhood=forLifeStage(flow,Math.min(p.endAge,19));
    const isChild=p.endAge<20,spansAdulthood=p.startAge<20 && p.endAge>=20;
    const later=forLifeStage(flow,Math.max(60,p.endAge));
    const isLater=p.startAge>=60,spansLater=p.startAge<60 && p.endAge>=60;
    const reading=isChild?childhood:isLater?later:flow;
    return {...p,season,seasonLabel:SEASONS[season].label,secondarySeason,stemGod:flow.stemGod,branchGod,reason,
      opportunity:spansAdulthood?`20세 전에는 ${childhood.opportunity} 20세 이후에는 ${flow.opportunity}`:spansLater?`60세 전에는 ${flow.opportunity} 60세 이후에는 ${later.opportunity}`:reading.opportunity,
      risk:spansAdulthood?`20세 전에는 ${childhood.risk} 20세 이후에는 ${flow.risk}`:spansLater?`60세 전에는 ${flow.risk} 60세 이후에는 ${later.risk}`:reading.risk,
      action:spansAdulthood?`20세 전에는 ${childhood.action} 20세 이후에는 ${flow.action}`:spansLater?`60세 전에는 ${flow.action} 60세 이후에는 ${later.action}`:reading.action,
      evidence:flow.evidence};
  });
  const active=periods.find(p=>p.startYear<=timeline.currentYear && timeline.currentYear<=p.endYear);
  const currentAge=active ? active.startAge+timeline.currentYear-active.startYear : null;
  const currentReading=active && currentAge!==null ? forLifeStage(analyzeFlow(chart,active.ganji,`${active.korean} 대운`),currentAge) : null;
  const annualGanji = lunar.Solar.fromYmdHms(timeline.currentYear,7,1,12,0,0).getLunar().getEightChar().getYear();
  const annual = active && currentAge!==null ? forLifeStage(analyzeFlow(chart,annualGanji,`${timeline.currentYear}년`,[{label:"현재 대운",ganji:active.ganji}]),currentAge) : null;
  const current=active ? {
    periodIndex:active.index,currentYear:timeline.currentYear,startYear:active.startYear,endYear:active.endYear,
    progress:(timeline.currentYear-active.startYear+.5)/(active.endYear-active.startYear+1),
    season:active.season,seasonLabel:active.seasonLabel,
    reason:active.reason, annualGanji, annualTheme:annual!.opportunity, annualAction:annual!.action,
    opportunity:currentReading!.opportunity,risk:currentReading!.risk,action:currentReading!.action,
  } : null;
  const preDaewoon=!current && timeline.periods.some(p=>p.index===0 && p.startYear<=timeline.currentYear && timeline.currentYear<=p.endYear);
  return {periods,current,preDaewoon,
    method:"네 기둥에서 나를 나타내는 글자와 각 대운의 앞글자·아래글자 중심 글자 사이의 십성을 비교합니다. 천간 10과 지장간 15의 십성 주제 비중으로 대표 계절을 정합니다. 같은 계절의 비중은 합하고 동점은 봄·여름·가을·겨울 순으로 표시하며 함께 오는 주제를 밝힙니다. 봄·여름·가을·겨울은 반복되거나 순서를 건너뛸 수 있습니다. 계절은 길흉 점수나 성취 확률이 아니며, 실제 경험과 환경을 함께 비교해 읽어 주세요."};
}
export type LifeSeasonsReport = ReturnType<typeof buildLifeSeasons>;
