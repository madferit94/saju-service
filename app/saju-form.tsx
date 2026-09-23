"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  calculate,
  InputError,
  type SajuChart,
  type SajuInput,
} from "../lib/saju/chart";
import {
  calculateDaewoon,
  type DaewoonTimeline,
  type PeriodStatus,
} from "../lib/saju/daewoon";
import { calculateBenefactors, type Benefactor } from "../lib/saju/benefactors";
import { createGeminiReadingContext, validateGeminiSajuReading, type GeminiSajuReading } from "../lib/saju/gemini-reading";
import { analyzeNatal } from "../lib/saju/deep-analysis";
import { CHAPTERS, CHAPTER_LABELS, READING_STYLE_VERSION, consultationFacts, validatePlainChapter, type Consultation } from "../lib/saju/consultation";
import DeepAnalysisPanel from "./deep-analysis-panel";
import ConsultationPanel from "./consultation-panel";
import MansePanel from "./manse-panel";
import FlowOverview from "./flow-overview";
import { buildLocalReading } from "../lib/saju/reading";
import { clearSavedSajuResult, readSavedSajuResult, writeSavedSajuResult } from "../lib/saju/persistence";
import type { Birthplace } from "../lib/saju/birth-moment";
import { getCalendarCandidates, type CalendarCandidate } from "../lib/saju/calendar";

import { buildFortuneReport } from "../lib/saju/fortune";
import FortunePanel from "./fortune-panel";
import AccountPanel from "./account-panel";
import type { CloudPayload } from "../lib/account/results";

type PreparedCalendarChoice = {
  label: string;
  solarDate: string;
  input: SajuInput;
  chart: SajuChart;
  timeline: DaewoonTimeline;
  benefactors: Benefactor[];
  gender: 0 | 1;
};

const groups: { status: PeriodStatus; title: string; description: string }[] = [
  { status: "past", title: "지나온 흐름", description: "실제 경험과 비교해 보세요." },
  { status: "current", title: "지금의 흐름", description: "현재 연도가 포함된 시기입니다." },
  { status: "future", title: "앞으로의 흐름", description: "앞날을 생각할 때 참고해 보세요." },
];

export default function SajuForm() {
  const [resultSource, setResultSource] = useState<"local" | "cloud">("local");
  const resultSourceRef = useRef<"local" | "cloud">("local");
  const [resultSavedAt, setResultSavedAt] = useState("");
  const generation = useRef(0);
  const consultationAbort = useRef<AbortController | null>(null);
  const [consultation, setConsultation] = useState<Consultation | undefined>();
  const [consultationProgress, setConsultationProgress] = useState("");
  const [consultationError, setConsultationError] = useState("");
  const [fortuneYear, setFortuneYear] = useState(new Date().getFullYear());
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [leapMonth, setLeapMonth] = useState<"regular" | "leap" | "unknown">("unknown");
  const [calendarChoices, setCalendarChoices] = useState<PreparedCalendarChoice[]>([]);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [countryCode, setCountryCode] = useState("KR");
  const [cityQuery, setCityQuery] = useState("");
  const [cityMatches, setCityMatches] = useState<Birthplace[]>([]);
  const [citySearched, setCitySearched] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [birthplace, setBirthplace] = useState<Birthplace | null>(null);
  const [locationError, setLocationError] = useState("");
  const [chart, setChart] = useState<SajuChart | null>(null);
  const [timeline, setTimeline] = useState<DaewoonTimeline | null>(null);
  const [benefactors, setBenefactors] = useState<Benefactor[]>([]);
  const [reading, setReading] = useState<GeminiSajuReading | null>(null);
  const [pendingInput, setPendingInput] = useState<SajuInput | null>(null);
  const [yunGender, setYunGender] = useState<0 | 1 | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [readingError, setReadingError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [error, setError] = useState("");
  const localReading = useMemo(() => chart && timeline ? buildLocalReading(chart, timeline, benefactors) : null, [chart, timeline, benefactors]);
  const fortune = useMemo(() => chart && timeline ? buildFortuneReport(chart, timeline, fortuneYear) : null, [chart, timeline, fortuneYear]);
  const visibleReading = reading?.readingVersion === 2 && reading.analysisVersion === 1 && reading.fortuneYear === fortuneYear ? reading : null;
  const deepAnalysis = useMemo(() => chart ? analyzeNatal(chart) : null, [chart]);
  const consultationContext = useMemo(() => chart && timeline ? createGeminiReadingContext(chart, timeline, benefactors, fortuneYear) : null, [chart,timeline,benefactors,fortuneYear]);
  const facts = useMemo(() => consultationContext ? consultationFacts(consultationContext) : [], [consultationContext]);
  const visibleConsultation = consultation?.year === fortuneYear ? consultation : undefined;
  const cloudPayload = useMemo<CloudPayload | null>(() => chart && timeline && pendingInput && yunGender !== null ? {
    version: 1, fortuneYear,
    result: { version: 1, savedAt: resultSavedAt, input: pendingInput, yunGender, chart, timeline, benefactors, reading, consultation },
  } : null, [chart, timeline, pendingInput, yunGender, benefactors, reading, consultation, fortuneYear, resultSavedAt]);

  function loadCloudResult(payload: CloudPayload) {
    generation.current++;
    consultationAbort.current?.abort();
    setConsultation(payload.result.consultation); setConsultationProgress(""); setConsultationError(""); setIsGenerating(false);
    resultSourceRef.current = "cloud";
    setResultSource("cloud"); setResultSavedAt(payload.result.savedAt);
    setChart(payload.result.chart); setTimeline(payload.result.timeline);
    setBenefactors(payload.result.benefactors); setReading(payload.result.reading);
    setPendingInput(payload.result.input); setYunGender(payload.result.yunGender);
    setFortuneYear(payload.fortuneYear); setConsentAccepted(false);
    setReadingError(""); setError(""); setCalendarChoices([]); setStorageWarning(false);
  }

  function clearCloudResult() {
    if (resultSourceRef.current !== "cloud") return;
    resultSourceRef.current = "local";
    generation.current++;
    consultationAbort.current?.abort();
    setConsultation(undefined); setConsultationProgress(""); setConsultationError("");
    setChart(null); setTimeline(null); setBenefactors([]); setReading(null);
    setPendingInput(null); setYunGender(null); setConsentAccepted(false);
    setReadingError(""); setIsGenerating(false); setResultSource("local");
  }

  useEffect(() => {
    const saved = readSavedSajuResult();
    if (!saved) return;
    setResultSavedAt(saved.savedAt);
    setChart(saved.chart);
    setTimeline(saved.timeline);
    setBenefactors(saved.benefactors);
    setReading(saved.reading);
    setConsultation(saved.consultation);
    if (saved.consultation) setFortuneYear(saved.consultation.year);
    setPendingInput(saved.input);
    setYunGender(saved.yunGender);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/locations?countries=1", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (active) setCountries(data.countries); })
      .catch(() => { if (active) setLocationError("국가 목록을 불러오지 못했습니다. 화면을 새로고침해 주세요."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (birthplace || cityQuery.trim().length < 2) return;
    const controller = new AbortController();
    setCityLoading(true);
    setCitySearched(false);
    const timer = setTimeout(() => {
      fetch(`/api/locations?country=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(cityQuery.trim())}`, { signal: controller.signal, cache: "no-store" })
        .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
        .then((data) => { setCityMatches(data.cities); setCitySearched(true); setCityLoading(false); setLocationError(""); })
        .catch((caught) => { if (caught?.name !== "AbortError") { setCityLoading(false); setLocationError("도시 검색에 실패했습니다. 다시 입력해 주세요."); } });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [countryCode, cityQuery, birthplace]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    generation.current++;
    consultationAbort.current?.abort();
    setConsultation(undefined); setConsultationProgress(""); setConsultationError("");
    setResultSource("local");
    resultSourceRef.current = "local";
    setChart(null);
    setTimeline(null);
    setReading(null);
    setBenefactors([]);
    setPendingInput(null);
    setYunGender(null);
    setConsentAccepted(false);
    setReadingError("");
    setCalendarChoices([]);
    const data = new FormData(event.currentTarget);
    const date = calendar === "solar"
      ? String(data.get("date") || "")
      : `${String(data.get("lunarYear") || "0000").padStart(4, "0")}-${String(data.get("lunarMonth") || "00").padStart(2, "0")}-${String(data.get("lunarDay") || "00").padStart(2, "0")}`;
    const input: SajuInput = {
      date,
      time: String(data.get("time") || ""),
      calendar,
      leapMonth: calendar === "lunar" ? leapMonth : undefined,
      topic: "general",
      question: "",
      birthplace: birthplace ?? undefined,
    };
    try {
      if (!birthplace || birthplace.countryCode !== countryCode) {
        throw new InputError("출생 국가와 도시를 목록에서 선택해주세요.");
      }
      const selectedMethod = data.get("yunGender");
      if (selectedMethod !== "0" && selectedMethod !== "1") {
        throw new InputError("대운 계산 기준을 선택해주세요.");
      }
      const gender: 0 | 1 = selectedMethod === "1" ? 1 : 0;
      const candidates = getCalendarCandidates(input);
      const prepared = candidates.map((candidate: CalendarCandidate<SajuInput>) => {
        const nextChart = calculate(candidate.input);
        return {
          label: candidate.label,
          solarDate: candidate.solarDate,
          input: candidate.input,
          chart: nextChart,
          timeline: calculateDaewoon(candidate.input, gender),
          benefactors: calculateBenefactors(nextChart),
          gender,
        };
      });
      setError("");
      if (prepared.length > 1) {
        setCalendarChoices(prepared);
        return;
      }
      activateCalendarChoice(prepared[0]);
    } catch (caught) {
      setChart(null);
      setTimeline(null);
      setPendingInput(null);
      setError(
        caught instanceof InputError || caught instanceof Error
          ? caught.message
          : "계산하지 못했습니다. 입력을 확인해주세요.",
      );
    }
  }

  function activateCalendarChoice(choice: PreparedCalendarChoice) {
      const savedAt = new Date().toISOString();
      setResultSavedAt(savedAt);
      setStorageWarning(!clearSavedSajuResult());
      const { input, chart: nextChart, timeline: nextTimeline, benefactors: nextBenefactors, gender } = choice;
      setChart(nextChart);
      setTimeline(nextTimeline);
      setBenefactors(nextBenefactors);
      setPendingInput(input);
      setYunGender(gender);
      setCalendarChoices([]);
      const saved = writeSavedSajuResult({
        version: 1,
        savedAt,
        input,
        yunGender: gender,
        chart: nextChart,
        timeline: nextTimeline,
        benefactors: nextBenefactors,
        reading: null,
      });
      setStorageWarning(!saved);
  }

  async function requestGeminiReading() {
    if (!consentAccepted || !pendingInput || yunGender === null || !chart || !timeline) return;
    const ticket = ++generation.current;
    setIsGenerating(true);
    setReadingError("");
    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ consent: true, input: pendingInput, yunGender, fortuneYear }),
      });
      const body = await response.json() as {
        chart?: SajuChart;
        timeline?: DaewoonTimeline;
        benefactors?: Benefactor[];
        reading?: unknown;
        error?: { message?: string };
      };
      if (ticket !== generation.current) return;
      if (!response.ok) throw new Error(body.error?.message || "Gemini 해석을 만들지 못했습니다. 다시 시도해 주세요.");
      if (!body.chart || !body.timeline || !body.benefactors || !body.reading) {
        throw new Error("Gemini 해석 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
      }
      const nextReading = validateGeminiSajuReading(body.reading, body.timeline.periods.map((period) => period.index), fortuneYear);
      setChart(body.chart);
      setTimeline(body.timeline);
      setBenefactors(body.benefactors);
      setReading(nextReading);
      setConsentAccepted(false);
      const savedAt = new Date().toISOString();
      setResultSavedAt(savedAt);
      const saved = resultSource === "cloud" || writeSavedSajuResult({
        version: 1,
        savedAt,
        input: pendingInput,
        yunGender,
        chart: body.chart,
        timeline: body.timeline,
        benefactors: body.benefactors,
        reading: nextReading,
        consultation,
      });
      setStorageWarning(!saved);
    } catch (caught) {
      if (ticket !== generation.current) return;
      setReadingError(caught instanceof Error ? caught.message : "해석 생성에 실패했습니다. 다시 시도해 주세요.");
      const saved = resultSource === "cloud" || writeSavedSajuResult({
        version: 1,
        savedAt: new Date().toISOString(),
        input: pendingInput,
        yunGender,
        chart,
        timeline,
        benefactors,
        reading,
        consultation,
      });
      setStorageWarning(!saved);
    } finally {
      if (ticket === generation.current) setIsGenerating(false);
    }
  }

  async function requestConsultation() {
    if (!consentAccepted || isGenerating || !pendingInput || yunGender === null || !chart || !timeline) return;
    const ticket = ++generation.current;
    const controller = new AbortController();
    consultationAbort.current = controller;
    let next: Consultation = visibleConsultation?.readingStyleVersion === READING_STYLE_VERSION ? visibleConsultation : { version: 1, analysisVersion: 1, readingStyleVersion: READING_STYLE_VERSION, year: fortuneYear, chapters: [] };
    setIsGenerating(true); setConsultationError("");
    try {
      for (const definition of CHAPTERS) {
        if (next.chapters.some(c => c.id === definition.id)) continue;
        setConsultationProgress(`${CHAPTERS.findIndex(c=>c.id===definition.id)+1}/8장 · ${CHAPTER_LABELS[definition.id]}`);
        const response = await fetch("/api/consultation", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
          body: JSON.stringify({ consent: true, input: pendingInput, yunGender, fortuneYear, chapterId: definition.id }) });
        const body = await response.json();
        if (ticket !== generation.current) return;
        if (!response.ok) throw new Error(body.error?.message || "이번 장을 작성하지 못했습니다.");
        if (body.year !== fortuneYear || body.analysisVersion !== 1 || body.readingStyleVersion !== READING_STYLE_VERSION) throw new Error("상담의 계산 연도가 달라 다시 확인해야 합니다.");
        const chapter = validatePlainChapter(body.chapter, definition.id, facts.map(f=>f.id));
        next = { ...next, chapters: [...next.chapters, chapter].sort((a,b)=>CHAPTERS.findIndex(c=>c.id===a.id)-CHAPTERS.findIndex(c=>c.id===b.id)) };
        setConsultation(next);
        const savedAt = new Date().toISOString(); setResultSavedAt(savedAt);
        const saved = resultSourceRef.current === "cloud" || writeSavedSajuResult({ version: 1, savedAt, input: pendingInput, yunGender, chart, timeline, benefactors, reading, consultation: next });
        setStorageWarning(!saved);
      }
      setConsentAccepted(false);
    } catch(caught) {
      if (ticket === generation.current) setConsultationError(caught instanceof Error ? caught.message : "상담을 완성하지 못했습니다. 이어서 작성해 주세요.");
    } finally {
      if (ticket === generation.current) { setIsGenerating(false); setConsultationProgress(""); }
    }
  }

  function pauseConsultation() {
    generation.current++; consultationAbort.current?.abort();
    setIsGenerating(false); setConsultationProgress("");
    setConsultationError("작성을 멈췄습니다. 완성된 장은 유지됩니다. 이어서 작성할 수 있습니다.");
  }

  return (
    <section className="input-card" aria-labelledby="input-title">
      <AccountPanel current={cloudPayload} busy={isGenerating} onLoad={loadCloudResult} onClearCloud={clearCloudResult} />
      <h2 id="input-title">언제 태어나셨나요?</h2>
      <p className="form-intro">출생 정보를 입력하면 나에게 맞는 대운의 시간표를 볼 수 있습니다.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="calendar">날짜 기준</label>
        <select id="calendar" value={calendar} onChange={(event) => {
          setCalendar(event.target.value as "solar" | "lunar");
          setCalendarChoices([]);
          setError("");
        }}>
          <option value="solar">양력</option>
          <option value="lunar">음력</option>
        </select>

        {calendar === "solar" ? (
          <>
            <label htmlFor="date">생년월일 (양력)</label>
            <input id="date" name="date" type="date" required />
          </>
        ) : (
          <>
            <span className="field-label">생년월일 (음력)</span>
            <div className="date-parts" aria-label="음력 생년월일">
              <label className="sr-only" htmlFor="lunarYear">음력 출생 연도</label>
              <input id="lunarYear" name="lunarYear" type="number" min="1990" max="2100" placeholder="연도" aria-label="음력 출생 연도" required />
              <label className="sr-only" htmlFor="lunarMonth">음력 출생 월</label>
              <select id="lunarMonth" name="lunarMonth" defaultValue="" aria-label="음력 출생 월" required>
                <option value="" disabled>월</option>
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}월</option>)}
              </select>
              <label className="sr-only" htmlFor="lunarDay">음력 출생 일</label>
              <input id="lunarDay" name="lunarDay" type="number" min="1" max="30" placeholder="일" aria-label="음력 출생 일" required />
            </div>
            <label htmlFor="leapMonth">윤달 여부</label>
            <select id="leapMonth" value={leapMonth} onChange={(event) => setLeapMonth(event.target.value as typeof leapMonth)}>
              <option value="regular">평달</option>
              <option value="leap">윤달</option>
              <option value="unknown">모름</option>
            </select>
            <p className="method-help">모름을 선택하면 해당 연·월의 윤달 여부를 확인합니다. 평달과 윤달이 모두 가능하면 두 사주를 비교해 선택할 수 있습니다.</p>
          </>
        )}

        <label htmlFor="time">출생시간</label>
        <input id="time" name="time" type="time" required />

        <label htmlFor="country">태어난 국가</label>
        <select id="country" value={countryCode} onChange={(event) => {
          setCountryCode(event.target.value);
          setCityQuery("");
          setCityMatches([]);
          setCitySearched(false);
          setCityLoading(false);
          setBirthplace(null);
        }} required>
          {countries.length === 0 && <option value="KR">국가 목록 불러오는 중…</option>}
          {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>

        <label htmlFor="city">태어난 도시</label>
        <input id="city" type="search" value={cityQuery} autoComplete="off" placeholder="도시 이름을 입력하고 목록에서 선택" onChange={(event) => {
          setCityQuery(event.target.value);
          setBirthplace(null);
          setCityMatches([]);
          setCitySearched(false);
          setCityLoading(false);
        }} required />
        <p className="method-help">도시 이름을 한글 또는 영문으로 검색해 주세요. 한글 지명 자료: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames (CC BY 4.0)</a>.</p>
        {cityLoading && !birthplace && <p className="method-help">도시를 찾고 있습니다…</p>}
        {citySearched && cityMatches.length === 0 && !birthplace && <p className="method-help">일치하는 도시가 없습니다. 영문 이름을 확인해 주세요.</p>}
        {cityMatches.length > 0 && !birthplace && (
          <div className="city-matches" role="listbox" aria-label="도시 검색 결과">
            {cityMatches.map((city, index) => (
              <button type="button" role="option" aria-selected="false" key={`${city.city}-${city.province}-${index}`}
                onClick={() => { setBirthplace(city); setCityQuery(`${city.city}${city.province ? `, ${city.province}` : ""}`); setCityMatches([]); }}>
                {city.city}{city.province ? `, ${city.province}` : ""} · {city.timezone}
              </button>
            ))}
          </div>
        )}
        {birthplace && <p className="selected-city">선택: {birthplace.countryName} · {birthplace.city} · {birthplace.timezone}</p>}
        {locationError && <p className="error" role="alert">{locationError}</p>}

        <fieldset className="method-options">
          <legend>대운 계산 기준</legend>
          <p className="method-help">전통 계산 방식에 따라 대운의 진행 방향과 시기가 달라집니다.</p>
          <div className="radio-options">
            <label><input type="radio" name="yunGender" value="1" required /> 남성식</label>
            <label><input type="radio" name="yunGender" value="0" required /> 여성식</label>
          </div>
        </fieldset>

        <p className="input-note">1990년 이후 출생과 정확한 출생시간을 지원합니다. 출생지는 도시 목록에서 선택해 주세요.</p>
        <button type="submit" disabled={isGenerating}>내 인생 흐름 보기</button>
      </form>

      <div className="feedback" aria-live="polite">
        {error && <p className="error">{error}</p>}
        {calendarChoices.length > 1 && (
          <section className="calendar-choice" aria-labelledby="calendar-choice-title">
            <p className="result-label">윤달 여부를 모르는 경우</p>
            <h3 id="calendar-choice-title">가능한 두 날짜를 비교해 주세요</h3>
            <p>입력하신 음력 연·월에는 평달과 윤달이 모두 있습니다. 출생 정보만으로는 어느 날짜가 실제 생일인지 판별할 수 없어, 두 사주를 계산했습니다. 지나온 경험과 대운 흐름을 비교해 선택하면 전체 해석을 볼 수 있습니다.</p>
            <div className="calendar-choice-grid">
              {calendarChoices.map((choice) => (
                <article className="calendar-choice-card" key={choice.label}>
                  <h4>{choice.label}</h4>
                  <p>양력 {choice.solarDate}</p>
                  <p>{choice.chart.pillars.map((pillar) => `${pillar.label} ${pillar.text}(${pillar.korean})`).join(" · ")}</p>
                  <p>첫 대운 시작일 {choice.timeline.firstStartDate}</p>
                  <button type="button" onClick={() => activateCalendarChoice(choice)}>{choice.label}으로 전체 결과 보기</button>
                </article>
              ))}
            </div>
          </section>
        )}
        {storageWarning && <p className="storage-warning" role="status">브라우저 저장 공간을 사용할 수 없어 이 결과를 새로고침 후 복원하지 못할 수 있습니다.</p>}
        {chart && (
          <section className="result chart-result" aria-labelledby="result-title">
            {resultSource === "cloud" && <p className="method-help">계정에서 불러온 결과입니다. 새 해석을 만들면 보관함의 ‘계정에 저장’을 눌러 새 기록으로 남겨 주세요.</p>}
            <p className="result-label">계산 결과</p>
            <h2 id="result-title" className="day-pillar">
              {chart.pillars[2].korean}일주
            </h2>
            <p className="day-master">
              일간은 {chart.dayMaster.korean}
              {chart.dayMaster.element}({chart.dayMaster.character})입니다.
            </p>
            <MansePanel chart={chart} benefactors={benefactors} />
          </section>
        )}
        {deepAnalysis && <DeepAnalysisPanel analysis={deepAnalysis} />}
        {chart && timeline && fortune && <FlowOverview chart={chart} timeline={timeline} report={fortune} onYear={setFortuneYear} disabled={isGenerating} />}
        {fortune && (
          <div className="integrated-reading">
            <label htmlFor="fortune-year">살펴볼 운의 연도</label>
            <select id="fortune-year" value={fortuneYear} disabled={isGenerating} onChange={(event) => setFortuneYear(Number(event.target.value))}>
              {Array.from({ length: 111 }, (_, index) => 1990 + index).map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
            <FortunePanel report={fortune} reading={visibleReading} timezone={chart?.birthplace?.timezone} />
          </div>
        )}
        {timeline && (
          <section className="timeline-result" aria-labelledby="timeline-title">
            <div className="timeline-heading">
              <p className="result-label">나의 대운 시간표</p>
              <h2 id="timeline-title">지나온 시간부터 앞으로의 시간까지</h2>
              <p className="note">첫 대운 시작일: {timeline.firstStartDate} · {timeline.currentYear}년 기준</p>
            </div>
            {groups.map((group) => {
              const periods = timeline.periods.filter((period) => period.status === group.status);
              if (periods.length === 0) return null;
              return (
                <section className="timeline-group" key={group.status} aria-label={group.title}>
                  <div className="group-heading">
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                  <ol className="period-list">
                    {periods.map((period) => {
                      const interpretation = visibleReading?.periodReadings.find((item) => item.index === period.index);
                      const localInterpretation = localReading?.periodReadings.find((item) => item.index === period.index);
                      return (
                        <li className={`period-card period-${period.status}`} key={period.index}>
                          <div className="period-topline">
                            <span className="period-years">{period.startYear}–{period.endYear}</span>
                            {period.status === "current" && <span className="current-badge">현재</span>}
                          </div>
                          <strong className="period-name">{period.index === 0 ? "대운 시작 전" : `${period.korean} 대운`}</strong>
                          {period.index !== 0 && <span className="period-hanja">{period.ganji}</span>}
                          <span className="period-age">사주식 나이 {period.startAge}–{period.endAge}세</span>
                          {localInterpretation && (
                            <details className="period-local-disclosure" open={!visibleReading && period.status === "current"}>
                              <summary>이 대운 자세히 읽기</summary>
                              <div className="period-reading local-period-reading">
                                <p className="period-theme">{localInterpretation.theme}</p>
                                <p><strong>살릴 점</strong> {localInterpretation.strengths}</p>
                                <p><strong>주의할 점</strong> {localInterpretation.cautions}</p>
                                <p><strong>현실적인 조언</strong> {localInterpretation.advice}</p>
                                <p className="period-reflection"><strong>경험을 돌아볼 질문</strong> {localInterpretation.reflection}</p>
                              </div>
                            </details>
                          )}
                          {interpretation && (
                            <div className="period-reading">

                              <p className="period-theme">{interpretation.theme}</p>
                              <p><strong>살릴 점</strong> {interpretation.strengths}</p>
                              <p><strong>주의할 점</strong> {interpretation.cautions}</p>
                              <p><strong>현실적인 조언</strong> {interpretation.advice}</p>
                              <p className="period-reflection"><strong>경험을 돌아볼 질문</strong> {interpretation.reflection}</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
            <p className="timeline-footnote">사주식 나이는 태어난 해를 1세로 셉니다. 대운은 시기별로 살펴보는 전통적 틀이며, 실제 사건이나 미래를 확정하지 않습니다.</p>

          </section>
        )}
        {localReading && (
          <details className="reading-result">
            <summary>타고난 네 기둥 자세히 읽기</summary>
            <div className="pillar-reading-grid">
              {localReading.pillarReadings.map((item) => (
                <article className="pillar-reading-card" key={item.label}>
                  <p className="result-label">{item.label}</p><h4>{item.hanja} · {item.korean}</h4>
                  <p>{item.characterGloss}</p><p>{item.interpretation}</p>
                </article>
              ))}
            </div>
          </details>
        )}
        {pendingInput && (
          <section className="gemini-consent" aria-labelledby="gemini-consent-title">
            <h2 id="gemini-consent-title">나의 사주를 깊이 풀어보기</h2>
            <p>동의하면 계산된 사주 네 기둥, 오행 분포, 귀인 근거, 십성·지장간·합충, 강약 비교·격국·용신 후보와 대운·세운·월운 정보가 Google Gemini로 전송되어 해석에 사용됩니다. 원래 입력한 생년월일, 출생 시각과 출생지는 전달하지 않습니다. 해석 문장은 AI가 생성합니다.</p>
            {reading && !visibleReading && <p className="storage-warning">저장된 해석은 이전 방식 또는 다른 연도로 작성되었습니다. 위에는 현재 계산으로 만든 풀이가 표시됩니다. 아래에서 새 해석을 생성할 수 있으며, 실패해도 이전 저장 해석은 보존됩니다.</p>}
            <p className="storage-note">{resultSource === "cloud" ? "계정에서 연 결과는 기기에 자동 저장하지 않습니다. 새 풀이를 보관하려면 계정에 저장을 눌러 주세요." : "계산 결과와 완성된 상담 장은 이 브라우저에 저장됩니다. 다른 기기에서도 보려면 로그인 후 계정에 저장을 눌러 주세요."}</p>
            <label className="consent-option" htmlFor="gemini-consent">
              <input id="gemini-consent" type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
              계산 정보를 Google Gemini에 보내 해석을 생성하는 데 동의합니다.
            </label>
            {readingError && <p className="error" role="alert">{readingError}</p>}
            <button type="button" onClick={requestGeminiReading} disabled={!consentAccepted || isGenerating}>
              {isGenerating ? "해석을 만들고 있습니다…" : readingError ? "동의하고 다시 요청" : reading ? "최신 분석으로 다시 해석하기" : "나의 종합 해석 만들기"}
            </button>
            {isGenerating && !consultationProgress && <p className="method-help" role="status">평생 흐름과 대운·세운·월운을 함께 풀고 있습니다. 잠시 기다려 주세요.</p>}
            <div className="consultation-start" id="consultation-start"><h3>한 사람의 삶을 깊이 살피는 8장 상담</h3>
              <p>나의 성향, 잘 맞는 환경, 앞으로의 변화, 일, 돈, 관계를 쉬운 말로 설명합니다. 생활 속 예시와 지금 해볼 일을 먼저 읽고, 궁금하면 사주 근거를 펼쳐 보세요. 장별로 생성하므로 몇 분 걸릴 수 있고, 완성한 장부터 읽을 수 있습니다.</p>
              {consultation && !visibleConsultation && <p className="storage-warning">다른 연도의 상담이 저장되어 있습니다. 선택 연도로 작성하면 새로 완성된 장부터 저장됩니다.</p>}
              {visibleConsultation && visibleConsultation.readingStyleVersion !== READING_STYLE_VERSION && <p className="storage-warning">이전에 작성한 상담입니다. 쉬운 말로 다시 작성할 수 있습니다. 첫 장 작성에 성공하면 새 상담으로 바뀝니다.</p>}
              <button type="button" onClick={requestConsultation} disabled={!consentAccepted || isGenerating || visibleConsultation?.readingStyleVersion === READING_STYLE_VERSION && visibleConsultation.chapters.length === 8}>{visibleConsultation?.readingStyleVersion === READING_STYLE_VERSION && visibleConsultation.chapters.length === 8 ? "8장 상담 작성 완료" : visibleConsultation && visibleConsultation.readingStyleVersion !== READING_STYLE_VERSION ? "쉬운 말로 8장 다시 작성하기" : visibleConsultation?.chapters.length ? "남은 상담 이어서 작성하기" : "쉬운 말로 8장 상담 시작하기"}</button>
              {consultationProgress && <><p role="status">{consultationProgress} 작성 중…</p><progress max={8} value={visibleConsultation?.readingStyleVersion === READING_STYLE_VERSION ? visibleConsultation.chapters.length : 0} aria-label="완성된 상담 장"/><button type="button" className="secondary-button" onClick={pauseConsultation}>잠시 멈추기</button></>}
              {consultationError && <p className="error" role="alert">{consultationError}</p>}
            </div>
          </section>
        )}
        {visibleConsultation && visibleConsultation.chapters.length > 0 && <ConsultationPanel consultation={visibleConsultation} facts={facts} />}
        {visibleReading && (
          <section className="reading-result" aria-labelledby="reading-title">
            <p className="result-label">나의 사주 종합 분석</p>
            <h2 id="reading-title">타고난 바탕과 선택의 방향</h2>
            <p className="reading-intro">원국과 운에서 반복되는 강점, 부담이 커지는 조건, 행동으로 옮길 선택을 함께 읽어보세요.</p>
            <div className="reading-grid">
              {([
                ["삶 전반", visibleReading.overview],
                ["오행", visibleReading.elements],
                ["귀인", visibleReading.benefactors],
                ["진로와 일", visibleReading.career],
                ["관계", visibleReading.relationships],
                ["돈", visibleReading.money],
                ["특히 조심할 점", visibleReading.caution],
              ] as const).map(([title, content]) => (
                <article className="reading-card" key={title}>
                  <h3>{title}</h3>
                  <p>{content}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
