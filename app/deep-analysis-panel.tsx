import type { SajuChart } from "../lib/saju/chart";
import type { DeepAnalysis } from "../lib/saju/deep-analysis";
import { buildBalanceReading } from "../lib/saju/balance-reading";

export default function DeepAnalysisPanel({ chart, analysis }: { chart: SajuChart; analysis: DeepAnalysis }) {
  const reading = buildBalanceReading(chart, analysis);
  return <section className="deep-analysis" aria-labelledby="deep-analysis-title">
    <p className="result-label">내 사주의 중심 읽기</p>
    <h2 id="deep-analysis-title">사주의 균형과 도움이 되는 방향</h2>
    <p>{reading.lead}</p>
    <div className="deep-analysis-grid">
      <article><h3>태어난 계절과 내 기운</h3><strong>{reading.strengthTitle}</strong><p>{reading.strengthBody}</p></article>
      <article><h3>태어난 달이 말하는 주제</h3><strong>{reading.monthTitle}</strong><p>{reading.monthBody}</p></article>
      <article><h3>잘 풀리는 방향</h3><strong>{reading.helpfulTitle}</strong><p>{reading.helpfulBody}</p></article>
    </div>
  </section>;
}
