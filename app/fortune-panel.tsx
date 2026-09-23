"use client";

import type { FlowAnalysis, FortuneReport } from "../lib/saju/fortune";
import type { GeminiSajuReading } from "../lib/saju/gemini-reading";

function Evidence({ flow }: { flow: FlowAnalysis }) {
  return <details className="fortune-evidence">
    <summary>이렇게 읽은 사주 근거</summary>
    <ul>{flow.evidence.map((line, i) => <li key={i}>{line}</li>)}</ul>
  </details>;
}

export default function FortunePanel({ report, reading, timezone = "Asia/Seoul" }: {
  report: FortuneReport; reading: GeminiSajuReading | null; timezone?: string;
}) {
  const stamp = (value: string) => new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
  return <section className="fortune-panel" aria-labelledby="fortune-title">
    <p className="result-label">평생의 바탕에서 한 달의 선택까지</p>
    <h2 id="fortune-title">나의 평생 운과 지금의 흐름</h2>
    <p className="fortune-synthesis">{reading?.synthesis ?? report.synthesis}</p>
    <nav className="fortune-section-nav" aria-label="운세 주제 바로가기"><a href="#fortune-lifetime">평생운</a><a href="#fortune-annual">{report.year}년 · 월별운</a><a href="#fortune-domains">일 · 재물 · 관계</a></nav>
    <section className="fortune-content" id="fortune-lifetime" aria-labelledby="fortune-lifetime-title">
      <h3 id="fortune-lifetime-title">인생 전체를 이어서 읽기</h3>
      <p className="method-help">사주식 나이로 초년부터 후반까지, 실제 대운이 달라지는 구간을 묶었습니다.</p>
      {reading?.lifetime && <p className="fortune-prose">{reading.lifetime}</p>}
      <div className="lifetime-grid">{report.lifetime.map((stage) => <article className="lifetime-card" key={stage.label}>
        <span className="result-label">{stage.range}</span><h4>{stage.label}</h4>
        {stage.periods.map((period) => <details key={period.index} open>
          <summary>{period.startYear}–{period.endYear} · {period.startAge}–{period.endAge}세 · {period.korean || "대운 시작 전"}</summary>
          <p>{period.summary}</p>
          {period.risk && <p><strong>함께 살필 부담</strong> {period.risk}</p>}
          {period.evidence && <ul className="fortune-facts">{period.evidence.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        </details>)}
        {!stage.periods.length && <p>계산된 대운 범위에 해당하는 구간이 없습니다.</p>}
      </article>)}</div>
    </section>
    <section className="fortune-content" id="fortune-annual" aria-labelledby="fortune-annual-title">
      <h3 id="fortune-annual-title">{report.year}년 {report.annual.ganji}({report.annual.korean}) 세운</h3>
      <p className="method-help">함께 살필 대운: {report.annual.daewoon}. 적용 기간: {stamp(report.annual.startAt)} ~ {stamp(report.annual.endAt)} 직전 · {timezone}</p>
      {reading?.annual ? <p className="fortune-prose">{reading.annual}</p> : <>
        <p><strong>활용할 흐름</strong> {report.annual.opportunity}</p>
        <p><strong>걸리기 쉬운 지점</strong> {report.annual.risk}</p>
        <p><strong>선택의 기준</strong> {report.annual.action}</p>
      </>}
      <Evidence flow={report.annual} />
      <h3>월별로 달라지는 흐름</h3>
      <p className="method-help">월운은 매월 1일이 아닌 절기가 시작되는 시각에 바뀝니다. 1월 절입 전은 전년도 12월 월운이며, 아래 시작 시각 이상·다음 시작 시각 미만에 적용됩니다.</p>
      <div className="month-grid">{report.months.map((month) => {
        const interpretation = reading?.monthly?.find((item) => item.month === month.month);
        return <details className="month-card" key={month.month} open>
          <summary><span>{month.label}</span><strong>{month.ganji}({month.korean}) · {month.stemGod}</strong></summary>
          <p className="method-help">{stamp(month.startAt)} ~ {stamp(month.endAt)} 직전</p>
          {interpretation ? <p>{interpretation.reading}</p> : <>
            <p>{month.opportunity}</p>
            <p><strong>주의할 상황</strong> {month.risk}</p>
            <p><strong>이번 달 실천</strong> {month.action}</p>
          </>}
          <Evidence flow={month} />
        </details>;
      })}</div>
    </section>
    <section className="fortune-content reading-grid" id="fortune-domains" aria-label="일·재물·관계 풀이">
      {report.domains.map((domain) => <article className="reading-card" key={domain.title}>
        <h3>{domain.title}</h3><p>{domain.title === "일·학업운" ? reading?.career ?? domain.body : domain.title === "재물운" ? reading?.money ?? domain.body : domain.title === "관계·인연운" ? reading?.relationships ?? domain.body : domain.body}</p>
      </article>)}
    </section>
    <details className="fortune-evidence natal-evidence">
      <summary>타고난 지장간·합충과 계산 기준</summary>
      <p>십성은 나를 뜻하는 일간과 다른 천간의 관계입니다. 지장간은 지지 속 천간을 뜻하며, 아래 표는 대표 오행 8자 개수와 구분해 읽습니다.</p>
      {report.natal.hiddenStems.map((p) => <p key={p.label}><strong>{p.label} {p.branch}({p.korean})</strong> · {p.stems.map((x) => x.stem + "(" + x.korean + "·" + x.god + ")").join(", ")}</p>)}
      <ul>{report.natal.contacts.map((line, i) => <li key={i}>{line}</li>)}</ul>
      {!report.natal.contacts.length && <p>계산 범위의 천간합·지지육합·충·같은 지지 반복은 확인되지 않았습니다.</p>}
      <p>{report.method}</p>
    </details>
    <p className="note">전통 명리의 해석을 실제 경험·현재 여건과 비교해 읽어 주세요. 미래의 사건이나 수익, 수명을 보장하는 결과는 아닙니다.</p>
  </section>;
}
