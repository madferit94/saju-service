import type { DeepAnalysis } from "../lib/saju/deep-analysis";

export default function DeepAnalysisPanel({analysis}:{analysis:DeepAnalysis}) {
  const { strength, useful } = analysis;
  const strengthReading = strength.exceptional
    ? strength.score > 85 ? "나를 돕는 기운이 크게 모인 사주" : "나를 돕는 기운보다 쓰는 기운이 두드러진 사주"
    : strength.sensitive ? "계절에 따라 힘의 균형이 달라지는 사주" : strength.label;
  const balanceReading = strength.exceptional
    ? strength.score > 85 ? "같은 기운과 나를 돕는 기운이 강하게 모입니다. 이 힘을 어디에 쓰는지가 중요한 흐름입니다." : "내 기운을 밖으로 쓰거나 조절하는 글자가 많이 보입니다. 힘을 아끼고 필요한 도움을 살피는 흐름입니다."
    : strength.sensitive ? "월지의 계절 기운을 어떻게 읽느냐에 따라 도움과 부담의 무게가 달라집니다. 어느 쪽이 강한지보다 두 흐름이 만나는 자리를 살펴봅니다."
    : "나를 돕는 기운과 밖으로 쓰는 기운의 배치를 함께 살펴봅니다.";
  const climateReading = useful.climate.element === "화"
    ? "차가운 계절에는 따뜻한 화의 움직임을 함께 살펴봅니다."
    : useful.climate.element === "수"
      ? "더운 계절에는 열기를 식히는 수의 움직임을 함께 살펴봅니다."
      : "계절의 기운과 다른 오행이 맞물리는 방식을 함께 살펴봅니다.";
  return <section className="deep-analysis" aria-labelledby="deep-analysis-title">
    <p className="result-label">내가 잘 풀리는 조건 살피기</p>
    <h2 id="deep-analysis-title">사주의 균형과 도움이 되는 방향</h2>
    <p>나를 나타내는 글자가 주변에서 얼마나 도움을 받는지, 어떤 조건을 함께 살펴야 하는지 정리했습니다.</p>
    <div className="deep-analysis-grid">
      <article><h3>주변의 도움과 부담 <small>신강·신약</small></h3><strong>{strengthReading}</strong>
        <p>나와 같은 오행, 나를 돕는 오행을 계절과 자리에 따라 다르게 반영해 비교한 결과입니다.</p>
        <p className="method-help">성격이나 건강의 강약이 아닙니다. 이 수치는 서비스의 비교 지표이며 확률이나 공인 점수가 아닙니다.</p>
      </article>
      <article><h3>사주를 읽는 중심 주제 <small>격국</small></h3>{analysis.pattern.candidates.map((c,i)=><div key={i}><strong>{c.name}</strong></div>)}
        <p className="method-help">격국은 사주를 읽는 중심 구조입니다. 월지의 중심 기운과 겉으로 드러난 천간을 확인한 후보이며 성립 확정은 아닙니다.</p></article>
      <article><h3>균형에 도움이 될 요소 <small>용신</small></h3><strong>{useful.candidates.length ? "힘을 쓰는 방향" : "사주의 기운을 읽는 방향"}</strong><p>{useful.candidates.length ? "사주의 도움과 부담을 함께 보면 다음 오행의 쓰임이 두드러집니다." : balanceReading}</p>
        {useful.candidates.map(c=><p key={c.element}><b>{c.element} 오행</b> · {c.reason}</p>)}
        <p>{climateReading}</p>
      </article>
    </div>
  </section>;
}
