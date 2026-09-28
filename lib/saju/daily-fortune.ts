import lunar from "lunar-javascript";
import type { SajuChart } from "./chart";
import type { DaewoonTimeline } from "./daewoon";
import { analyzeFlow, forLifeStage, koreanGanji } from "./fortune";

export type DailyContext = {
  date: string;
  dayGanji: string;
  dayKorean: string;
  monthGanji: string;
  yearGanji: string;
};

export function koreanClock(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

export function nextDailyRefresh(now: Date): string {
  const { date, hour } = koreanClock(now);
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + (hour >= 9 ? 1 : 0), 0, 0, 0)).toISOString();
}

export function buildDailyContext(date: string): DailyContext {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("오늘 운세 날짜를 확인해 주세요.");
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1990 || year > 2100 || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
    throw new Error("오늘 운세 날짜를 확인해 주세요.");
  }
  const eight = lunar.Solar.fromYmdHms(year, month, day, 12, 0, 0).getLunar().getEightChar();
  const dayGanji = eight.getDay();
  return {
    date, dayGanji, dayKorean: koreanGanji(dayGanji),
    monthGanji: eight.getMonth(), yearGanji: eight.getYear(),
  };
}

export function buildPersonalDailyFortune(chart: SajuChart, timeline: DaewoonTimeline, context: DailyContext) {
  const year = Number(context.date.slice(0, 4));
  const period = timeline.periods.find((item) => item.startYear <= year && year <= item.endYear);
  const first = timeline.periods[0];
  const age = year - (first.startYear - first.startAge + 1) + 1;
  const extra = [
    { label: "올해", ganji: context.yearGanji },
    { label: "이번 달", ganji: context.monthGanji },
    ...(period?.ganji ? [{ label: "현재 대운", ganji: period.ganji }] : []),
  ];
  const flow = forLifeStage(analyzeFlow(chart, context.dayGanji, "오늘", extra), age);
  return {
    ...flow,
    date: context.date,
    dayGanji: context.dayGanji,
    dayKorean: context.dayKorean,
    period: period?.ganji ? `${period.startYear}~${period.endYear}년 ${period.korean} 대운` : "대운 시작 전",
  };
}
