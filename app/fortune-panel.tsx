"use client";

import type { FlowAnalysis, FortuneReport } from "../lib/saju/fortune";
import type { GeminiSajuReading } from "../lib/saju/gemini-reading";

const godExplanations: Record<string, string> = {
  비견: "나와 비슷한 힘입니다. 내 기준을 세우고 동료와 나란히 일하는 주제로 읽습니다.",
  겁재: "나와 같은 편이면서 경쟁도 되는 힘입니다. 협력과 몫의 분배를 함께 살핍니다.",
  식신: "내가 가진 것을 꾸준히 만들어 내는 힘입니다. 기술과 결과물을 쌓는 방식으로 읽습니다.",
  상관: "생각을 밖으로 표현하고 기존 방식을 바꾸려는 힘입니다. 제안과 마찰을 함께 봅니다.",
  편재: "내 바깥에서 만나는 기회와 자원을 다루는 힘입니다. 새 일·사람·돈의 흐름을 넓히되 분산되는 부담도 살핍니다.",
  정재: "생활을 꾸려 가는 자원을 차근차근 관리하는 힘입니다. 꾸준한 수입과 지출의 기준을 봅니다.",
  편관: "압박이나 어려운 책임을 감당하는 힘입니다. 실행력과 함께 감당할 수 있는 범위를 봅니다.",
  정관: "규칙과 공식적인 책임을 다루는 힘입니다. 신뢰와 평가, 실제 권한이 맞는지 살핍니다.",
  편인: "익숙한 답 대신 다른 방법을 찾아 깊이 파고드는 힘입니다. 독자적인 배움과 실행을 함께 봅니다.",
  정인: "도움과 체계적인 배움을 받아 기반을 다지는 힘입니다. 준비한 것을 실제로 쓰는지도 살핍니다.",
};

function Evidence({ flow }: { flow: FlowAnalysis }) {
  return <details className="fortune-evidence">
    <summary>이렇게 읽은 사주 근거</summary>
    <ul>{flow.evidence.map((line, i) => <li key={i}>{line}</li>)}</ul>
  </details>;
}

export default function FortunePanel({ report, reading, timezone = "Asia/Seoul" }: {
  report: FortuneReport; reading: GeminiSajuReading | null; timezone?: string;
}) {
  const lifetimeGods = [...new Set(report.lifetime.flatMap((stage) => stage.periods.flatMap((period) =>
    period.ganji ? [period.stemGod, ...(period.hiddenStems?.map((item) => item.god) ?? [])] : [],
  )).filter((god): god is string => Boolean(god)))];
  const stamp = (value: string) => new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
  return <section className="fortune-panel" aria-labelledby="fortune-title">
    <p className="result-label">평생의 바탕에서 한 달의 선택까지</p>
    <h2 id="fortune-title">나의 평생 운과 지금의 흐름</h2>
    <p className="fortune-synthesis">{reading?.synthesis ?? report.synthesis}</p>
    <nav className="fortune-section-nav" aria-label="운세 주제 바로가기"><a href="#fortune-lifetime">평생운</a><a href="#fortune-annual">{report.year}년 · 월별운</a><a href="#fortune-domains">생활 주제별 운</a></nav>
    <section className="fortune-content" id="fortune-lifetime" aria-labelledby="fortune-lifetime-title">
      <h3 id="fortune-lifetime-title">인생 전체를 이어서 읽기</h3>
      <p className="method-help">사주식 나이로 초년부터 후반까지, 실제 대운이 달라지는 구간을 묶었습니다.</p>
      <div className="lifetime-guide">
        <h4>읽기 전에: 풀이에 나오는 용어의 뜻</h4>
        <p><strong>대운</strong>은 약 10년씩 바뀌는 해석 구간입니다. <strong>일간</strong>은 태어난 날의 윗글자로, 다른 글자와의 관계를 비교할 때 기준이 됩니다. 그 관계의 이름이 <strong>십성</strong>입니다. <strong>지장간</strong>은 대운 아랫글자 속에 들어 있다고 보는 글자입니다. <strong>합</strong>은 두 글자가 묶이는 관계, <strong>충</strong>은 서로 부딪히는 관계를 뜻합니다.</p>
        <p>아래 십성은 이번 풀이에 실제로 등장한 이름입니다. 사람의 성격이나 미래 사건을 하나의 이름으로 확정하는 뜻은 아닙니다.</p>
        <dl className="lifetime-glossary">{lifetimeGods.map((god) => <div key={god}><dt>{god}</dt><dd>{godExplanations[god]}</dd></div>)}</dl>
      </div>
      <h4 className="lifetime-order-title">내 사주에서 이렇게 읽은 이유</h4>
      <p className="method-help">나를 뜻하는 일간 {report.natal.dayMaster.character}({report.natal.dayMaster.korean})을 기준으로 각 대운의 윗글자와 아랫글자 속 중심 글자를 비교했습니다. 먼저 계산된 관계를 보고, 그 아래에서 시기의 해석을 읽어 주세요.</p>
      <div className="lifetime-grid">{report.lifetime.map((stage) => <article className="lifetime-card" key={stage.label}>
        <span className="result-label">{stage.range}</span><h4>{stage.label}</h4>
        {stage.periods.map((period) => <details key={period.index} open>
          <summary>{period.startYear}–{period.endYear} · {period.startAge}–{period.endAge}세 · {period.korean || "대운 시작 전"}</summary>
          {period.ganji ? <div className="lifetime-basis">
            <strong>이렇게 판단한 근거</strong>
            <p>대운 {period.ganji}({period.korean})의 윗글자 {period.ganji[0]}은 일간 {report.natal.dayMaster.character}({report.natal.dayMaster.korean})과 비교하면 <strong>{period.stemGod}</strong> 관계입니다. 아랫글자 {period.ganji[1]} 속 중심 지장간 {period.hiddenStems?.[0]?.stem}({period.hiddenStems?.[0]?.korean})는 <strong>{period.hiddenStems?.[0]?.god}</strong> 관계입니다.</p>
            {period.evidence && period.evidence.length > 2 && <><p><strong>타고난 사주와 만나는 지점</strong></p><ul className="fortune-facts">{period.evidence.slice(2).map((line, i) => <li key={i}>{line}</li>)}</ul></>}
          </div> : <p className="lifetime-basis"><strong>이렇게 판단한 근거</strong> 이 시기는 첫 대운이 시작되기 전입니다. 아직 적용되지 않은 대운의 글자나 십성을 임의로 붙이지 않고, 타고난 사주와 생활 환경을 중심으로 읽습니다.</p>}
          <p><strong>이 시기의 해석</strong> {period.summary}</p>
          {period.risk && <p><strong>함께 살필 부담</strong> {period.risk}</p>}
          {period.evidence && <details className="fortune-evidence"><summary>자세한 계산 근거</summary><ul>{period.evidence.map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
        </details>)}
        {!stage.periods.length && <p>계산된 대운 범위에 해당하는 구간이 없습니다.</p>}
      </article>)}</div>
      {reading?.lifetime && <div className="lifetime-long-reading"><h4>전체 흐름을 이어서 읽기</h4><p className="fortune-prose">{reading.lifetime}</p></div>}
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
    <section className="fortune-content" id="fortune-domains" aria-labelledby="fortune-domains-title">
      <h3 id="fortune-domains-title">생활 주제별 운</h3>
      <p className="method-help">각 주제는 원국의 자리와 십성, {report.year}년 세운을 함께 읽었습니다. 풀이에 사용한 계산값은 카드 아래에서 확인할 수 있습니다.</p>
      <nav className="fortune-domain-nav" aria-label="생활 운 항목 바로가기">{report.domains.map((domain) => <a key={domain.id} href={`#fortune-domain-${domain.id}`}>{domain.title}</a>)}</nav>
      <div className="reading-grid fortune-domain-grid">{report.domains.map((domain) => {
        const extra = domain.id === "career" ? reading?.career : domain.id === "money" ? reading?.money : domain.id === "partner" ? reading?.relationships : null;
        return <article className="reading-card fortune-domain-card" id={`fortune-domain-${domain.id}`} key={domain.id}>
          <h4>{domain.title}</h4><p>{domain.body}</p>
          {extra && <p className="domain-extra"><strong>기존 종합 해석</strong><br />{extra}</p>}
          <p className="domain-interpretation"><strong>사주에서 읽히는 점</strong> {domain.interpretation}</p>
          <details className="fortune-evidence"><summary>이렇게 읽은 사주 근거</summary><ul>{domain.evidence.map((line, index) => <li key={index}>{line}</li>)}</ul></details>
        </article>;
      })}</div>
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
