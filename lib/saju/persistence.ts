import { validateInput, type SajuChart, type SajuInput } from "./chart";
import type { Benefactor } from "./benefactors";
import type { DaewoonTimeline, YunGender } from "./daewoon";
import { validateGeminiSajuReading, type GeminiSajuReading } from "./gemini-reading";
import { createGeminiReadingContext } from "./gemini-reading";
import { consultationFacts, validateConsultation, type Consultation } from "./consultation";
import { buildLifeSeasons } from "./life-seasons";

const STORAGE_KEY = "saju-reading:v1";

export type SavedSajuResult = {
  version: 1;
  savedAt: string;
  input: SajuInput;
  yunGender: YunGender;
  chart: SajuChart;
  timeline: DaewoonTimeline;
  benefactors: Benefactor[];
  reading: GeminiSajuReading | null;
  consultation?: Consultation;
};

function getStorage(storage?: Storage): Storage | undefined {
  try {
    return storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  } catch {
    return undefined;
  }
}

function validChart(value: unknown): value is SajuChart {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const chart = value as Partial<SajuChart>;
  const pillarLabels = ["년주", "월주", "일주", "시주"];
  const elementNames = ["목", "화", "토", "금", "수"] as const;
  return Array.isArray(chart.pillars) && chart.pillars.length === 4 &&
    chart.pillars.every((pillar, index) => pillar && pillar.label === pillarLabels[index] &&
      typeof pillar.text === "string" && typeof pillar.stem === "string" && typeof pillar.branch === "string") &&
    !!chart.elements && elementNames.every((element) => Number.isInteger(chart.elements?.[element]) && chart.elements![element] >= 0) &&
    !!chart.dayMaster && typeof chart.dayMaster.korean === "string" && typeof chart.dayMaster.element === "string" &&
    typeof chart.method === "string" && typeof chart.engine === "string" && typeof chart.elementMethod === "string";
}

function validTimeline(value: unknown): value is DaewoonTimeline {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const timeline = value as Partial<DaewoonTimeline>;
  return Array.isArray(timeline.periods) && timeline.periods.length > 0 && timeline.periods.length <= 11 &&
    timeline.periods.every((period, index) => period && (timeline.periods![0].index === 0 || timeline.periods![0].index === 1) && period.index === index + timeline.periods![0].index &&
      Number.isInteger(period.startYear) && Number.isInteger(period.endYear) &&
      typeof period.ganji === "string" && typeof period.korean === "string" &&
      (period.status === "past" || period.status === "current" || period.status === "future")) &&
    typeof timeline.firstStartDate === "string" &&
    (timeline.direction === "forward" || timeline.direction === "backward") &&
    Number.isInteger(timeline.currentYear);
}

function validBenefactors(value: unknown): value is Benefactor[] {
  const names = ["천을귀인", "태극귀인", "문창귀인", "월덕귀인"];
  const pillars = ["년주", "월주", "일주", "시주"];
  return Array.isArray(value) && value.length === 4 && value.every((benefactor, index) =>
    benefactor && benefactor.name === names[index] && typeof benefactor.basis === "string" &&
    typeof benefactor.description === "string" && Array.isArray(benefactor.targets) &&
    benefactor.targets.every((target: unknown) => typeof target === "string") &&
    Array.isArray(benefactor.matchedPillars) && benefactor.matchedPillars.every((label: unknown) => pillars.includes(label as string)));
}

export function isSavedSajuResult(value: unknown): value is SavedSajuResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const saved = value as Partial<SavedSajuResult>;
  if (saved.version !== 1 || typeof saved.savedAt !== "string" || !Number.isFinite(Date.parse(saved.savedAt)) ||
    (saved.yunGender !== 0 && saved.yunGender !== 1)) return false;
  try {
    validateInput(saved.input as SajuInput);
  } catch {
    return false;
  }
  if (!validChart(saved.chart) || !validTimeline(saved.timeline) || !validBenefactors(saved.benefactors)) return false;
  if (saved.consultation !== undefined) {
    try {
      const consultation = validateConsultation(saved.consultation);
      const context = createGeminiReadingContext(saved.chart, saved.timeline, saved.benefactors, consultation.year);
      validateConsultation(consultation, consultationFacts(context).map(f => f.id), consultation.readingStyleVersion===3 ? buildLifeSeasons(saved.chart,saved.timeline) : undefined);
    } catch { return false; }
  }
  if (saved.reading === null) return true;
  try {
    validateGeminiSajuReading(saved.reading, saved.timeline.periods.map((period) => period.index));
    return true;
  } catch {
    return false;
  }
}

export function readSavedSajuResult(storage?: Storage): SavedSajuResult | null {
  const target = getStorage(storage);
  if (!target) return null;
  try {
    const serialized = target.getItem(STORAGE_KEY);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    return isSavedSajuResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSavedSajuResult(value: SavedSajuResult, storage?: Storage): boolean {
  const target = getStorage(storage);
  if (!target || !isSavedSajuResult(value)) return false;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedSajuResult(storage?: Storage): boolean {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
