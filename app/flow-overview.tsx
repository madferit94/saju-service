"use client";
import { useMemo, useState } from "react";
import type { SajuChart } from "../lib/saju/chart";
import type { DaewoonTimeline } from "../lib/saju/daewoon";
import type { buildFortuneReport } from "../lib/saju/fortune";
import { tenGod } from "../lib/saju/fortune";
import { annualPillars, calendarDays } from "../lib/saju/manse";

function Cycle({ganji,korean}:{ganji:string;korean:string}) {
  return <span className="cycle-letters"><b>{korean[0]}<small>{ganji[0]}</small></b><b>{korean[1]}<small>{ganji[1]}</small></b></span>;
}
export default function FlowOverview({chart,timeline,report,onYear,disabled}:{chart:SajuChart;timeline:DaewoonTimeline;report:ReturnType<typeof buildFortuneReport>;onYear:(year:number)=>void;disabled:boolean}) {
  const [month,setMonth]=useState(new Date().getMonth()+1);
  const days=useMemo(()=>calendarDays(report.year,month),[report.year,month]);
  const years=useMemo(()=>annualPillars(report.year),[report.year]);
  function moveMonth(step:number) {
    if(month+step<1) { onYear(report.year-1); setMonth(12); }
    else if(month+step>12) { onYear(report.year+1); setMonth(1); }
    else setMonth(month+step);
  }
  return <section className="flow-overview" id="flow-overview" aria-labelledby="flow-overview-title"><p className="result-label">큰 흐름에서 하루까지</p><h2 id="flow-overview-title">시간에 따라 달라지는 운</h2>
    <h3>10년의 흐름 <small>대운</small></h3><p className="method-help">첫 대운 {timeline.firstStartDate} 시작 · 카드를 고르면 해당 시기의 연운과 월운을 볼 수 있습니다. 좌우로 이동해 더 보세요.</p>
    <div className="cycle-strip" tabIndex={0} role="region" aria-label="대운 시간표">{timeline.periods.filter(p=>p.ganji).map(p=><button type="button" className="cycle-card" key={p.index} disabled={disabled||p.startYear>2100} aria-pressed={p.startYear<=report.year&&report.year<=p.endYear} onClick={()=>onYear(Math.max(1990,p.startYear))}><span>{p.startAge}–{p.endAge}세</span><small>{p.startYear}–{p.endYear}</small><Cycle ganji={p.ganji} korean={p.korean}/><span>{tenGod(chart.dayMaster.character,p.ganji[0])}</span></button>)}</div>
    <h3>한 해의 흐름 <small>연운</small></h3><div className="cycle-strip" tabIndex={0} role="region" aria-label="연운 시간표">{years.map(p=><button type="button" className="cycle-card" key={p.year} disabled={disabled} aria-pressed={p.year===report.year} onClick={()=>onYear(p.year)}><span>{p.year}년</span><Cycle ganji={p.ganji} korean={p.korean}/><span>{tenGod(chart.dayMaster.character,p.ganji[0])}</span></button>)}</div>
    <p className="method-help">연운은 입춘부터 바뀝니다. 아래 월운과 상세 풀이도 {report.year}년을 기준으로 표시됩니다.</p>
    <h3>한 달의 흐름 <small>월운</small></h3><div className="cycle-strip" tabIndex={0} role="region" aria-label="월운 시간표">{report.months.map(p=><button type="button" className="cycle-card" key={p.month} aria-pressed={p.month===month} onClick={()=>setMonth(p.month)}><span>{p.month}월</span><Cycle ganji={p.ganji} korean={p.korean}/><span>{p.stemGod}</span></button>)}</div>
    <p className="method-help">월운은 매월 1일이 아니라 해당 절기부터 적용됩니다. 정확한 시작 시각과 풀이: 아래 ‘{report.year}년 · 월별운’에서 확인하세요.</p>
    <section className="daily-calendar" aria-labelledby="calendar-title"><div className="calendar-heading"><button type="button" className="secondary-button" aria-label="이전 달" disabled={disabled||(report.year===1990&&month===1)} onClick={()=>moveMonth(-1)}>←</button><div><p className="result-label">하루의 간지 · 일진</p><h3 id="calendar-title">{report.year}년 {month}월</h3></div><button type="button" className="secondary-button" aria-label="다음 달" disabled={disabled||(report.year===2100&&month===12)} onClick={()=>moveMonth(1)}>→</button></div>
      <table><caption className="sr-only">{report.year}년 {month}월 날짜별 간지</caption><thead><tr>{["일","월","화","수","목","금","토"].map(d=><th scope="col" key={d}>{d}</th>)}</tr></thead><tbody>{Array.from({length:Math.ceil((days[0].weekday+days.length)/7)},(_,week)=><tr key={week}>{Array.from({length:7},(_,weekday)=>{const d=days[week*7+weekday-days[0].weekday]; return <td key={weekday}>{d&&<><b>{d.day}</b><span>{d.korean}</span><small>{d.ganji}</small></>}</td>;})}</tr>)}</tbody></table><p className="method-help">양력 날짜의 정오를 기준으로 표시한 간지입니다. 출생지 시각 보정, 길일·흉일 판정은 적용하지 않습니다.</p>
    </section>
  </section>;
}
