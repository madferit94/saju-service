import lunar from "lunar-javascript";
import type { SajuChart } from "./chart";
import { analyzeFlow, koreanGanji, tenGod } from "./fortune";

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
// lunar-javascript 1.7.7 EightChar._getDiShi: 양간 순행, 음간 역행.
const offsets = [1, 6, 10, 9, 10, 9, 7, 0, 4, 3];
const stages = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
export const ELEMENT_NAMES: Record<string,string> = {목:"나무",화:"불",토:"흙",금:"금속",수:"물"};
export const GOD_MEANINGS: Record<string,string> = {비견:"나의 기준 · 동료",겁재:"경쟁 · 함께 쓰는 자원",식신:"꾸준히 만들고 익히기",상관:"표현 · 새로운 제안",편재:"새 기회 · 자원 운용",정재:"생활비 · 꾸준한 관리",편관:"어려운 책임 · 압박",정관:"규칙 · 신뢰 · 평가",편인:"탐구 · 다른 관점",정인:"배움 · 주변의 도움"};
export function twelveStage(dayStem:string, branch:string) {
  const s=stems.indexOf(dayStem), b=branches.indexOf(branch);
  if(s<0 || b<0) throw new Error("12운성의 천간과 지지를 확인해 주세요.");
  return stages[(offsets[s]+(s%2===0?b:-b)+12)%12];
}
export function buildManse(chart:SajuChart) {
  const godCounts = Object.fromEntries(Object.keys(GOD_MEANINGS).map(g=>[g,0]));
  const pillars=chart.pillars.map(p=> {
    const flow=analyzeFlow(chart,p.text,p.label);
    const branchGod=flow.hiddenStems[0].god;
    godCounts[flow.stemGod]++; godCounts[branchGod]++;
    return {...p,stemGod:flow.stemGod,branchGod,hiddenStems:flow.hiddenStems,stage:twelveStage(chart.dayMaster.character,p.branch)};
  }).reverse();
  return {pillars,
    elements:Object.entries(chart.elements).map(([name,count])=>({name,count,percent:count*12.5})),
    gods:Object.entries(godCounts).map(([name,count])=>({name,count,percent:count*12.5})),
  };
}
export function calendarDays(year:number,month:number) {
  if(!Number.isInteger(year)||year<1990||year>2100||!Number.isInteger(month)||month<1||month>12) throw new Error("달력의 연도와 월을 확인해 주세요.");
  return Array.from({length:new Date(Date.UTC(year,month,0)).getUTCDate()},(_,i)=>{
    const day=i+1;
    const ganji=lunar.Solar.fromYmdHms(year,month,day,12,0,0).getLunar().getEightChar().getDay();
    return {day,weekday:new Date(Date.UTC(year,month-1,day)).getUTCDay(),ganji,korean:koreanGanji(ganji)};
  });
}
export function annualPillars(year:number) {
  return Array.from({length:9},(_,i)=>year-4+i).filter(y=>y>=1990&&y<=2100).map(y=>{
    const ganji=lunar.Solar.fromYmdHms(y,6,15,12,0,0).getLunar().getEightChar().getYear();
    return {year:y,ganji,korean:koreanGanji(ganji)};
  });
}
