"use client";

import { useEffect, useState } from "react";
import type { LifeGraphReport } from "../lib/saju/life-graph";
import { LIFE_NOTE_LIMIT, lifeNotePeriodKey, readLifeNotes, writeLifeNotes, type LifeNotes } from "../lib/saju/life-notes";

const themeGuide: Record<string, string> = {
  비견: "내 기준을 세우고 동료와 나란히 일하기",
  겁재: "협력과 경쟁 속에서 역할과 몫 나누기",
  식신: "꾸준히 익혀 결과물 만들기",
  상관: "생각을 표현하고 익숙한 방식 바꾸기",
  편재: "새 기회와 자원을 넓혀 보기",
  정재: "생활 자원을 차근차근 관리하기",
  편관: "어려운 책임과 압박을 다루기",
  정관: "규칙과 신뢰를 바탕으로 역할 맡기",
  편인: "다른 관점을 탐구하고 배우기",
  정인: "도움을 받아 배우고 기반 다지기",
};

export default function LifeGraphPanel({ report, noteStorageKey }: { report: LifeGraphReport; noteStorageKey: string }) {
  const [notes, setNotes] = useState<LifeNotes>({});
  const [drafts, setDrafts] = useState<LifeNotes>({});
  const [noteMessage, setNoteMessage] = useState("");
  useEffect(() => {
    const loaded = readLifeNotes(noteStorageKey);
    setNotes(loaded.notes);
    setDrafts(loaded.notes);
    if (loaded.error) setNoteMessage("이 브라우저의 메모를 읽지 못했습니다. 브라우저 저장 설정을 확인해 주세요.");
  }, [noteStorageKey]);

  function saveNote(periodKey: string) {
    const note = (drafts[periodKey] ?? "").trim();
    if (!note) { setNoteMessage("내용을 한 줄 적은 뒤 저장해 주세요."); return; }
    const next = { ...notes, [periodKey]: note };
    if (!writeLifeNotes(noteStorageKey, next)) { setNoteMessage("메모를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요."); return; }
    setNotes(next);
    setDrafts((current) => ({ ...current, [periodKey]: note }));
    setNoteMessage("이 브라우저에 메모를 저장했습니다.");
  }

  function deleteNote(periodKey: string) {
    const next = { ...notes };
    delete next[periodKey];
    if (!writeLifeNotes(noteStorageKey, next)) { setNoteMessage("메모를 삭제하지 못했습니다. 브라우저 저장 공간을 확인해 주세요."); return; }
    setNotes(next);
    setDrafts((current) => ({ ...current, [periodKey]: "" }));
    setNoteMessage("메모를 삭제했습니다.");
  }

  const periods = report.periods;
  if (!periods.length) return <section className="life-graph-panel" id="life-graph"><h2>나의 인생 그래프</h2><p>표시할 대운 구간이 없습니다.</p></section>;
  const first = periods[0].startYear;
  const last = periods.at(-1)!.endYear + 1;
  const left = 44, right = 716, top = 62, bottom = 218;
  const x = (year: number) => left + (year - first) / (last - first) * (right - left);
  const y = (level: number) => bottom - level / 2 * (bottom - top);
  const centers = periods.map((period) => ({ period, cx: x((period.startYear + period.endYear + 1) / 2) }));
  const line = centers.map(({ period, cx }, index) => `${index ? "L" : "M"} ${cx.toFixed(1)} ${y(period.level).toFixed(1)}`).join(" ");
  const currentX = report.current ? x(report.currentYear + .5) : null;
  const firstFeatured = report.featured[0];
  const shownFeatured = report.featured.slice(0, 2);
  const featuredText = shownFeatured.map((period) => `${period.startAge}–${period.endAge}세(${period.startYear}–${period.endYear}년)`).join(", ");
  const restCount = report.featured.length - shownFeatured.length;
  const peakMode = report.mode === "peak-candidate";
  return <section className="life-graph-panel" id="life-graph" aria-labelledby="life-graph-heading">
    <p className="result-label">삶 전반의 확장 흐름</p>
    <h2 id="life-graph-heading">나의 인생 그래프</h2>
    <p className="life-seasons-lead">대운이 바뀔 때마다 사주에서 살필 흐름을 한 줄로 그렸습니다. 높은 위치가 성취나 행복을 보장하지는 않습니다.</p>
    <div className="life-graph-highlight">
      <strong>{peakMode ? firstFeatured ? "전성기 후보" : "전성기 후보 없음" : "전성기 판정 보류"}</strong>
      <p>{peakMode
        ? firstFeatured ? `${featuredText}${restCount ? ` 외 ${restCount}구간` : ""}에 원국의 조건부 도움 오행이 대운과 가장 많이 만납니다.` : "계산한 대운에서 조건부 도움 오행과 뚜렷하게 만나는 구간이 없습니다."
        : `${report.strengthReason} ${firstFeatured ? `${featuredText}${restCount ? ` 외 ${restCount}구간` : ""}은 변화 단서가 상대적으로 많이 드러납니다.` : "그래프는 대운별 변화 단서만 보여줍니다."}`}</p>
    </div>
    {report.current && <p className="life-graph-now">지금 · {report.current.startAge}–{report.current.endAge}세 {report.current.korean} 대운</p>}
    <div className="life-graph-wrap" role="region" aria-label="대운별 인생 흐름 그래프" tabIndex={0}>
      <svg viewBox="0 0 760 278" className="life-graph" role="img" aria-labelledby="life-graph-title life-graph-description">
        <title id="life-graph-title">사주 기반 대운 흐름과 현재 위치</title>
        <desc id="life-graph-description">{peakMode ? "각 점은 대운 두 글자와 조건부 도움 오행의 일치 정도입니다. 높은 점은 전성기 후보입니다." : "도움 오행 판단이 보류되어 각 점은 원국과 대운 사이의 변화 단서 정도입니다. 전성기를 뜻하지 않습니다."} 현재 연도 위치와 각 구간의 근거는 그래프 아래에서 읽을 수 있습니다.</desc>
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="graph-guide"/>
        <path d={line} className="life-path graph-flow"/>
        {centers.map(({ period, cx }, index) => <g key={period.index}>
          <circle cx={cx} cy={y(period.level)} r={shownFeatured.includes(period) ? 8 : 5} className={shownFeatured.includes(period) ? "graph-peak-point" : "graph-flow-point"}/>
          {(index === 0 || index === periods.length - 1 || index % 2 === 0) && <text x={cx} y="252" textAnchor="middle" className="life-year-label">{period.startAge}세</text>}
        </g>)}
        {currentX !== null && <g><line x1={currentX} x2={currentX} y1="42" y2="222" className="current-line"/><text x={Math.min(690, Math.max(70, currentX))} y="31" textAnchor="middle" className="current-graph-label">지금</text></g>}
      </svg>
    </div>
    <p className="method-help">{peakMode ? "높이 = 조건부 도움 오행과 대운 두 글자가 만나는 정도. 전성기는 확정된 미래가 아닌 후보입니다." : "높이 = 원국과 대운 사이의 변화 단서 정도. 도움 오행 판단이 보류되어 전성기 추정은 표시하지 않습니다."}</p>
    <details className="life-note-disclosure">
      <summary>내 경험 한 줄 적기{Object.keys(notes).length ? ` · ${Object.keys(notes).length}개 기록` : ""}</summary>
      <p className="method-help">지나온 시기에는 실제 경험을, 앞으로의 시기에는 생각이나 계획을 한 줄 적어 위 그래프의 풀이와 비교해 보세요. 메모는 이 브라우저에만 저장되며 계정이나 AI로 보내지지 않습니다.</p>
      <p className="life-note-status" role="status">{noteMessage}</p>
      <div className="life-note-list">{periods.map((period) => {
        const periodKey = lifeNotePeriodKey(period);
        const fieldId = `life-note-${periodKey}`;
        return <article key={periodKey} className={period.index === report.current?.index ? "life-note-current" : ""}>
          <h3>{period.startYear}–{period.endYear}년 · {period.startAge}–{period.endAge}세 {period.korean}{period.index === report.current?.index && <span className="current-badge">현재</span>}</h3>
          <p>사주에서 살필 주제: {themeGuide[period.theme] ?? period.theme}</p>
          <label htmlFor={fieldId}>{period.startYear > report.currentYear ? "앞으로의 생각 한 줄" : "내가 겪은 일 한 줄"}</label>
          <div className="life-note-row">
            <input id={fieldId} value={drafts[periodKey] ?? ""} maxLength={LIFE_NOTE_LIMIT} placeholder="예: 새로운 일을 배우기 시작했다" onChange={(event) => { setDrafts((current) => ({ ...current, [periodKey]: event.target.value })); setNoteMessage(""); }} />
            <button type="button" onClick={() => saveNote(periodKey)}>저장</button>
            {notes[periodKey] && <button className="life-note-delete" type="button" onClick={() => deleteNote(periodKey)}>삭제</button>}
          </div>
        </article>;
      })}</div>
    </details>
    <details className="fortune-evidence life-graph-details"><summary>시기별 해석 근거 보기</summary>
      <div className="life-graph-periods">{periods.map((period) => <article key={period.index} className={period.index === report.current?.index ? "graph-current-period" : ""}>
        <h3>{period.startAge}–{period.endAge}세 · {period.startYear}–{period.endYear}년 {period.korean} 대운 {period.index === report.current?.index && <span className="current-badge">현재</span>}</h3>
        <p>{peakMode
          ? `앞글자 ${period.stemElement}, 아랫글자 중심 ${period.branchElement} 중 조건부 도움 오행(${report.favorable.join("·")})과 만나는 글자는 ${period.matchingElements.length}개입니다.`
          : `원국과의 합·충·반복 관계가 ${period.activityCount}건 확인됩니다. 변화 단서의 많고 적음으로 길흉을 정하지 않습니다.`}</p>
        <p>대운 앞글자의 생활 주제: {period.theme}</p>
        {(period.connections.length + period.adjustments.length + period.repeats.length > 0) && <ul>{[...period.connections, ...period.adjustments, ...period.repeats].map((line, index) => <li key={index}>{line}</li>)}</ul>}
      </article>)}</div>
    </details>
    <details className="fortune-evidence"><summary>그래프 계산 기준과 한계</summary><p>{report.method}</p></details>
  </section>;
}
