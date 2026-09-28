import type { DeepAnalysis } from "../lib/saju/deep-analysis";

export default function DeepAnalysisPanel({analysis}:{analysis:DeepAnalysis}) {
  return <section className="deep-analysis" aria-labelledby="deep-analysis-title">
    <p className="result-label">내가 잘 풀리는 조건 살피기</p>
    <h2 id="deep-analysis-title">사주의 균형과 도움이 되는 방향</h2>
    <p>나를 나타내는 글자가 주변에서 얼마나 도움을 받는지, 어떤 조건을 함께 살펴야 하는지 정리했습니다.</p>
    <div className="deep-analysis-grid">
      <article><h3>주변의 도움과 부담 <small>신강·신약</small></h3><strong>{analysis.strength.label}</strong>
        <p>나와 같은 오행, 나를 돕는 오행을 계절과 자리에 따라 다르게 반영해 비교한 결과입니다.</p>
        <p className="method-help">성격이나 건강의 강약이 아닙니다. 이 수치는 서비스의 비교 지표이며 확률이나 공인 점수가 아닙니다.</p>
      </article>
      <article><h3>사주를 읽는 중심 주제 <small>격국</small></h3>{analysis.pattern.candidates.map((c,i)=><div key={i}><strong>{c.name}</strong></div>)}
        <p className="method-help">격국은 사주를 읽는 중심 구조입니다. 월지의 중심 기운과 겉으로 드러난 천간을 확인한 후보이며 성립 확정은 아닙니다.</p></article>
      <article><h3>균형에 도움이 될 요소 <small>용신</small></h3><strong>{analysis.useful.status}</strong><p>{analysis.useful.reason}</p>
        {analysis.useful.candidates.map(c=><p key={c.element}><b>{c.element} 오행</b> · {c.reason}</p>)}
      </article>
    </div>
  </section>;
}
