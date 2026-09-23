import type { LifeSeasonsReport, LifeSeason } from "../lib/saju/life-seasons";
import { SEASONS } from "../lib/saju/life-seasons";

const order:LifeSeason[]=["spring","summer","autumn","winter"];
const levels:Record<LifeSeason,number>={spring:54,summer:118,autumn:182,winter:246};
const colors:Record<LifeSeason,string>={spring:"#4e8074",summer:"#bc6657",autumn:"#a37830",winter:"#526d91"};

export default function LifeSeasonsPanel({report}:{report:LifeSeasonsReport}) {
  const periods=report.periods;
  if(!periods.length) return <section className="life-seasons" id="life-seasons"><h2>나의 인생 4계절</h2><p>표시할 대운 구간이 없습니다.</p></section>;
  const first=periods[0].startYear,last=periods.at(-1)!.endYear+1;
  const x=(year:number)=>104+(year-first)/(last-first)*816;
  const path=periods.map((p,i)=>`${i===0?"M":"L"} ${x(p.startYear).toFixed(1)} ${levels[p.season]} L ${x(p.endYear+1).toFixed(1)} ${levels[p.season]}`).join(" ");
  const currentPeriod=report.current ? periods.find(p=>p.index===report.current!.periodIndex) : undefined;
  const currentX=report.current ? x(report.current.currentYear+.5) : null;
  const currentAge=currentPeriod && report.current ? currentPeriod.startAge+report.current.currentYear-currentPeriod.startYear : null;
  return <>
    <section className="life-graph-panel" id="life-graph" aria-labelledby="life-graph-heading">
    <p className="result-label">대운의 시간표</p><h2 id="life-graph-heading">나의 인생 그래프</h2>
    <p className="life-seasons-lead">대운의 변화를 시간순으로 그렸습니다. 세로 위치는 각 시기의 주제이며 높낮이가 운의 좋고 나쁨을 뜻하지 않습니다.</p>
    <div className="life-graph-wrap" role="region" aria-label="대운의 4계절 그래프, 좌우로 이동해 볼 수 있습니다" tabIndex={0}><svg viewBox="0 0 960 312" className="life-graph" role="img" aria-labelledby="life-graph-title life-graph-description">
      <title id="life-graph-title">대운별 인생 4계절과 현재 위치</title><desc id="life-graph-description">왼쪽부터 실제 대운 순서입니다. 위아래는 운의 좋고 나쁨이 아닌 서로 다른 삶의 주제입니다. 아래 카드에서 각 시기의 근거를 읽을 수 있습니다.</desc>
      {order.map(season=><g key={season}><line x1="104" x2="920" y1={levels[season]} y2={levels[season]} className="season-guide"/><text x="12" y={levels[season]+5} fill={colors[season]} className="season-axis">{SEASONS[season].label}</text></g>)}
      {periods.map((p,i)=><g key={p.index}><rect x={x(p.startYear)} y="20" width={x(p.endYear+1)-x(p.startYear)} height="251" fill={i%2===0?"#f7f4ee":"#ffffff"} fillOpacity="0.85"/><text x={x(p.startYear)+4} y="294" className="life-year-label">{p.startYear}</text></g>)}
      {order.map(season=><line key={season} x1="104" x2="920" y1={levels[season]} y2={levels[season]} className="season-guide"/>)}
      <path d={path} className="life-path"/>
      {periods.map(p=><circle key={p.index} cx={x((p.startYear+p.endYear+1)/2)} cy={levels[p.season]} r="7" fill={colors[p.season]} stroke="white" strokeWidth="3"/>)}
      {currentX!==null && currentPeriod && <g><line x1={currentX} x2={currentX} y1="20" y2="268" className="current-line"/><circle cx={currentX} cy={levels[currentPeriod.season]} r="12" fill={colors[currentPeriod.season]} stroke="white" strokeWidth="4"/><text x={currentX} y="16" textAnchor="middle" className="current-graph-label">지금</text></g>}
    </svg></div>
    <p className="method-help">가로축은 실제 대운이 시작하는 연도입니다. 세로축은 네 가지 삶의 주제이며, 선이 올라가거나 내려가는 것이 행운·성과·수명 점수는 아닙니다.</p>
    <p className="life-graph-link"><a href="#life-seasons">시기별 계절 풀이 보기</a></p>
    </section>
    <section className="life-seasons" id="life-seasons" aria-labelledby="life-seasons-title">
    <p className="result-label">대운마다 달라지는 삶의 주제</p><h2 id="life-seasons-title">나의 인생 4계절</h2>
    <p className="life-seasons-lead">대운마다 앞에 나오는 주제를 봄·여름·가을·겨울에 빗댔습니다. 같은 계절이 다시 올 수도 있습니다.</p>
    {report.current ? <div className={`season-current season-${report.current.season}`} role="status"><span>지금은 {report.current.seasonLabel} · {SEASONS[report.current.season].theme}</span><strong>{report.current.currentYear}년, 사주식 나이 {currentAge}세</strong><p>{currentPeriod?.startYear}~{currentPeriod?.endYear}년 대운의 {Math.round(report.current.progress*100)}% 지점입니다. {SEASONS[report.current.season].description}</p></div>
      : <div className="season-current" role="status"><strong>{report.preDaewoon?"아직 첫 대운이 시작되기 전입니다.":"현재 연도는 표시한 대운 범위 밖입니다."}</strong><p>이 구간의 계절을 임의로 정하지 않습니다. 태어난 바탕과 현재 생활을 먼저 살펴보세요.</p></div>}
    <div className="season-legend" aria-label="4계절의 뜻">{order.map(season=><span key={season} className={`season-${season}`}><i aria-hidden="true"/>{SEASONS[season].label} · {SEASONS[season].theme}</span>)}</div>
    <h3>내 대운을 하나씩 읽기</h3><div className="life-periods">{periods.map(p=><details key={p.index} open={p.index===report.current?.periodIndex} className={`life-period season-${p.season}`}>
      <summary><span className="life-period-season">{p.seasonLabel}{p.secondarySeason?` + ${SEASONS[p.secondarySeason].label}`:""}</span><strong>{p.startYear}~{p.endYear}년 · {p.startAge}~{p.endAge}세</strong><span>{p.korean}({p.ganji})</span>{p.index===report.current?.periodIndex&&<span className="current-badge">현재</span>}</summary>
      <div className="life-period-body"><p className="life-reading-lead">{SEASONS[p.season].description}</p><p><strong>이렇게 읽은 이유</strong>{p.reason}</p><p><strong>살릴 수 있는 점</strong>{p.opportunity}</p><p><strong>불편하지만 봐야 할 점</strong>{p.risk}</p><p><strong>선택의 기준</strong>{p.action}</p>
        <details className="fortune-evidence"><summary>네 기둥과 비교한 계산 근거</summary><ul>{p.evidence.map((line,i)=><li key={i}>{line}</li>)}</ul></details>
      </div></details>)}</div>
    <details className="fortune-evidence"><summary>4계절을 나눈 기준과 한계</summary><p>{report.method}</p></details>
  </section></>;
}
