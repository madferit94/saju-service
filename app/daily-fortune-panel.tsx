"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SajuChart } from "../lib/saju/chart";
import type { DaewoonTimeline } from "../lib/saju/daewoon";
import { buildPersonalDailyFortune, type DailyContext } from "../lib/saju/daily-fortune";

type DailyResponse =
  | { ready: false; date: string; nextRefreshAt: string }
  | { ready: true; context: DailyContext; nextRefreshAt: string };

export default function DailyFortunePanel({ chart, timeline }: { chart: SajuChart; timeline: DaewoonTimeline }) {
  const [expanded, setExpanded] = useState(false);
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/daily", { cache: "no-store", signal: current.signal });
      if (!response.ok) throw new Error("오늘 운세 자료를 불러오지 못했습니다.");
      const result = await response.json() as DailyResponse;
      if (current.signal.aborted) return;
      setDaily(result);
      const delay = Date.parse(result.nextRefreshAt) - Date.now() + 1000;
      if (Number.isFinite(delay)) timer.current = setTimeout(() => { void load(); }, Math.max(1000, delay));
    } catch (caught) {
      if (current.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "오늘 운세 자료를 불러오지 못했습니다.");
      timer.current = setTimeout(() => { void load(); }, 60_000);
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const fortune = useMemo(() => daily?.ready ? buildPersonalDailyFortune(chart, timeline, daily.context) : null, [daily, chart, timeline]);
  return <section className="result daily-fortune" id="daily-fortune" aria-labelledby="daily-fortune-title">
    <p className="result-label">매일 오전 9시 · 한국 시간</p>
    <h2 id="daily-fortune-title"><button type="button" className="daily-fortune-toggle" aria-expanded={expanded} aria-controls="daily-fortune-content" onClick={() => setExpanded((current) => !current)}>
      <span>오늘의 운세</span><span className="daily-fortune-chevron" aria-hidden="true">⌄</span>
    </button></h2>
    <div id="daily-fortune-content" hidden={!expanded}>
    {loading && !daily && <p role="status">오늘의 일진을 확인하고 있습니다…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => void load()}>다시 불러오기</button></div>}
    {!error && daily && !daily.ready && <p role="status">{daily.date}의 운세는 오전 9시부터 볼 수 있습니다.</p>}
    {!error && fortune && <>
      <p className="daily-fortune-date"><strong>{fortune.date}</strong> · {fortune.dayKorean}일({fortune.dayGanji})</p>
      <p className="method-help">오늘의 일진과 입력하신 사주를 함께 읽었습니다. 서버에는 출생 정보를 보내지 않았습니다.</p>
      <div className="daily-fortune-grid">
        <article><h3>살릴 점</h3><p>{fortune.opportunity}</p></article>
        <article><h3>주의할 점</h3><p>{fortune.risk}</p></article>
        <article><h3>오늘 해볼 일</h3><p>{fortune.action}</p></article>
      </div>
    </>}
    </div>
  </section>;
}
