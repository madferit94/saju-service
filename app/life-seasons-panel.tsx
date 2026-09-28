import type { LifeSeasonsReport, LifeSeason } from "../lib/saju/life-seasons";
import { SEASONS } from "../lib/saju/life-seasons";

const order: LifeSeason[] = ["spring", "summer", "autumn", "winter"];

export default function LifeSeasonsPanel({ report }: { report: LifeSeasonsReport }) {
  const periods = report.periods;
  if (!periods.length) return <section className="life-seasons" id="life-seasons"><h2>나의 인생 4계절</h2><p>표시할 대운 구간이 없습니다.</p></section>;
  const currentPeriod = report.current ? periods.find((period) => period.index === report.current!.periodIndex) : undefined;
  const currentAge = currentPeriod && report.current ? currentPeriod.startAge + report.current.currentYear - currentPeriod.startYear : null;
  return <section className="life-seasons" id="life-seasons" aria-labelledby="life-seasons-title">
    <p className="result-label">지금 대운에서 읽는 삶의 주제</p><h2 id="life-seasons-title">나의 인생 4계절</h2>
    <p className="life-seasons-lead">대운마다 앞에 나오는 주제를 봄·여름·가을·겨울에 빗댔습니다. 같은 계절이 다시 올 수도 있습니다.</p>
    {report.current ? <div className={`season-current season-${report.current.season}`} role="status"><span>지금은 {report.current.seasonLabel} · {SEASONS[report.current.season].theme}</span><strong>{report.current.currentYear}년, 사주식 나이 {currentAge}세</strong><p>{currentPeriod?.startYear}~{currentPeriod?.endYear}년 대운의 {Math.round(report.current.progress*100)}% 지점입니다. {SEASONS[report.current.season].description}</p><p><b>이 계절인 이유</b> {currentPeriod?.reason}</p><p><b>살릴 점</b> {report.current.opportunity}</p><p><b>부담이 커질 조건</b> {report.current.risk}</p><p><b>이 시기의 개운법</b> {report.current.action}</p></div>
      : <div className="season-current" role="status"><strong>{report.preDaewoon?"아직 첫 대운이 시작되기 전입니다.":"현재 연도는 표시한 대운 범위 밖입니다."}</strong><p>이 구간의 계절을 임의로 정하지 않습니다. 태어난 바탕과 현재 생활을 먼저 살펴보세요.</p></div>}
    <div className="season-legend" aria-label="4계절의 뜻">{order.map(season=><span key={season} className={`season-${season}`}><i aria-hidden="true"/>{SEASONS[season].label} · {SEASONS[season].theme}</span>)}</div>
    <h3>내 대운을 하나씩 읽기</h3><div className="life-periods">{periods.map(p=><details key={p.index} className={`life-period season-${p.season}`}>
      <summary><span className="life-period-season">{p.seasonLabel}{p.secondarySeason?` + ${SEASONS[p.secondarySeason].label}`:""}</span><strong>{p.startYear}~{p.endYear}년 · {p.startAge}~{p.endAge}세</strong><span>{p.korean}({p.ganji})</span>{p.index===report.current?.periodIndex&&<span className="current-badge">현재</span>}</summary>
      <div className="life-period-body"><p className="life-reading-lead">{SEASONS[p.season].description}</p><p><strong>이렇게 읽은 이유</strong>{p.reason}</p><p><strong>살릴 수 있는 점</strong>{p.opportunity}</p><p><strong>불편하지만 봐야 할 점</strong>{p.risk}</p><p><strong>생활에서 해볼 개운법</strong>{p.action}</p>
        <details className="fortune-evidence"><summary>네 기둥과 비교한 계산 근거</summary><ul>{p.evidence.map((line,i)=><li key={i}>{line}</li>)}</ul></details>
      </div></details>)}</div>
    <details className="fortune-evidence"><summary>4계절을 나눈 기준과 한계</summary><p>{report.method}</p></details>
  </section>;
}
