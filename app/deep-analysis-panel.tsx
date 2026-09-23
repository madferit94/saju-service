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
        <details><summary>수치와 판단 근거 보기</summary><p>도움 쪽 가중 비율 {analysis.strength.score}% · 기준을 바꾸면 {analysis.strength.range[0]}~{analysis.strength.range[1]}%</p>{analysis.facts.filter(f=>f.id.startsWith("strength_")).map(f=><p key={f.id}>{f.text}</p>)}</details>
      </article>
      <article><h3>사주를 읽는 중심 주제 <small>격국</small></h3>{analysis.pattern.candidates.map((c,i)=><div key={i}><strong>{c.name}</strong><details><summary>이 후보가 나온 이유</summary><p>{c.reason}</p></details></div>)}
        <p className="method-help">격국은 사주를 읽는 중심 구조입니다. 월지의 중심 기운과 겉으로 드러난 천간을 확인한 후보이며 성립 확정은 아닙니다.</p></article>
      <article><h3>균형에 도움이 될 요소 <small>용신</small></h3><strong>{analysis.useful.status}</strong><p>{analysis.useful.reason}</p>
        {analysis.useful.candidates.map(c=><p key={c.element}><b>{c.element} 오행</b> · {c.reason}</p>)}
        <details><summary>계절의 한난을 살피는 조후 관점</summary><p>{analysis.useful.climate.text}</p><p>억부는 기운의 도움과 소모를 비교하는 관점, 조후는 계절의 차고 더운 조건을 살피는 관점입니다.</p></details></article>
    </div>
    <details className="fortune-evidence"><summary>판정 기준과 계산 내역</summary><p>{analysis.method}</p><p>{analysis.pattern.note}</p>
      <div className="analysis-table-wrap"><table><thead><tr><th>자리·근거</th><th>십성</th><th>가중값</th><th>관계</th></tr></thead><tbody>{analysis.strength.contributions.map((c,i)=><tr key={i}><td>{c.pillar} {c.source}</td><td>{c.god}</td><td>{c.weight}</td><td>{c.supports?"도움":"소모·통제"}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}
