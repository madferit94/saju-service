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
    const season=seasonForGod(flow.stemGod),branchSeason=seasonForGod(branchGod);
    const secondarySeason=branchSeason!==season ? branchSeason : undefined;
    const reason=`${p.korean}(${p.ganji}) 대운의 앞글자는 ${flow.stemGod}(${godPlain[flow.stemGod]}), 아래글자의 중심은 ${branchGod}(${godPlain[branchGod]})으로 읽습니다. ${SEASONS[season].label}은 앞글자의 주제이며${secondarySeason?` 아래글자에는 ${SEASONS[secondarySeason].label}의 주제도 함께 있습니다.`:" 두 글자의 계절 주제가 같습니다."}`;
    const childhood=forLifeStage(flow,Math.min(p.endAge,19));
    const isChild=p.endAge<20,spansAdulthood=p.startAge<20 && p.endAge>=20;
    const reading=isChild?childhood:flow;
    return {...p,season,seasonLabel:SEASONS[season].label,secondarySeason,stemGod:flow.stemGod,branchGod,reason,
      opportunity:spansAdulthood?`20세 전에는 ${childhood.opportunity} 20세 이후에는 ${flow.opportunity}`:reading.opportunity,
      risk:spansAdulthood?`20세 전에는 ${childhood.risk} 20세 이후에는 ${flow.risk}`:reading.risk,
      action:spansAdulthood?`20세 전에는 ${childhood.action} 20세 이후에는 ${flow.action}`:reading.action,
      evidence:flow.evidence};
  });
  const active=periods.find(p=>p.startYear<=timeline.currentYear && timeline.currentYear<=p.endYear);
  const current=active ? {
    periodIndex:active.index,currentYear:timeline.currentYear,startYear:active.startYear,endYear:active.endYear,
    progress:(timeline.currentYear-active.startYear+.5)/(active.endYear-active.startYear+1),
    season:active.season,seasonLabel:active.seasonLabel,
  } : null;
  const preDaewoon=!current && timeline.periods.some(p=>p.index===0 && p.startYear<=timeline.currentYear && timeline.currentYear<=p.endYear);
  return {periods,current,preDaewoon,
    method:"네 기둥에서 나를 나타내는 글자와 각 대운의 앞글자·아래글자 중심 글자 사이의 십성을 비교합니다. 앞글자의 주제를 대표 계절로, 다른 아래글자의 주제는 함께 오는 계절로 표시합니다. 봄·여름·가을·겨울은 반복되거나 순서를 건너뛸 수 있습니다. 그래프의 위아래는 운의 좋고 나쁨, 점수, 성취 확률이나 수명을 뜻하지 않습니다. 실제 경험과 환경을 함께 비교해 읽어 주세요."};
}
export type LifeSeasonsReport = ReturnType<typeof buildLifeSeasons>;
